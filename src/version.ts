import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PackageJson } from './lib/PackageJson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function getVersion() {
  const path = resolve(__dirname, '..');
  const packageJson = new PackageJson(path);
  await packageJson.load();
  const version = packageJson.version.toString('', null);
  console.log('Changeloger version', version);
  return version;
}
