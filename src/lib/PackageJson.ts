import { promises as fs } from 'fs';
import { resolve } from 'path';
import { Version } from './Version';

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

  bumpVersion(version: Version | string) {
    this.value.version = version.toString();
    return this.wirte();
  }

  async wirte() {
    if (!this.fileExists) return;

    await fs.writeFile(
      this.filePath,
      JSON.stringify(this.value, null, 2),
      'utf-8'
    );
  }
}
