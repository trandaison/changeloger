import defu from 'defu';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { ChangelogerConfig } from '../../types';
import {
  defaultConfig,
  configFileNames as defaultConfigFileNames,
} from '../../config';

export async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch (error) {
    return false;
  }
}

export async function readConfig({
  path = process.cwd(),
}: { path?: string } = {}): Promise<ChangelogerConfig> {
  const config = await readConfigFile({ path });
  return defu(config ?? {}, defaultConfig);
}

export async function readConfigFile({
  path = process.cwd(),
  configFile,
}: {
  path?: string;
  configFile?: string;
} = {}): Promise<ChangelogerConfig | null> {
  const configFileNames = configFile ? [configFile] : defaultConfigFileNames;
  for (const fileName of configFileNames) {
    const filePath = resolve(path, fileName);
    if (await fileExists(filePath)) {
      if (fileName.endsWith('.json')) {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content.toString());
      } else if (fileName.endsWith('.js') || fileName.endsWith('.cjs')) {
        return require(filePath);
      } else if (
        fileName.endsWith('.ts') ||
        fileName.endsWith('.mjs') ||
        fileName.endsWith('.tsx')
      ) {
        const configModule = await import(pathToFileURL(filePath).href);
        return configModule.default || configModule;
      }
    }
  }

  return Promise.resolve(null);
}
