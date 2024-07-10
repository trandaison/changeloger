import { Changelog } from './Changelog';
import { Version } from './Version';
import { ChangelogerRuntimeConfig } from '../types';

export class Release {
  public version!: Version;
  public commits!: string[];

  constructor(
    public content: string,
    public runtimeConfig: ChangelogerRuntimeConfig
  ) {
    const lines = content.split('\n');
    const releaseVer = lines
      .shift()!
      .replace(
        `${Changelog.versionHeader}${this.runtimeConfig.versionPrefix}`,
        ''
      );
    this.version = new Version(releaseVer);
    lines.shift(); // remove empty line
    const compareLink = lines.shift(); // remove compare link
    if (compareLink?.trim()) lines.shift(); // remove empty line
    const regex = /\[`([a-f0-9]{7,40})`\]\(https:\/\/[^\)]+\)/g;
    this.commits = lines.flatMap((line) => {
      const matches = line.matchAll(regex);
      return Array.from(matches).map((match) => match[1]);
    });
  }

  toString() {
    return this.version.toString() + '[' + this.commits.join(', ') + ']';
  }

  static parse(rawRelease: string, runtimeConfig: ChangelogerRuntimeConfig) {
    if (!rawRelease) return [];

    const versionHeaderRegex = new RegExp(
      `(?=${Changelog.versionHeader}\\d+\\.\\d+\\.\\d+)`,
      'g'
    );
    const releasesContent = rawRelease.trim().split(versionHeaderRegex);
    return releasesContent.map(
      (content) => new Release(content, runtimeConfig)
    );
  }
}
