import { Argv } from 'mri';
import { resolve } from 'path';
import { Changelog } from './lib/Changelog';
import { Commit } from './lib/Commit';
import { Git } from './lib/Git';
import { PackageJson } from './lib/PackageJson';
import { readConfig } from './lib/utils';
import { ChangelogerRuntimeConfig } from './types';

export default async function main(argv: Argv) {
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
      await changelog.writeChanges(changelogCommits);
    } else {
      console.log('No changes found!');
    }
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
