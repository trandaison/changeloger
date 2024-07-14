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
  public provider: ChangelogerProvider | null = null;

  constructor(
    public path: string = process.cwd(),
    public config: ChangelogerConfig,
    public packageJson: PackageJson
  ) {}

  async load() {
    await this.status();
    const url =
      typeof this.packageJson.value.repository === 'string'
        ? this.packageJson.value.repository
        : this.packageJson.value.repository?.url;
    this.repositoryUrl = url ?? (await this.remote());
    this.currentBranch = await this.branch();
    this.provider =
      this.config.provider ?? guessProvider(this.repositoryUrl ?? '');
  }

  get pullRequestRegex() {
    return getPullRequestRegex(this.provider);
  }

  status() {
    const command = `git -C ${this.path} status`;
    return new Promise<string>((resolve, reject) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error || stderr) {
          console.error(command, 'returns error:', stderr || error);
          return reject(error);
        }

        resolve(stdout);
      });
    });
  }

  isClean() {
    const command = `git -C ${this.path} diff --exit-code`;
    return new Promise<boolean>((resolve) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error || stderr) return resolve(false);

        resolve(true);
      });
    });
  }

  log({ range = [], option = '' }: { range?: Range; option?: string } = {}) {
    const [fromCommit, toCommit = 'HEAD'] = range;
    const queryRange = fromCommit ? `${fromCommit}..${toCommit}` : '';
    const command = `git -C ${this.path} log ${queryRange} ${option}`.trim();
    return new Promise<string[]>((resolve, reject) => {
      exec(command, (error: any, log: any, stderr: any) => {
        if (error || stderr) {
          console.error(command, 'returns error:', stderr || error);
          return reject(error);
        }

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
        if (error || stderr) {
          console.error(command, 'returns error:', stderr || error);
          return reject(error);
        }

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
            const isPullRequest = this.pullRequestRegex.test(entry.message);
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
        const isPullRequest = this.pullRequestRegex.test(log.message);
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
    const command = `git -C ${this.path} remote -v`;
    return new Promise<string | null>((resolve, reject) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error || stderr) {
          console.error(command, 'returns error:', stderr || error);
          return reject(error);
        }

        const remoteEntry = stdout.split('\n').find((entry: string) => {
          return entry.startsWith(this.config.remote);
        });
        const remote = remoteEntry?.split('\t')[1]?.split(' ')[0];
        if (!remote) return resolve(null);

        resolve(toRepoUrl(remote));
      });
    });
  }

  branch() {
    const command = `git -C ${this.path} branch --show-current`;
    return new Promise<string>((resolve, reject) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error || stderr) {
          console.error(command, 'returns error:', stderr || error);
          return reject(error);
        }

        resolve(stdout.trim());
      });
    });
  }

  revList({
    sinceCommit,
    headCommit = 'HEAD',
  }: {
    sinceCommit: string;
    headCommit?: string;
  }) {
    const command = `git -C ${this.path} rev-list ${sinceCommit}..${headCommit}`;
    return new Promise<string[]>((resolve, reject) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error || stderr) {
          console.error(command, 'returns error:', stderr || error);
          return reject(error);
        }

        resolve(stdout.split('\n').filter(Boolean));
      });
    });
  }

  tag2Hash(version: string, fullHash = false) {
    const command = `git -C ${this.path} rev-list -n 1 ${version}`;
    return new Promise<string | null>((resolve, reject) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error || stderr) {
          console.error(command, 'returns error:', stderr || error);
          return reject(error);
        }

        if (!stdout) return resolve(null);

        resolve(fullHash ? stdout : stdout.substring(0, 7));
      });
    });
  }

  add(files: string[]) {
    return new Promise<string>((resolve, reject) => {
      const command = `git -C ${this.path} add ${files.join(' ')}`;
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error || stderr) {
          console.error(command, 'returns error:', stderr || error);
          return reject(error);
        }

        resolve(stdout);
      });
    });
  }

  commit(message: string) {
    const command = `git -C ${this.path} commit -m "${message}"`;
    return new Promise<string>((resolve, reject) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error || stderr) {
          console.error(command, 'returns error:', stderr || error);
          return reject(error);
        }

        resolve(stdout);
      });
    });
  }

  tag(tag: string) {
    const command = `git -C ${this.path} tag -a ${tag} -m "${tag}"`;
    return new Promise<string>((resolve, reject) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error || stderr) {
          console.error(command, 'returns error:', error);
          return reject(error);
        }

        resolve(stdout);
      });
    });
  }

  push(branch = 'HEAD', option = '') {
    const command =
      `git -C ${this.path} push ${this.config.remote} ${branch} ${option}`.trim();
    return new Promise<string>((resolve, reject) => {
      exec(command, (error: any, stdout: any, stderr: any) => {
        if (error) {
          console.error(command, 'returns error:', error);
          return reject(error);
        }

        resolve(stdout || stderr);
      });
    });
  }

  static rangeToOption(range: Range) {
    const [fromCommit, toCommit = 'HEAD'] = range;
    return fromCommit ? `${fromCommit}..${toCommit}` : '';
  }
}
