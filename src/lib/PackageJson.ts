import { promises as fs } from 'fs';
import { resolve } from 'path';
import childProcess from 'child_process';
import { Version } from './Version';

const { exec } = childProcess;

export class PackageJson {
  public filePath!: string;
  public value!: any;
  public fileExists!: boolean;

  constructor(public path: string = process.cwd()) {
    this.filePath = resolve(path, 'package.json');
  }

  get version() {
    return new Version(this.value.version ?? '0.0.0');
  }

  async load() {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.value = JSON.parse(content.toString());
      return this.value;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        this.fileExists = false;
        this.value = {};
        return this.value;
      }
      throw error;
    }
  }

  bumpVersion(newVersion: Version | string) {
    return new Promise<string | null>((resolve, reject) => {
      exec(
        `npm --prefix ${this.path} --no-git-tag-version version ${newVersion}`,
        (error: any, stdout: any, stderr: any) => {
          if (error || stderr) return reject(error);

          resolve(stdout);
        }
      );
    });
  }
}
