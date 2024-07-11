import { Argv } from 'mri';
import { resolve } from 'path';
import { Changelog } from './lib/Changelog';
import { Commit } from './lib/Commit';
import { Git } from './lib/Git';
import { PackageJson } from './lib/PackageJson';
import { readConfig } from './lib/utils';
import { ChangelogerRuntimeConfig } from './types';

export default async function main(argv: Argv) {
  const startTime = performance.now();
  const path = resolve((argv as any)._[0] ?? process.cwd());
  const config = await readConfig({ path });
  const packageJson = new PackageJson(path);
  await packageJson.load();
  const git = new Git(path, config, packageJson);
  await git.load();
  const runtimeConfig: ChangelogerRuntimeConfig = {
    ...config,
    branch: git.currentBranch,
    repositoryUrl: git.repositoryUrl,
    ...argv,
    path,
  };
  const changelog = new Changelog(runtimeConfig, packageJson, git);
  try {
    await changelog.load();
    const range = [
      runtimeConfig.fromCommit ?? changelog.latestCommit,
      runtimeConfig.toCommit ?? 'HEAD',
    ];
    const mergesLog = await git.mergesLog({ range });
    const mergesLogHashes = mergesLog
      .filter((log) => !log.isPullRequest)
      .map((log) => log.hash);
    const mergedHashes = mergesLog
      .filter((log) => log.isPullRequest)
      .flatMap((log) => log.commits);
    const logs = await git.prettyLog({
      range,
      option: `--invert-grep --grep='^chore(release):'`,
    });
    const filteredMergesLogs = logs.filter(
      (log) => !mergesLogHashes.includes(log.hash)
    );
    const commits = runtimeConfig.pullRequestOnly
      ? filteredMergesLogs.filter((log) => log.isPullRequest)
      : filteredMergesLogs.filter((log) => !mergedHashes.includes(log.hash));
    const changelogCommits = commits.map(
      (commit) => new Commit(commit, git.provider)
    );
    if (changelogCommits.length) {
      const nextVersion = changelog.nextVersion.toString('', null);
      const nextTag = changelog.nextVersion.toString(
        runtimeConfig.versionPrefix,
        null
      );
      console.log(
        '\n',
        runtimeConfig.noTag
          ? '\x1b[33m\x1b[1m🚀 Start generating changelog for\x1b[0m'
          : '\x1b[33m\x1b[1m🚀 Start release\x1b[0m',
        `\x1b[33m\x1b[1m${nextTag}\x1b[0m`
      );
      if (runtimeConfig.clean && !runtimeConfig.noCommit) {
        const isGitClean = await git.isClean();
        if (!isGitClean) {
          throw new Error(
            'You have unstaged changes. Please commit or stash them.'
          );
        }
      }
      await changelog.writeChanges(changelogCommits);
      if (!runtimeConfig.noPackageJson && runtimeConfig.bump) {
        await packageJson.bumpVersion(nextVersion);
      }
      if (!runtimeConfig.noCommit) {
        await git.add(['-A']);
        const messageTemplate = runtimeConfig.releaseCommitMessage;
        const commitMessage = messageTemplate.replace(/\{version\}/g, nextTag);
        await git.commit(commitMessage);
      }
      if (!runtimeConfig.noTag) {
        await git.tag(nextTag);
      }
    } else {
      console.log('\x1b[33mNo changes found!\x1b[0m');
    }
    const execTime = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\x1b[32m✨ Done in ${execTime}s\x1b[0m`);
  } catch (error) {
    if (
      !changelog.fullContent ||
      changelog.fullContent?.trim() === Changelog.placeholder
    ) {
      await changelog.delete();
    }
    throw error;
  }
}
