import { format } from './utils';
import { versionHeader } from '../config';

export class Version {
  public major!: number;
  public minor!: number;
  public patch!: number;

  constructor(major: number, minor: number, patch: number);
  constructor(major: string, minor: string, patch: string);
  constructor(version: string);
  constructor(
    majorOrVersion: number | string,
    minor?: number | string,
    patch?: number | string
  ) {
    if (
      typeof majorOrVersion === 'string' &&
      minor === undefined &&
      patch === undefined
    ) {
      const parts = majorOrVersion.split('.').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) {
        throw new Error(
          `Invalid version string format: ${JSON.stringify({
            majorOrVersion,
            minor,
            patch,
          })}}`
        );
      }
      [this.major, this.minor, this.patch] = parts;
    } else if (
      typeof majorOrVersion === 'number' &&
      typeof minor === 'number' &&
      typeof patch === 'number'
    ) {
      this.major = majorOrVersion;
      this.minor = minor;
      this.patch = patch;
    } else if (
      typeof majorOrVersion === 'string' &&
      typeof minor === 'string' &&
      typeof patch === 'string'
    ) {
      this.major = Number(majorOrVersion);
      this.minor = Number(minor);
      this.patch = Number(patch);
      if (isNaN(this.major) || isNaN(this.minor) || isNaN(this.patch)) {
        throw new Error('Invalid version number format');
      }
    } else {
      throw new Error('Invalid constructor arguments');
    }
  }

  get version() {
    return [this.major, this.minor, this.patch].join('.');
  }

  toString(prefix: string = '', date: Date | null | string = new Date()) {
    return [`${prefix}${this.version}`, date ? ` - ${format(date)}` : ''].join(
      ''
    );
  }

  nextVersion(versionBumpType: 'major' | 'minor' | 'patch' = 'patch') {
    switch (versionBumpType) {
      case 'major':
        return new Version(this.major + 1, 0, 0);

      case 'minor':
        return new Version(this.major, this.minor + 1, 0);

      case 'patch':
        return new Version(this.major, this.minor, this.patch + 1);

      default:
        return this;
    }
  }

  static parse(rawVersion: string, prefix = '') {
    const versionRegex = new RegExp(
      `^${versionHeader}${prefix}(?<version>\\d+\\.\\d+\\.\\d+)`
    );
    const { version } = rawVersion.match(versionRegex)?.groups!;
    return new Version(version);
  }
}
