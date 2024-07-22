import { commitUrl, pullRequestUrl } from './utils';
import { ChangelogerProvider, GitLog } from '../types';
import { CommitType, defaultConfig } from '../config';

export class Commit {
  public hash!: string;
  public message!: string;
  public body!: string;
  public date!: Date;
  public branch!: string | null;
  public authorName!: string;
  public authorEmail!: string;
  public refs!: string[];
  public parentHashes!: string[];
  public isPullRequest: boolean = false;
  public commits: string[] | null = null;

  constructor(
    attrs: GitLog,
    public provider: ChangelogerProvider | null = null
  ) {
    Object.assign(this, { ...attrs, date: new Date(attrs.date) });
  }

  get pullRequestNo() {
    if (!this.isPullRequest) return null;

    if (this.provider === 'bitbucket') {
      const { pullRequestNo } = this.message.match(
        /Merged in (?<branch>.+) \(pull request #(?<pullRequestNo>\d+)\)/
      )?.groups!;
      return Number(pullRequestNo);
    }

    return null;
  }

  get messageStats(): {
    type: CommitType;
    scope?: string;
    subject: string;
  } | null {
    return (
      ((this.isPullRequest ? this.body : this.message).match(
        /^(?<type>[a-z]+)(\((?<scope>[^)]+)\))?:(\s+)?(?<subject>.+)/
      )?.groups as {
        type: CommitType;
        scope?: string;
        subject: string;
      }) ?? null
    );
  }

  get type() {
    return this.messageStats?.type ?? null;
  }

  toChangelogEntry(repositoryUrl?: string | null) {
    return this.isPullRequest
      ? this.pullRequestEntry(repositoryUrl)
      : this.commitEntry(repositoryUrl);
  }

  commitEntry(repositoryUrl?: string | null) {
    const commitLink = `[\`${this.hash}\`](${commitUrl(
      this.hash,
      this.provider,
      repositoryUrl
    )})`;
    if (!this.messageStats) return `- ${this.message} (${commitLink})`;

    const { scope, subject } = this.messageStats;
    return scope
      ? `- **${scope}**: ${subject} (${commitLink})`
      : `- ${subject} (${commitLink})`;
  }

  pullRequestEntry(repositoryUrl?: string | null) {
    const prUrl = pullRequestUrl(
      this.pullRequestNo,
      this.provider,
      repositoryUrl
    );
    const prLink = prUrl ? ` ([#${this.pullRequestNo}](${prUrl}))` : '';
    const commitLinks = (this.commits ?? []).map((commitHash) => {
      const commitId = commitHash.substring(0, 7);
      return `[\`${commitId}\`](${commitUrl(
        commitId,
        this.provider,
        repositoryUrl
      )})`;
    });

    if (this.messageStats) {
      const { scope, subject } = this.messageStats;
      return scope
        ? `- **${scope}**: ${subject}${prLink} (${commitLinks.join(', ')})`
        : `- ${subject}${prLink} (${commitLinks.join(', ')})`;
    }

    const subject = this.isPullRequest ? this.body : this.message;
    return `- ${subject}${prLink} (${commitLinks.join(', ')})`;
  }

  static classify(commits: Commit[]) {
    const { order } = defaultConfig;
    const entries = order.reduce((acc, type) => {
      const typeCommits = commits.filter((commit) => commit.type === type);
      if (typeCommits.length) {
        acc[type] ??= [];
        acc[type].push(...typeCommits);
      }
      return acc;
    }, {} as Record<CommitType | 'other', Commit[]>);
    const others = commits.filter((commit) => !commit.type);
    if (others.length) entries.other = others;
    return entries;
  }
}
