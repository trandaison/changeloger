#!/usr/bin/env node
import { resolve } from 'path';
import { promises } from 'fs';
import { pathToFileURL } from 'url';
import childProcess from 'child_process';

function toArr(any) {
	return any == null ? [] : Array.isArray(any) ? any : [any];
}

function toVal(out, key, val, opts) {
	var x, old=out[key], nxt=(
		!!~opts.string.indexOf(key) ? (val == null || val === true ? '' : String(val))
		: typeof val === 'boolean' ? val
		: !!~opts.boolean.indexOf(key) ? (val === 'false' ? false : val === 'true' || (out._.push((x = +val,x * 0 === 0) ? x : val),!!val))
		: (x = +val,x * 0 === 0) ? x : val
	);
	out[key] = old == null ? nxt : (Array.isArray(old) ? old.concat(nxt) : [old, nxt]);
}

function mri (args, opts) {
	args = args || [];
	opts = opts || {};

	var k, arr, arg, name, val, out={ _:[] };
	var i=0, j=0, idx=0, len=args.length;

	const alibi = opts.alias !== void 0;
	const strict = opts.unknown !== void 0;
	const defaults = opts.default !== void 0;

	opts.alias = opts.alias || {};
	opts.string = toArr(opts.string);
	opts.boolean = toArr(opts.boolean);

	if (alibi) {
		for (k in opts.alias) {
			arr = opts.alias[k] = toArr(opts.alias[k]);
			for (i=0; i < arr.length; i++) {
				(opts.alias[arr[i]] = arr.concat(k)).splice(i, 1);
			}
		}
	}

	for (i=opts.boolean.length; i-- > 0;) {
		arr = opts.alias[opts.boolean[i]] || [];
		for (j=arr.length; j-- > 0;) opts.boolean.push(arr[j]);
	}

	for (i=opts.string.length; i-- > 0;) {
		arr = opts.alias[opts.string[i]] || [];
		for (j=arr.length; j-- > 0;) opts.string.push(arr[j]);
	}

	if (defaults) {
		for (k in opts.default) {
			name = typeof opts.default[k];
			arr = opts.alias[k] = opts.alias[k] || [];
			if (opts[name] !== void 0) {
				opts[name].push(k);
				for (i=0; i < arr.length; i++) {
					opts[name].push(arr[i]);
				}
			}
		}
	}

	const keys = strict ? Object.keys(opts.alias) : [];

	for (i=0; i < len; i++) {
		arg = args[i];

		if (arg === '--') {
			out._ = out._.concat(args.slice(++i));
			break;
		}

		for (j=0; j < arg.length; j++) {
			if (arg.charCodeAt(j) !== 45) break; // "-"
		}

		if (j === 0) {
			out._.push(arg);
		} else if (arg.substring(j, j + 3) === 'no-') {
			name = arg.substring(j + 3);
			if (strict && !~keys.indexOf(name)) {
				return opts.unknown(arg);
			}
			out[name] = false;
		} else {
			for (idx=j+1; idx < arg.length; idx++) {
				if (arg.charCodeAt(idx) === 61) break; // "="
			}

			name = arg.substring(j, idx);
			val = arg.substring(++idx) || (i+1 === len || (''+args[i+1]).charCodeAt(0) === 45 || args[++i]);
			arr = (j === 2 ? [name] : name);

			for (idx=0; idx < arr.length; idx++) {
				name = arr[idx];
				if (strict && !~keys.indexOf(name)) return opts.unknown('-'.repeat(j) + name);
				toVal(out, name, (idx + 1 < arr.length) || val, opts);
			}
		}
	}

	if (defaults) {
		for (k in opts.default) {
			if (out[k] === void 0) {
				out[k] = opts.default[k];
			}
		}
	}

	if (alibi) {
		for (k in out) {
			arr = opts.alias[k] || [];
			while (arr.length > 0) {
				out[arr.shift()] = out[k];
			}
		}
	}

	return out;
}

async function start() {
    let argv = process.argv.slice(2);
    argv = mri(argv);
    Promise.resolve().then(function () { return main$1; }).then((module) => {
        module.default(argv);
    });
}
start();

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
const versionHeader = '## ';
const defaultConfig = {
    provider: null,
    header: '# Changelog',
    fileName: 'CHANGELOG.md', // CHANGELOG-{branch}.md
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
        await promises.access(path);
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
async function readConfigFile({ path = process.cwd(), configFile, } = {}) {
    const configFileNames$1 = configFile ? [configFile] : configFileNames;
    for (const fileName of configFileNames$1) {
        const filePath = resolve(path, fileName);
        if (await fileExists(filePath)) {
            if (fileName.endsWith('.json')) {
                const content = await promises.readFile(filePath, 'utf-8');
                return JSON.parse(content.toString());
            }
            else if (fileName.endsWith('.js') || fileName.endsWith('.cjs')) {
                return require(filePath);
            }
            else if (fileName.endsWith('.ts') ||
                fileName.endsWith('.mjs') ||
                fileName.endsWith('.tsx')) {
                const configModule = await import(pathToFileURL(filePath).href);
                return configModule.default || configModule;
            }
        }
    }
    return Promise.resolve(null);
}

function format(date) {
    const _date = new Date(date);
    const year = _date.getFullYear();
    const month = _date.getMonth() + 1;
    const day = _date.getDate();
    return `${year}-${month}-${day}`;
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
    toString(prefix = '', date = new Date()) {
        return [`${prefix}${this.version}`, date ? ` - ${format(date)}` : ''].join('');
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
    static parse(rawVersion, prefix = '') {
        const versionRegex = new RegExp(`^${versionHeader}${prefix}(?<version>\\d+\\.\\d+\\.\\d+)`);
        const { version } = rawVersion.match(versionRegex)?.groups;
        return new Version(version);
    }
}

// import { Release } from '../utils/Release';
class Changelog {
    runtimeConfig;
    packageJson;
    git;
    static placeholder = '<!-- Generating... -->';
    static versionHeader = versionHeader;
    fullContent;
    latestCommit;
    constructor(runtimeConfig, packageJson, git) {
        this.runtimeConfig = runtimeConfig;
        this.packageJson = packageJson;
        this.git = git;
    }
    async load() {
        if (await fileExists(this.changelogFilePath)) {
            this.fullContent = await promises.readFile(this.changelogFilePath, 'utf8');
        }
        else {
            this.fullContent = '';
            await promises.writeFile(this.changelogFilePath, Changelog.placeholder);
        }
        // const releases = Release.parse(this.content, this.runtimeConfig);
        // releases.forEach((release) => console.log(release.toString()));
        await this.updateLatestCommit();
    }
    get changelogFilePath() {
        const fileName = this.runtimeConfig.fileName.replace(/\{branch\}/g, this.runtimeConfig.branch ?? '');
        return resolve(this.runtimeConfig.path, fileName);
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
        return Version.parse(currentVer, this.runtimeConfig.versionPrefix);
    }
    get prevVersion() {
        const currentVer = this.lines[1]?.trim();
        return currentVer
            ? Version.parse(currentVer, this.runtimeConfig.versionPrefix)
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
            ? await this.git.versionToCommitHash(this.prevVersion.toString(this.runtimeConfig.versionPrefix, null))
            : null;
    }
    async writeChanges(commits) {
        if (!commits.length)
            return;
        const compareChangesUrl = compareUrl(this.prevVersion?.toString(this.runtimeConfig.versionPrefix) ?? null, this.nextVersion.toString(this.runtimeConfig.versionPrefix), this.runtimeConfig.provider, this.git.repositoryUrl);
        const compareChangesLink = compareChangesUrl
            ? `[compare changes](${compareChangesUrl})`
            : '';
        const commitEntries = await this.commitsToEntries(commits);
        let newContent = [
            this.runtimeConfig.header,
            this.nextVersion.toString(`${Changelog.versionHeader}${this.runtimeConfig.versionPrefix}`, this.runtimeConfig.date),
            ...(compareChangesLink ? [compareChangesLink] : []),
            commitEntries.join('\n'),
        ].join('\n\n');
        newContent += this.content ? '\n\n' + this.content : '\n';
        await promises.writeFile(this.changelogFilePath, newContent);
    }
    delete() {
        return promises.unlink(this.changelogFilePath);
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
    constructor(path = process.cwd()) {
        this.path = path;
        this.filePath = resolve(path, 'package.json');
    }
    get version() {
        return new Version(this.value.version ?? '0.0.0');
    }
    async load() {
        const content = await promises.readFile(this.filePath, 'utf-8');
        this.value = JSON.parse(content.toString());
        return this.value;
    }
}

async function main(argv) {
    const startTime = performance.now();
    const path = resolve(argv._[0] ?? process.cwd());
    const config = await readConfig({ path });
    const packageJson = new PackageJson(path);
    await packageJson.load();
    const git = new Git(path, config, packageJson);
    await git.load();
    const runtimeConfig = {
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
        console.log(`Done in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
    }
    catch (error) {
        if (!changelog.fullContent ||
            changelog.fullContent?.trim() === Changelog.placeholder) {
            await changelog.delete();
        }
        throw error;
    }
}

var main$1 = /*#__PURE__*/Object.freeze({
	__proto__: null,
	default: main
});
