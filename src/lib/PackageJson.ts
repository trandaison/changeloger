import { promises as fs } from 'fs';
import { resolve } from 'path';
import { Version } from './Version';

export class PackageJson {
  public filePath!: string;
  public value!: any;

  constructor(public path: string = process.cwd()) {
    this.filePath = resolve(path, 'package.json');
  }

  get version() {
    return new Version(this.value.version ?? '0.0.0');
  }

  async load() {
    const content = await fs.readFile(this.filePath, 'utf-8');
    this.value = JSON.parse(content.toString());
    return this.value;
  }
}
