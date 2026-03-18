import { t } from '../i18n/index.js'
import {
  assertRepositoryParams,
  filterOutPullRequests,
  normalizeIssueQuery,
  withGithubApiVersion,
} from '../utils/github.js'
import {
  createOctokit,
} from './shared/octokit.js'

export async function listAllOpenRepositoryIssues({
  owner,
  repo,
  token,
  query,
} = {}) {
  assertRepositoryParams(owner, repo)

  const octokit = createOctokit(token)
  const normalizedQuery = normalizeIssueQuery({
    ...query,
    state: 'open',
    perPage: query?.perPage || 100,
  })

  const issues = []

  for await (const { data } of octokit.paginate.iterator(
    'GET /repos/{owner}/{repo}/issues',
    withGithubApiVersion({
      owner,
      repo,
      ...normalizedQuery,
    }),
  )) {
    issues.push(...filterOutPullRequests(data))
  }

  return issues
}

export async function listOpenRepositoryIssuesWithLimit({
  owner,
  repo,
  token,
  limit,
  offset = 0,
  query,
} = {}) {
  assertRepositoryParams(owner, repo)

  const normalizedLimit = Number.parseInt(limit, 10)
  if (!Number.isInteger(normalizedLimit) || normalizedLimit <= 0) {
    throw new Error(t('error.limitPositiveInteger'))
  }
  const normalizedOffset = Number.parseInt(offset, 10)
  if (!Number.isInteger(normalizedOffset) || normalizedOffset < 0) {
    throw new Error(t('error.offsetNonNegativeInteger'))
  }

  const octokit = createOctokit(token)
  const perPage = Math.min(query?.perPage || query?.per_page || 100, 100)
  const normalizedQuery = normalizeIssueQuery({
    ...query,
    state: 'open',
    perPage,
  })
  const issues = []
  let skippedCount = 0

  for await (const { data } of octokit.paginate.iterator(
    'GET /repos/{owner}/{repo}/issues',
    withGithubApiVersion({
      owner,
      repo,
      ...normalizedQuery,
    }),
  )) {
    for (const issue of filterOutPullRequests(data)) {
      if (skippedCount < normalizedOffset) {
        skippedCount += 1
        continue
      }

      issues.push(issue)
      if (issues.length >= normalizedLimit) {
        return issues
      }
    }
  }

  return issues
}

export async function listAllLabelsForRepository({ owner, repo, token, query } = {}) {
  assertRepositoryParams(owner, repo)

  const octokit = createOctokit(token)
  const labels = []
  const perPage = query?.perPage || query?.per_page || 100

  for await (const { data } of octokit.paginate.iterator(
    'GET /repos/{owner}/{repo}/labels',
    withGithubApiVersion({
      owner,
      repo,
      ...query,
      per_page: perPage,
    }),
  )) {
    labels.push(...data)
  }

  return labels
}

export async function getRepositoryBasicInfo({ owner, repo, token } = {}) {
  assertRepositoryParams(owner, repo)

  const octokit = createOctokit(token)
  const { data } = await octokit.request(
    'GET /repos/{owner}/{repo}',
    withGithubApiVersion({
      owner,
      repo,
    }),
  )

  return data
}
