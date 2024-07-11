import { ChangelogerConfig, ChangelogerProvider } from '../types';

export const configFileNames = [
  'changeloger.config.js',
  'changeloger.config.json',
  'changeloger.config.ts',
  'changeloger.config.tsx',
  'changeloger.config.mjs',
  'changeloger.config.cjs',
];

export const versionHeader = '## ';

export const defaultConfig: ChangelogerConfig = {
  provider: null,
  header: '# Changelog',
  fileName: 'CHANGELOG.md', // CHANGELOG-{branch}.md
  versionPrefix: 'v',
  versionBumpType: 'patch',
  startVersion: '0.0.0',
  pullRequestOnly: false,
};

export function getPullRequestRegex(provider: ChangelogerProvider | null) {
  switch (provider) {
    case 'github':
      return /Merge pull request #\d+ from .+\n/;
    case 'bitbucket':
      return /Merged in .+ \(pull request #\d+\)/;
    case 'gitlab':
      return /Merge branch '.+' into '.+'\n/;
    default:
      return /commit [0-9a-f]{40}\n/;
  }
}
