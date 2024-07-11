import childProcess from 'child_process';
import { PackageJson } from './PackageJson';
import { guessProvider, toRepoUrl } from './utils';
import { getPullRequestRegex } from '../config';
import { ChangelogerConfig, ChangelogerProvider, GitLog } from '../types';

const { exec } = childProcess;

export type Range = Array<string | undefined | null>;

export class Git {
  static prettyLogOption = `--pretty=format:'{"hash":"%h", "authorName":"%an", "authorEmail":"%ae", "date":"%aI", "message":"%s", "body":"%b", "refs":"%D", "parentHashes":"%p"}'`;

  public repositoryUrl?: string | null;
  public currentBranch?: string;
  public provider?: ChangelogerProvider | null;

  constructor(
    public path: string = process.cwd(),
    public config: ChangelogerConfig,
    public packageJson: PackageJson
  ) {}

  async load() {
    await this.status();
    this.repositoryUrl =
      this.packageJson.value.repository?.url ?? (await this.remote());
    this.currentBranch = await this.branch();
    this.provider =
      this.config.provider ?? guessProvider(this.repositoryUrl ?? '');
  }

  status() {
    return new Promise<string>((resolve, reject) => {
      exec(
        `git -C ${this.path} status`,
        (error: any, stdout: any, stderr: any) => {
          if (error || stderr) return reject(error);

          resolve(stdout);
        }
      );
    });
  }

  isClean() {
    return new Promise<boolean>((resolve, reject) => {
      exec(
        `git -C ${this.path} diff --exit-code`,
        (error: any, stdout: any, stderr: any) => {
          if (error || stderr) return resolve(false);

          resolve(true);
        }
      );
    });
  }

  log({ range = [], option = '' }: { range?: Range; option?: string } = {}) {
    const [fromCommit, toCommit = 'HEAD'] = range;
    const queryRange = fromCommit ? `${fromCommit}..${toCommit}` : '';
    const command = `git -C ${this.path} log ${queryRange} ${option}`.trim();
    return new Promise<string[]>((resolve, reject) => {
      exec(command, (error: any, log: any, stderr: any) => {
        if (error || stderr) return reject(error);

        const regex = /(^|\n)(?=commit\s[0-9a-f]{40}\n)/g;
        const logs = log
          .split(regex)
          .filter(Boolean)
          .map((entry: string) => entry.trim());
        resolve(logs);
      });
    });
  }

  prettyLog({
    option = '',
    range = [],
  }: { option?: string; range?: Range } = {}) {
    const command = `git -C ${this.path} log ${Git.rangeToOption(range)} ${
      Git.prettyLogOption
    } ${option} | sed -e ':a' -e 'N' -e '$!ba' -e 's/}\\n{/}, {/g' -e 's/\\n/\\\\n/g'`.trim();
    return new Promise<GitLog[]>((resolve, reject) => {
      exec(command, async (error: any, log: any, stderr: any) => {
        if (error || stderr) return reject(error);

        const json = JSON.parse(`[${log}]`);
        const logs = await Promise.all(
          json.map(async (entry: any) => {
            const refs = entry.refs
              .split(',')
              .map((ref: string) => ref.trim())
              .filter(Boolean);
            const branch = refs.find((ref: string) =>
              ref.startsWith('origin/')
            );
            const parentHashes = entry.parentHashes
              .split(' ')
              .map((ref: string) => ref.trim())
              .filter(Boolean);
            const isPullRequest = getPullRequestRegex(
              this.config.provider
            ).test(entry.message);
            let commits: string[] | null = null;
            if (isPullRequest) {
              const [sinceCommit, headCommit] = parentHashes;
              commits = (await this.revList({ sinceCommit, headCommit })).map(
                (c) => c.substring(0, 7)
              );
            }
            return {
              ...entry,
              body: entry.body.trim(),
              refs,
              branch: branch?.replace('origin/', '') ?? null,
              parentHashes,
              commits,
              isPullRequest,
            };
          })
        );
        resolve(logs);
      });
    });
  }

  async mergesLog({ range = [] }: { range?: Range } = {}) {
    const [a, b] = range;
    if (b && b.toUpperCase() !== 'HEAD' && !a)
      throw new Error('fromCommit is required when toCommit is set');

    const logs = await this.prettyLog({ range, option: '--merges' });
    return await Promise.all(
      logs.map(async (log) => {
        const isPullRequest = getPullRequestRegex(this.config.provider).test(
          log.message
        );
        const [sinceCommit, headCommit] = log.parentHashes;
        const commits =
          (await this.revList({ sinceCommit, headCommit })).map((c) =>
            c.substring(0, 7)
          ) ?? null;
        return {
          ...log,
          isPullRequest,
          commits,
        } as GitLog;
      })
    );
  }

  pullRequestUrl(prNo: number | undefined, repositoryUrl?: string | null) {}

  remote() {
    return new Promise<string | null>((resolve, reject) => {
      exec(
        `git -C ${this.path} remote -v`,
        (error: any, stdout: any, stderr: any) => {
          if (error || stderr) return reject(error);

          const [firstEntry] = stdout.split('\n').filter(Boolean);
          const remote = firstEntry?.split('\t')[1]?.split(' ')[0];
          if (!remote) return resolve(null);

          resolve(toRepoUrl(remote));
        }
      );
    });
  }

  branch() {
    return new Promise<string>((resolve, reject) => {
      exec(
        `git -C ${this.path} branch --show-current`,
        (error: any, stdout: any, stderr: any) => {
          if (error || stderr) return reject(error);

          resolve(stdout.trim());
        }
      );
    });
  }

  revList({
    sinceCommit,
    headCommit = 'HEAD',
  }: {
    sinceCommit: string;
    headCommit?: string;
  }) {
    return new Promise<string[]>((resolve, reject) => {
      exec(
        `git -C ${this.path} rev-list ${sinceCommit}..${headCommit}`,
        (error: any, stdout: any, stderr: any) => {
          if (error || stderr) return reject(error);

          resolve(stdout.split('\n').filter(Boolean));
        }
      );
    });
  }

  versionToCommitHash(version: string) {
    const command = `git -C ${this.path} show ${version} --pretty=format:%h`;
    return new Promise<string>((resolve, reject) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error || stderr) return reject(error);

        resolve(stdout.split('\n')[5]?.trim() || null);
      });
    });
  }

  add(files: string[]) {
    return new Promise<string>((resolve, reject) => {
      exec(
        `git -C ${this.path} add ${files.join(' ')}`,
        (error: any, stdout: any, stderr: any) => {
          if (error || stderr) return reject(error);

          resolve(stdout);
        }
      );
    });
  }

  commit(message: string) {
    return new Promise<string>((resolve, reject) => {
      exec(
        `git -C ${this.path} commit -m "${message}"`,
        (error: any, stdout: any, stderr: any) => {
          if (error || stderr) return reject(error);

          resolve(stdout);
        }
      );
    });
  }

  tag(tag: string) {
    return new Promise<string>((resolve, reject) => {
      exec(
        `git -C ${this.path} tag ${tag}`,
        (error: any, stdout: any, stderr: any) => {
          if (error || stderr) return reject(error);

          resolve(stdout);
        }
      );
    });
  }

  static rangeToOption(range: Range) {
    const [fromCommit, toCommit = 'HEAD'] = range;
    return fromCommit ? `${fromCommit}..${toCommit}` : '';
  }
}
