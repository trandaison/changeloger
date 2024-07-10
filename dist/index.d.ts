type ChangelogerProvider = 'git' | 'github' | 'bitbucket' | 'gitlab';

interface ChangelogerConfig {
  provider: ChangelogerProvider | null;
  header: string;
  fileName: string;
  versionPrefix: string;
  versionBumpType: 'major' | 'minor' | 'patch';
  startVersion: string;
  pullRequestOnly: boolean;
}

interface ChangelogerRuntimeConfig extends ChangelogerConfig {
  path: string;
  repositoryUrl?: string | null;
  branch?: string;
  major?: boolean;
  minor?: boolean;
  patch?: boolean;
  fromCommit?: string;
  toCommit?: string;
}

interface CommitAuthor {
  name: string;
  email: string;
}

interface Commit {
  hash: string;
  message: string;
  date: Date;
  branch: string | null;
  author?: CommitAuthor;
}

interface CommitMerge extends Commit {
  fromCommit: string;
  toCommit: string;
  pullRequestNo?: number;
}

interface GitLog {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
  refs: string[];
  parentHashes: string[];
  branch: string | null;
  isPullRequest?: boolean;
  commits?: string[];
}

export type { ChangelogerConfig, ChangelogerProvider, ChangelogerRuntimeConfig, Commit, CommitAuthor, CommitMerge, GitLog };
