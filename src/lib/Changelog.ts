import { resolve } from 'path';
import { promises as fs } from 'fs';
import { Git } from './Git';
import { Commit } from './Commit';
import { Version } from './Version';
import { PackageJson } from './PackageJson';
import { fileExists, compareUrl } from './utils';
import { ChangelogerRuntimeConfig } from '../types';
// import { Release } from '../utils/Release';

export class Changelog {
  static placeholder = '<!-- Generating... -->';
  static versionHeader = '## ';

  public fullContent?: string;
  public latestCommit?: string | null;

  constructor(
    public runtimeConfig: ChangelogerRuntimeConfig,
    public packageJson: PackageJson,
    public git: Git
  ) {}

  async load() {
    if (await fileExists(this.changelogFilePath)) {
      this.fullContent = await fs.readFile(this.changelogFilePath, 'utf8');
    } else {
      this.fullContent = '';
      await fs.writeFile(this.changelogFilePath, Changelog.placeholder);
    }
    // const releases = Release.parse(this.content, this.runtimeConfig);
    // releases.forEach((release) => console.log(release.toString()));
    await this.updateLatestCommit();
  }

  get changelogFilePath() {
    const fileName = this.runtimeConfig.fileName.replace(
      /\{branch\}/g,
      this.runtimeConfig.branch ?? ''
    );
    return resolve(this.runtimeConfig.path, fileName);
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

    return new Version(currentVer.replace(versionPrefix, ''));
  }

  get prevVersion() {
    const versionPrefix = `${Changelog.versionHeader}${this.runtimeConfig.versionPrefix}`;
    const currentVer = this.lines[1]?.trim();
    return currentVer
      ? new Version(currentVer.replace(versionPrefix, ''))
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
      ? await this.git.versionToCommitHash(
          this.prevVersion.toString(this.runtimeConfig.versionPrefix)
        )
      : null;
  }

  async writeChanges(commits: Commit[]) {
    if (!commits.length) return this.load();

    const compareChangesUrl = compareUrl(
      this.prevVersion?.toString(this.runtimeConfig.versionPrefix) ?? null,
      this.nextVersion.toString(this.runtimeConfig.versionPrefix),
      this.runtimeConfig.provider,
      this.git.repositoryUrl
    );
    const compareChangesLink = compareChangesUrl
      ? `[compare changes](${compareChangesUrl})`
      : '';
    const commitEntries = await this.commitsToEntries(commits);

    let newContent = [
      this.runtimeConfig.header,
      this.nextVersion.toString(
        `${Changelog.versionHeader}${this.runtimeConfig.versionPrefix}`
      ),
      ...(compareChangesLink ? [compareChangesLink] : []),
      commitEntries.join('\n'),
    ].join('\n\n');
    newContent += this.content ? '\n\n' + this.content : '\n';

    await fs.writeFile(this.changelogFilePath, newContent);
    return this.load();
  }

  delete() {
    return fs.unlink(this.changelogFilePath);
  }

  private get lines() {
    return this.content?.split('\n') || [];
  }

  static removeHeader(content: string) {
    return content.split('\n').slice(1).join('\n');
  }

  private commitsToEntries(commits: Commit[]) {
    return Promise.all(
      commits.map((commit) => commit.toChangelogEntry(this.git.repositoryUrl))
    );
  }
}
