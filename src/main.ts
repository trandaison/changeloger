import { promises as fs } from 'fs';
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
  const __debugData: any = {};
  const path = resolve((argv as any)._[0] ?? process.cwd());
  const config = await readConfig({ path });
  __debugData.config = config;
  const packageJson = new PackageJson(path);
  await packageJson.load();
  __debugData.packageJson = packageJson.value;
  const git = new Git(path, config, packageJson);
  await git.load();
  __debugData.git = git;
  const runtimeConfig: ChangelogerRuntimeConfig = {
    ...config,
    branch: git.currentBranch,
    repositoryUrl: git.repositoryUrl,
    ...argv,
    bump: !argv.noBump,
    commit: !argv.noCommit,
    tag: !argv.noTag,
    push: !argv.noPush,
    path,
  };
  __debugData.runtimeConfig = runtimeConfig;
  const changelog = new Changelog(runtimeConfig, packageJson, git);
  try {
    await changelog.load();
    __debugData.changelog = changelog;
    const range = [
      runtimeConfig.fromCommit ?? changelog.latestCommit,
      runtimeConfig.toCommit ?? 'HEAD',
    ];
    const mergesLog = await git.mergesLog({ range });
    __debugData.mergesLog = mergesLog;
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
    __debugData.logs = logs;
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
        '\n🚀',
        runtimeConfig.tag
          ? '\x1b[33m\x1b[1mStart release\x1b[0m'
          : '\x1b[33m\x1b[1mStart generating changelog for\x1b[0m',
        `\x1b[33m\x1b[1m${nextTag}\x1b[0m`
      );
      if (runtimeConfig.clean && runtimeConfig.commit) {
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
      if (runtimeConfig.commit) {
        await git.add(['-A']);
        const messageTemplate = runtimeConfig.releaseCommitMessage;
        const commitMessage = messageTemplate.replace(/\{version\}/g, nextTag);
        await git.commit(commitMessage);
      }
      if (runtimeConfig.tag) {
        await git.tag(nextTag);

        if (runtimeConfig.push) {
          console.log('\x1b[33m\x1b[1m👉 Pushing tag...\x1b[0m');
          const pushLog = await git.push('HEAD', '--follow-tags');
          console.log(pushLog);
        }
      }
    } else {
      console.log('\x1b[33mNo changes found!\x1b[0m');
    }
    const execTime = ((performance.now() - startTime) / 1000).toFixed(2);
    const message = changelog.prevVersion
      ? `\x1b[32m\x1b[1m${changelog.fileName}\x1b[0m\x1b[32m has been updated successfully!\x1b[0m`
      : `\x1b[32m\x1b[1m${changelog.fileName}\x1b[0m\x1b[32m has been created successfully!\x1b[0m`;
    console.log('✨', message, '\n');
    console.log(`✔ Done in ${execTime}s`);
  } catch (error) {
    if (
      !changelog.fullContent ||
      changelog.fullContent?.trim() === Changelog.placeholder
    ) {
      await changelog.delete();
    }
    throw error;
  } finally {
    if (argv.debug === 'inline') {
      console.log('\n\x1b[33m\x1b[1m=== Debug data: ===\x1b[0m');
      console.log(__debugData);
    } else if (argv.debug) {
      const debugFile = resolve(path, 'changeloger.debug.json');
      await fs.writeFile(debugFile, JSON.stringify(__debugData, null, 2));
      console.log(
        `\n\x1b[33m\x1b[1mDebug data has been saved to ${debugFile}\x1b[0m`
      );
    }
  }
}
