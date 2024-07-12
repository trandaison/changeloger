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

export enum CommitType {
  feat = 'feat',
  perf = 'perf',
  fix = 'fix',
  refactor = 'refactor',
  docs = 'docs',
  chore = 'chore',
  test = 'test',
  style = 'style',
  revert = 'revert',
}

export const defaultConfig: ChangelogerConfig = {
  provider: null,
  header: '# Changelog',
  output: 'CHANGELOG.md', // CHANGELOG-{branch}.md
  versionPrefix: 'v',
  versionBumpType: 'patch',
  startVersion: '0.0.0',
  pullRequestOnly: false,
  order: [
    CommitType.feat,
    CommitType.perf,
    CommitType.fix,
    CommitType.refactor,
    CommitType.docs,
    CommitType.chore,
    CommitType.test,
    CommitType.style,
    CommitType.revert,
  ],
  typeTitle: {
    [CommitType.feat]: '🚀 Features',
    [CommitType.perf]: '⚡️ Performance',
    [CommitType.fix]: '🩹 Bug Fixes',
    [CommitType.refactor]: '💅 Refactors',
    [CommitType.docs]: '📖 Documentation',
    [CommitType.chore]: '🏡 Chores',
    [CommitType.test]: '✅ Tests',
    [CommitType.style]: '✨ Styles',
    [CommitType.revert]: '🔀 Reverts',
    other: '❓ Unclassified',
  },
  noPackageJson: false,
  clean: true,
  releaseCommitMessage: 'chore(release): {version}',
  bump: true,
  commit: true,
  tag: true,
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
