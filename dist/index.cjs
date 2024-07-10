'use strict';

var path = require('path');
var fs = require('fs');
var url = require('url');
var childProcess = require('child_process');

class Version {
    major;
    minor;
    patch;
    constructor(majorOrVersion, minor, patch) {
        if (typeof majorOrVersion === 'string' &&
            minor === undefined &&
            patch === undefined) {
            const parts = majorOrVersion.split('.').map(Number);
            if (parts.length !== 3 || parts.some(isNaN)) {
                throw new Error(`Invalid version string format: ${JSON.stringify({
                    majorOrVersion,
                    minor,
                    patch,
                })}}`);
            }
            [this.major, this.minor, this.patch] = parts;
        }
        else if (typeof majorOrVersion === 'number' &&
            typeof minor === 'number' &&
            typeof patch === 'number') {
            this.major = majorOrVersion;
            this.minor = minor;
            this.patch = patch;
        }
        else if (typeof majorOrVersion === 'string' &&
            typeof minor === 'string' &&
            typeof patch === 'string') {
            this.major = Number(majorOrVersion);
            this.minor = Number(minor);
            this.patch = Number(patch);
            if (isNaN(this.major) || isNaN(this.minor) || isNaN(this.patch)) {
                throw new Error('Invalid version number format');
            }
        }
        else {
            throw new Error('Invalid constructor arguments');
        }
    }
    get version() {
        return [this.major, this.minor, this.patch].join('.');
    }
    toString(prefix = '') {
        return `${prefix}${this.version}`;
    }
    nextVersion(versionBumpType = 'patch') {
        switch (versionBumpType) {
            case 'major':
                return new Version(this.major + 1, 0, 0);
            case 'minor':
                return new Version(this.major, this.minor + 1, 0);
            case 'patch':
                return new Version(this.major, this.minor, this.patch + 1);
            default:
                return this;
        }
    }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) {
    return false;
  }
  if (Symbol.iterator in value) {
    return false;
  }
  if (Symbol.toStringTag in value) {
    return Object.prototype.toString.call(value) === "[object Module]";
  }
  return true;
}

function _defu(baseObject, defaults, namespace = ".", merger) {
  if (!isPlainObject(defaults)) {
    return _defu(baseObject, {}, namespace, merger);
  }
  const object = Object.assign({}, defaults);
  for (const key in baseObject) {
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = baseObject[key];
    if (value === null || value === void 0) {
      continue;
    }
    if (merger && merger(object, key, value, namespace)) {
      continue;
    }
    if (Array.isArray(value) && Array.isArray(object[key])) {
      object[key] = [...value, ...object[key]];
    } else if (isPlainObject(value) && isPlainObject(object[key])) {
      object[key] = _defu(
        value,
        object[key],
        (namespace ? `${namespace}.` : "") + key.toString(),
        merger
      );
    } else {
      object[key] = value;
    }
  }
  return object;
}
function createDefu(merger) {
  return (...arguments_) => (
    // eslint-disable-next-line unicorn/no-array-reduce
    arguments_.reduce((p, c) => _defu(p, c, "", merger), {})
  );
}
const defu = createDefu();

const configFileNames = [
    'changeloger.config.js',
    'changeloger.config.json',
    'changeloger.config.ts',
    'changeloger.config.tsx',
    'changeloger.config.mjs',
    'changeloger.config.cjs',
];
const defaultConfig = {
    provider: null,
    header: '# Changelog',
    fileName: 'CHANGELOG-{branch}.md',
    versionPrefix: 'v',
    versionBumpType: 'patch',
    startVersion: '0.0.0',
    pullRequestOnly: false,
};
function getPullRequestRegex(provider) {
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

async function fileExists(path) {
    try {
        await fs.promises.access(path);
        return true;
    }
    catch (error) {
        return false;
    }
}
async function readConfig({ path = process.cwd(), } = {}) {
    const config = await readConfigFile({ path });
    return defu(config ?? {}, defaultConfig);
}
async function readConfigFile({ path: path$1 = process.cwd(), configFile, } = {}) {
    const configFileNames$1 = configFile ? [configFile] : configFileNames;
    for (const fileName of configFileNames$1) {
        const filePath = path.resolve(path$1, fileName);
        if (await fileExists(filePath)) {
            if (fileName.endsWith('.json')) {
                const content = await fs.promises.readFile(filePath, 'utf-8');
                return JSON.parse(content.toString());
            }
            else if (fileName.endsWith('.js') || fileName.endsWith('.cjs')) {
                return require(filePath);
            }
            else if (fileName.endsWith('.ts') ||
                fileName.endsWith('.mjs') ||
                fileName.endsWith('.tsx')) {
                const configModule = await import(url.pathToFileURL(filePath).href);
                return configModule.default || configModule;
            }
        }
    }
    return Promise.resolve(null);
}

function pullRequestUrl(number, provider, repositoryUrl) {
    if (!repositoryUrl || !number)
        return '';
    switch (provider) {
        case 'github':
            return `${repositoryUrl}/pull/${number}`;
        case 'bitbucket':
            return `${repositoryUrl}/pull-requests/${number}`;
        case 'gitlab':
            return `${repositoryUrl}/merge_requests/${number}`;
        default:
            return '';
    }
}
function commitUrl(hash, provider, repositoryUrl) {
    if (!repositoryUrl)
        return '';
    switch (provider) {
        case 'github':
            return `${repositoryUrl}/commit/${hash}`;
        case 'bitbucket':
            return `${repositoryUrl}/commits/${hash}`;
        case 'gitlab':
            return `${repositoryUrl}/-/commit/${hash}`;
        default:
            return '';
    }
}
function compareUrl(prevVersion, nextVersion, provider, repositoryUrl) {
    if (!(repositoryUrl && prevVersion))
        return '';
    switch (provider) {
        case 'github':
        case 'gitlab':
            return `${repositoryUrl}/compare/${prevVersion}...${nextVersion}`;
        case 'bitbucket':
            return `${repositoryUrl}/branches/compare/${prevVersion}..${nextVersion}`;
        // return `${repositoryUrl}/-/compare?${commitA}...${commitB}`;
        default:
            return '';
    }
}
function toRepoUrl(url, provider) {
    if (url.startsWith('http')) {
        return url.replace(/\.git$/, '');
    }
    if (url.startsWith('git@')) {
        const regex = /git@.+:(?<username>[a-zA-Z0-9-_]+)\/(?<repository>[a-zA-Z0-9-_]+).git/;
        const { username, repository } = url.match(regex)?.groups ?? {};
        const _provider = guessProvider(url);
        if (!_provider)
            return null;
        return `https://${_provider}.com/${username}/${repository}`;
    }
    return null;
}
function guessProvider(url) {
    if (url.includes('github'))
        return 'github';
    if (url.includes('gitlab'))
        return 'gitlab';
    if (url.includes('bitbucket'))
        return 'bitbucket';
    return null;
}

// import { Release } from '../utils/Release';
class Changelog {
    runtimeConfig;
    packageJson;
    git;
    static placeholder = '<!-- Generating... -->';
    static versionHeader = '## ';
    fullContent;
    latestCommit;
    constructor(runtimeConfig, packageJson, git) {
        this.runtimeConfig = runtimeConfig;
        this.packageJson = packageJson;
        this.git = git;
    }
    async load() {
        if (await fileExists(this.changelogFilePath)) {
            this.fullContent = await fs.promises.readFile(this.changelogFilePath, 'utf8');
        }
        else {
            this.fullContent = '';
            await fs.promises.writeFile(this.changelogFilePath, Changelog.placeholder);
        }
        // const releases = Release.parse(this.content, this.runtimeConfig);
        // releases.forEach((release) => console.log(release.toString()));
        await this.updateLatestCommit();
    }
    get changelogFilePath() {
        const fileName = this.runtimeConfig.fileName.replace(/\{branch\}/g, this.runtimeConfig.branch ?? '');
        return path.resolve(this.runtimeConfig.path, fileName);
    }
    get content() {
        if (!this.fullContent)
            return '';
        return Changelog.removeHeader(this.fullContent);
    }
    get latestVersion() {
        const versionPrefix = `${Changelog.versionHeader}${this.runtimeConfig.versionPrefix}`;
        const currentVer = this.lines[1]?.trim() ||
            `${versionPrefix}${this.runtimeConfig.startVersion}`;
        return new Version(currentVer.replace(versionPrefix, ''));
    }
    get prevVersion() {
        const versionPrefix = `${Changelog.versionHeader}${this.runtimeConfig.versionPrefix}`;
        const currentVer = this.lines[1]?.trim();
        return currentVer
            ? new Version(currentVer.replace(versionPrefix, ''))
            : null;
    }
    get nextVersion() {
        let versionBumpType = this.runtimeConfig.versionBumpType;
        if (this.runtimeConfig.major)
            versionBumpType = 'major';
        if (this.runtimeConfig.minor)
            versionBumpType = 'minor';
        if (this.runtimeConfig.patch)
            versionBumpType = 'patch';
        return this.latestVersion.nextVersion(versionBumpType);
    }
    get latestCompareChangesUrl() {
        return (this.lines[3] ?? '')
            .replace('[compare changes](', '')
            .replace(')', '');
    }
    get entries() {
        if (!this.content)
            return [];
        // TODO: Implement this
        return [];
    }
    async updateLatestCommit() {
        this.latestCommit = this.prevVersion
            ? await this.git.versionToCommitHash(this.prevVersion.toString(this.runtimeConfig.versionPrefix))
            : null;
    }
    async writeChanges(commits) {
        if (!commits.length)
            return this.load();
        const compareChangesUrl = compareUrl(this.prevVersion?.toString(this.runtimeConfig.versionPrefix) ?? null, this.nextVersion.toString(this.runtimeConfig.versionPrefix), this.runtimeConfig.provider, this.git.repositoryUrl);
        const compareChangesLink = compareChangesUrl
            ? `[compare changes](${compareChangesUrl})`
            : '';
        const commitEntries = await this.commitsToEntries(commits);
        let newContent = [
            this.runtimeConfig.header,
            this.nextVersion.toString(`${Changelog.versionHeader}${this.runtimeConfig.versionPrefix}`),
            ...(compareChangesLink ? [compareChangesLink] : []),
            commitEntries.join('\n'),
        ].join('\n\n');
        newContent += this.content ? '\n\n' + this.content : '\n';
        await fs.promises.writeFile(this.changelogFilePath, newContent);
        return this.load();
    }
    delete() {
        return fs.promises.unlink(this.changelogFilePath);
    }
    get lines() {
        return this.content?.split('\n') || [];
    }
    static removeHeader(content) {
        return content.split('\n').slice(1).join('\n');
    }
    commitsToEntries(commits) {
        return Promise.all(commits.map((commit) => commit.toChangelogEntry(this.git.repositoryUrl)));
    }
}

class Commit {
    provider;
    hash;
    message;
    body;
    date;
    branch;
    authorName;
    authorEmail;
    refs;
    parentHashes;
    isPullRequest = false;
    commits = null;
    constructor(attrs, provider = null) {
        this.provider = provider;
        Object.assign(this, { ...attrs, date: new Date(attrs.date) });
    }
    get pullRequestNo() {
        if (!this.isPullRequest)
            return null;
        if (this.provider === 'bitbucket') {
            const { pullRequestNo } = this.message.match(/Merged in (?<branch>.+) \(pull request #(?<pullRequestNo>\d+)\)/)?.groups;
            return Number(pullRequestNo);
        }
        return null;
    }
    toChangelogEntry(repositoryUrl) {
        return this.isPullRequest
            ? this.pullRequestEntry(repositoryUrl)
            : this.commitEntry(repositoryUrl);
    }
    commitEntry(repositoryUrl) {
        const commitLink = `[\`${this.hash}\`](${commitUrl(this.hash, this.provider, repositoryUrl)})`;
        return `- ${this.message} (${commitLink})`;
    }
    pullRequestEntry(repositoryUrl) {
        const prUrl = pullRequestUrl(this.pullRequestNo, this.provider, repositoryUrl);
        const prLink = prUrl ? ` ([#${this.pullRequestNo}](${prUrl}))` : '';
        const commitLinks = (this.commits ?? []).map((commitHash) => {
            const commitId = commitHash.substring(0, 7);
            return `[\`${commitId}\`](${commitUrl(commitId, this.provider, repositoryUrl)})`;
        });
        return `- ${this.isPullRequest ? this.body : this.message}${prLink} (${commitLinks.join(', ')})`;
    }
}

const { exec } = childProcess;
class Git {
    path;
    config;
    packageJson;
    static prettyLogOption = `--pretty=format:'{"hash":"%h", "authorName":"%an", "authorEmail":"%ae", "date":"%aI", "message":"%s", "body":"%b", "refs":"%D", "parentHashes":"%p"}'`;
    repositoryUrl;
    currentBranch;
    provider;
    constructor(path = process.cwd(), config, packageJson) {
        this.path = path;
        this.config = config;
        this.packageJson = packageJson;
    }
    async load() {
        await this.status();
        this.repositoryUrl =
            this.packageJson.value.repository?.url ?? (await this.remote());
        this.currentBranch = await this.branch();
        this.provider =
            this.config.provider ?? guessProvider(this.repositoryUrl ?? '');
    }
    status() {
        return new Promise((resolve, reject) => {
            exec(`git -C ${this.path} status`, (error, stdout, stderr) => {
                if (error || stderr)
                    return reject(error);
                resolve(stdout);
            });
        });
    }
    log({ range = [], option = '' } = {}) {
        const [fromCommit, toCommit = 'HEAD'] = range;
        const queryRange = fromCommit ? `${fromCommit}..${toCommit}` : '';
        const command = `git -C ${this.path} log ${queryRange} ${option}`.trim();
        return new Promise((resolve, reject) => {
            exec(command, (error, log, stderr) => {
                if (error || stderr)
                    return reject(error);
                const regex = /(^|\n)(?=commit\s[0-9a-f]{40}\n)/g;
                const logs = log
                    .split(regex)
                    .filter(Boolean)
                    .map((entry) => entry.trim());
                resolve(logs);
            });
        });
    }
    prettyLog({ option = '', range = [], } = {}) {
        const command = `git -C ${this.path} log ${Git.rangeToOption(range)} ${Git.prettyLogOption} ${option} | sed -e ':a' -e 'N' -e '$!ba' -e 's/}\\n{/}, {/g' -e 's/\\n/\\\\n/g'`.trim();
        return new Promise((resolve, reject) => {
            exec(command, async (error, log, stderr) => {
                if (error || stderr)
                    return reject(error);
                const json = JSON.parse(`[${log}]`);
                const logs = await Promise.all(json.map(async (entry) => {
                    const refs = entry.refs
                        .split(',')
                        .map((ref) => ref.trim())
                        .filter(Boolean);
                    const branch = refs.find((ref) => ref.startsWith('origin/'));
                    const parentHashes = entry.parentHashes
                        .split(' ')
                        .map((ref) => ref.trim())
                        .filter(Boolean);
                    const isPullRequest = getPullRequestRegex(this.config.provider).test(entry.message);
                    let commits = null;
                    if (isPullRequest) {
                        const [sinceCommit, headCommit] = parentHashes;
                        commits = (await this.revList({ sinceCommit, headCommit })).map((c) => c.substring(0, 7));
                    }
                    return {
                        ...entry,
                        body: entry.body.trim(),
                        refs,
                        branch: branch?.replace('origin/', '') ?? null,
                        parentHashes,
                        commits,
                        isPullRequest,
                    };
                }));
                resolve(logs);
            });
        });
    }
    async mergesLog({ range = [] } = {}) {
        const [a, b] = range;
        if (b && b.toUpperCase() !== 'HEAD' && !a)
            throw new Error('fromCommit is required when toCommit is set');
        const logs = await this.prettyLog({ range, option: '--merges' });
        return await Promise.all(logs.map(async (log) => {
            const isPullRequest = getPullRequestRegex(this.config.provider).test(log.message);
            const [sinceCommit, headCommit] = log.parentHashes;
            const commits = (await this.revList({ sinceCommit, headCommit })).map((c) => c.substring(0, 7)) ?? null;
            return {
                ...log,
                isPullRequest,
                commits,
            };
        }));
    }
    pullRequestUrl(prNo, repositoryUrl) { }
    remote() {
        return new Promise((resolve, reject) => {
            exec(`git -C ${this.path} remote -v`, (error, stdout, stderr) => {
                if (error || stderr)
                    return reject(error);
                const [firstEntry] = stdout.split('\n').filter(Boolean);
                const remote = firstEntry?.split('\t')[1]?.split(' ')[0];
                if (!remote)
                    return resolve(null);
                resolve(toRepoUrl(remote));
            });
        });
    }
    branch() {
        return new Promise((resolve, reject) => {
            exec(`git -C ${this.path} branch --show-current`, (error, stdout, stderr) => {
                if (error || stderr)
                    return reject(error);
                resolve(stdout.trim());
            });
        });
    }
    revList({ sinceCommit, headCommit = 'HEAD', }) {
        return new Promise((resolve, reject) => {
            exec(`git -C ${this.path} rev-list ${sinceCommit}..${headCommit}`, (error, stdout, stderr) => {
                if (error || stderr)
                    return reject(error);
                resolve(stdout.split('\n').filter(Boolean));
            });
        });
    }
    versionToCommitHash(version) {
        const command = `git -C ${this.path} show ${version} --pretty=format:%h`;
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error || stderr)
                    return reject(error);
                resolve(stdout.split('\n')[5]?.trim() || null);
            });
        });
    }
    static rangeToOption(range) {
        const [fromCommit, toCommit = 'HEAD'] = range;
        return fromCommit ? `${fromCommit}..${toCommit}` : '';
    }
}

class PackageJson {
    path;
    filePath;
    value;
    constructor(path$1 = process.cwd()) {
        this.path = path$1;
        this.filePath = path.resolve(path$1, 'package.json');
    }
    get version() {
        return new Version(this.value.version ?? '0.0.0');
    }
    async load() {
        const content = await fs.promises.readFile(this.filePath, 'utf-8');
        this.value = JSON.parse(content.toString());
        return this.value;
    }
}

async function main(argv) {
    const path$1 = path.resolve(argv._[0] ?? process.cwd());
    const config = await readConfig({ path: path$1 });
    const packageJson = new PackageJson(path$1);
    await packageJson.load();
    const git = new Git(path$1, config, packageJson);
    await git.load();
    const runtimeConfig = {
        ...config,
        branch: git.currentBranch,
        repositoryUrl: git.repositoryUrl,
        ...argv,
        path: path$1,
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
        const filteredMergesLogs = logs.filter((log) => !mergesLogHashes.includes(log.hash));
        const commits = runtimeConfig.pullRequestOnly
            ? filteredMergesLogs.filter((log) => log.isPullRequest)
            : filteredMergesLogs.filter((log) => !mergedHashes.includes(log.hash));
        const changelogCommits = commits.map((commit) => new Commit(commit, git.provider));
        if (changelogCommits.length) {
            await changelog.writeChanges(changelogCommits);
        }
        else {
            console.log('No changes found!');
        }
    }
    catch (error) {
        if (!changelog.fullContent ||
            changelog.fullContent?.trim() === Changelog.placeholder) {
            await changelog.delete();
        }
        throw error;
    }
}

module.exports = main;
