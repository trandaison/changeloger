# Changeloger

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![Codecov][codecov-src]][codecov-href]
[![License][license-src]][license-href]

**A fast and lightweight changelog generator using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)**.

Support several providers (GitHub, Bitbucket, GitLab, and Git) and multiple output files.

## Quick Start

Generate a changelog, without bumping the version or making a git commit:

```sh
npx @trandaison/changeloger@latest --noBump --noCommit --noTag
```

Bump the version, update `CHANGELOG.md` and make a git commit and tag:

```sh
npx @trandaison/changeloger@latest
```

## CLI usage

You can choose to install `@trandaison/changeloger` globally, or install it as a devDependency in your project,  or use `npx` to run it.

```sh
npm install -g @trandaison/changeloger
```

```sh
npm install --save-dev @trandaison/changeloger
```

```sh
npx @trandaison/changeloger@latest
```

**CLI command:**
```sh
npx changelogen@latest [path] [...args]
```

**Arguments:**
- `path`: The path to the project directory. Default: `process.cwd()` (current working directory).
- `--repositoryUrl`: The URL of the repository. By default, it will be read from the `package.json` file, or guessed from the remote git repository. If it can't be guessed, it will be `null`.
- `--branch`: The branch name. Default is the current branch.
- `--major`: Bump as a semver-major version.
- `--minor`: Bump as a semver-minor version.
- `--patch`: Bump as a semver-patch version.
- `--fromCommit`: Start commit reference. When not provided, latest git tag will be used as default.
- `--toCommit`: End commit reference. When not provided, latest commit in HEAD will be used as default.
- `--date`: The date of the release. Default is the current date. Format: `YYYY-MM-DD`.
- `--noBump`: Do not bump the version in `package.json`.
- `--noCommit`: Do not make a git commit.
- `--noTag`: Do not make a git tag.
- `--noPush`: Do not push the commit and the new tag to the remote git repository.
- And all others options available in [changelog.config.json](#changelog.config) are also available as CLI arguments. The CLI arguments will override the options in the config file.

## Configuration

You can use either `changelog.config.json` or `changelog.config.{ts,tsx,js,mjs,cjs}` to configure the changelog generation.

Available options and defaults:

| Option | Type | Description | Default |
| --- | --- | --- | --- |
| `provider` | `'github' \| 'bitbucket' \| 'gitlab' \| 'git' \| null` | The provider of the repository. | `null` |
| `header` | `string` | The header of the changelog. | `'# Changelog'` |
| `output` | `string` | The path to the output file. You can create multiple changelog files (for multiple branch or multiple environment) by using the placeholder `{branch}` (e.g. `CHANGELOG-{branch}.md`). | `'CHANGELOG.md'` |
| `versionPrefix` | `string` | The prefix of the version. | `'v'` |
| `versionBumpType` | `'major' \| 'minor' \| 'patch'` | The type of the version bump. | `patch` |
| `startVersion` | `string` | The start version. | `0.0.0` |
| `pullRequestOnly` | `boolean` | Only include pull requests in the changelog file. | `false` |
| `order` | `CommitType[]` | The order of each section in the changelog. | `['feat', 'perf', 'fix', 'refactor', 'docs', 'chore', 'test', 'style', 'revert']` |
| `typeTitle` | `Record<CommitType \| 'other', string>` | The title of each section in the changelog. | `{ feat: '🚀 Features', perf: '⚡️ Performance', fix: '🩹 Bug Fixes', refactor: '💅 Refactors', docs: '📖 Documentation', chore: '🏡 Chores', test: '✅ Tests', style: '✨ Styles', revert: '🔀 Reverts', other: '❓ Unclassified' }` |
| `noPackageJson` | `boolean` | Do not read the `package.json` file. Use this option when you don't have a `package.json` file in your project. | `false` |
| `clean` | `boolean` | Determine if the working directory is clean and if it is not clean, exit. | `true` |
| `releaseCommitMessage` | `string` | The commit message for the release. Placeholder `{version}` will be replaced with the new version. | `'chore(release): {version}'` |
| `bump` | `boolean` | Bump the version in `package.json`. This option will be ignored if `--noBump` is provided in the CLI arguments. | `true` |
| `commit` | `boolean` | Make a git commit. This option will be ignored if `--noCommit` is provided in the CLI arguments. | `true` |
| `tag` | `boolean` | Make a git tag. This option will be ignored if `--noTag` is provided in the CLI arguments. | `true` |
| `push` | `boolean` | Push the commit and the new tag to the remote git repository. This option will be ignored if `--noPush` is provided in the CLI arguments. | `true` |
| `remote` | `string` | The name of the remote git repository in case there are multiple remotes or the remote name is not `origin`. | `'origin'` |

See [`./src/config/index.ts`](./src/config/index.ts#L26-L65) for the full list of available options and their defaults.

## 💻 Development

- Clone the repository
- Make sure you are using node >= v18.16
- Install the dependencies: `npm install`
- Run the dev script `npm run dev` or `npm run test` to test the build (it requires to run `npm run build` first)

## Support

If you find this project useful, you can support its development by buying me a coffee:

[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/yellow_img.png)](https://buymeacoffee.com/trandaison)


## License

Made with ❤️ by [trandaison](https://github.com/trandaison)

Licensed under the [MIT License](./LICENSE).

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@trandaison/changeloger?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/@trandaison/changeloger
[npm-downloads-src]: https://img.shields.io/npm/dm/@trandaison/changeloger?style=flat&colorA=18181B&colorB=F0DB4F
[npm-downloads-href]: https://npmjs.com/package/@trandaison/changeloger
[codecov-src]: https://img.shields.io/codecov/c/gh/trandaison/changeloger/main?style=flat&colorA=18181B&colorB=F0DB4F
[codecov-href]: https://codecov.io/gh/trandaison/changeloger
[license-src]: https://img.shields.io/github/license/trandaison/changeloger.svg?style=flat&colorA=18181B&colorB=F0DB4F
[license-href]: https://github.com/trandaison/changeloger/blob/main/LICENSE
