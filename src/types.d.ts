import { CommitType } from './config';

export type ChangelogerProvider = 'git' | 'github' | 'bitbucket' | 'gitlab';

export interface ChangelogerConfig {
  provider: ChangelogerProvider | null;
  header: string;
  fileName: string;
  versionPrefix: string;
  versionBumpType: 'major' | 'minor' | 'patch';
  startVersion: string;
  pullRequestOnly: boolean;
  order: CommitType[];
  typeTitle: Record<CommitType, string>;
}

export interface ChangelogerRuntimeConfig extends ChangelogerConfig {
  path: string;
  repositoryUrl?: string | null;
  branch?: string;
  major?: boolean;
  minor?: boolean;
  patch?: boolean;
  fromCommit?: string;
  toCommit?: string;
  date?: string;
}

export interface GitLog {
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
