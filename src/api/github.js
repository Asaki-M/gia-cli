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

  return labels.map(item => item.name)
}
