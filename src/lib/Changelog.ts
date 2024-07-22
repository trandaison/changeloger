import { resolve } from 'path';
import { promises as fs } from 'fs';
import { Git } from './Git';
import { Commit } from './Commit';
import { Version } from './Version';
import { PackageJson } from './PackageJson';
import { fileExists, compareUrl } from './utils';
import { ChangelogerRuntimeConfig } from '../types';
import { CommitType, defaultConfig, versionHeader } from '../config';
// import { Release } from '../utils/Release';

export class Changelog {
  static placeholder = '<!-- Generating... -->';
  static versionHeader = versionHeader;

  public fullContent?: string;
  public latestCommit?: string | null;

  constructor(
    public runtimeConfig: ChangelogerRuntimeConfig,
    public packageJson: PackageJson,
    public git: Git
  ) {}

  async load() {
    if (await fileExists(this.filePath)) {
      this.fullContent = await fs.readFile(this.filePath, 'utf8');
    } else {
      this.fullContent = '';
      await fs.writeFile(this.filePath, Changelog.placeholder);
    }
    // const releases = Release.parse(this.content, this.runtimeConfig);
    // releases.forEach((release) => console.log(release.toString()));
    await this.updateLatestCommit();
  }

  get fileName() {
    return this.runtimeConfig.output.replace(
      /\{branch\}/g,
      this.runtimeConfig.branch ?? ''
    );
  }

  get filePath() {
    return resolve(this.runtimeConfig.path, this.fileName);
  }

  get content() {
    if (!this.fullContent) return '';

    return Changelog.removeHeader(this.fullContent);
  }

  get latestVersion() {
    const versionPrefix = `${Changelog.versionHeader}${this.runtimeConfig.versionPrefix}`;
    const currentVer =
      this.lines[1]?.trim() ||
      `${versionPrefix}${this.runtimeConfig.startVersion}`;

    return Version.parse(currentVer, this.runtimeConfig.versionPrefix);
  }

  get prevVersion() {
    const currentVer = this.lines[1]?.trim();
    return currentVer
      ? Version.parse(currentVer, this.runtimeConfig.versionPrefix)
      : null;
  }

  get nextVersion() {
    let versionBumpType = this.runtimeConfig.versionBumpType;
    if (this.runtimeConfig.major) versionBumpType = 'major';
    if (this.runtimeConfig.minor) versionBumpType = 'minor';
    if (this.runtimeConfig.patch) versionBumpType = 'patch';

    return this.latestVersion.nextVersion(versionBumpType);
  }

  get latestCompareChangesUrl() {
    return (this.lines[3] ?? '')
      .replace('[compare changes](', '')
      .replace(')', '');
  }

  get entries() {
    if (!this.content) return [];

    // TODO: Implement this
    return [];
  }

  async updateLatestCommit() {
    this.latestCommit = this.prevVersion
      ? await this.git.tag2Hash(
          this.prevVersion.toString(this.runtimeConfig.versionPrefix, null)
        )
      : null;
  }

  async writeChanges(commits: Commit[]) {
    if (!commits.length) return;

    const { versionPrefix, header, date } = this.runtimeConfig;
    const compareChangesUrl = compareUrl(
      this.prevVersion?.toString(versionPrefix, null) ?? null,
      this.nextVersion.toString(versionPrefix, null),
      this.git.provider,
      this.git.repositoryUrl
    );
    const compareChangesLink = compareChangesUrl
      ? `[compare changes](${compareChangesUrl})`
      : '';
    const classifiedCommits = Commit.classify(commits);
    const commitEntries = await this.commitsToEntries(classifiedCommits);

    let newContent = [
      header,
      this.nextVersion.toString(
        `${Changelog.versionHeader}${versionPrefix}`,
        date
      ),
      ...(compareChangesLink ? [compareChangesLink] : []),
      commitEntries.join('\n'),
    ].join('\n\n');
    newContent += this.content ? '\n\n' + this.content : '\n';

    await fs.writeFile(this.filePath, newContent);
  }

  delete() {
    return fs.unlink(this.filePath);
  }

  private get lines() {
    return this.content?.split('\n') || [];
  }

  static removeHeader(content: string) {
    return content.split('\n').slice(1).join('\n');
  }

  private async commitsToEntries(
    commits: Commit[] | Record<CommitType, Commit[]>
  ) {
    if (Array.isArray(commits)) {
      return Promise.all(
        commits.map((commit) => commit.toChangelogEntry(this.git.repositoryUrl))
      );
    }

    const entries = await Promise.all(
      Object.entries(commits).map(async ([type, _commits]) => {
        const commitLines = (await this.commitsToEntries(_commits)) as string[];
        const header = `### ${defaultConfig.typeTitle[type as CommitType]}`;
        return ['', header, '', ...commitLines];
      })
    );
    return entries.flat();
  }
}
