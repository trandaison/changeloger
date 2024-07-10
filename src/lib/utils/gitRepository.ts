import { ChangelogerProvider } from '../../types';

export function pullRequestUrl(
  number: number | undefined | null,
  provider: ChangelogerProvider | null,
  repositoryUrl?: string | null
) {
  if (!repositoryUrl || !number) return '';

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

export function commitUrl(
  hash: string,
  provider: ChangelogerProvider | null,
  repositoryUrl?: string | null
) {
  if (!repositoryUrl) return '';

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

export function compareUrl(
  prevVersion: string | null,
  nextVersion: string,
  provider: ChangelogerProvider | null,
  repositoryUrl?: string | null
) {
  if (!(repositoryUrl && prevVersion)) return '';

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

export function toRepoUrl(url: string, provider?: string) {
  if (url.startsWith('http')) {
    return url.replace(/\.git$/, '');
  }

  if (url.startsWith('git@')) {
    const regex =
      /git@.+:(?<username>[a-zA-Z0-9-_]+)\/(?<repository>[a-zA-Z0-9-_]+).git/;
    const { username, repository } = url.match(regex)?.groups ?? {};
    const _provider = provider ?? guessProvider(url);
    if (!_provider) return null;

    return `https://${_provider}.com/${username}/${repository}`;
  }

  return null;
}

export function guessProvider(url: string) {
  if (url.includes('github')) return 'github';
  if (url.includes('gitlab')) return 'gitlab';
  if (url.includes('bitbucket')) return 'bitbucket';
  return null;
}
