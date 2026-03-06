import {
  createOctokit
} from "./shared/octokit.js"
import {
  assertRepositoryParams,
  normalizePrQuery,
  normalizeIssueQuery,
  withGithubApiVersion,
} from "../utils/github.js"

export async function listRepositoryIssues({ owner, repo, token, query } = {}) {
  assertRepositoryParams(owner, repo)

  const octokit = createOctokit(token)
  const normalizedQuery = normalizeIssueQuery(query)

  const response = await octokit.request(
    "GET /repos/{owner}/{repo}/issues",
    withGithubApiVersion({
      owner,
      repo,
      ...normalizedQuery,
    }),
  )

  return filterOutPullRequests(response.data)
}

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
    state: "open",
    perPage: query?.perPage || 100,
  })

  const issues = []

  for await (const { data } of octokit.paginate.iterator(
    "GET /repos/{owner}/{repo}/issues",
    withGithubApiVersion({
      owner,
      repo,
      ...normalizedQuery,
    }),
  )) {
    issues.push(...data)
  }

  return issues
}

export async function listRepositoryPullRequests({ owner, repo, token, query } = {}) {
  assertRepositoryParams(owner, repo)

  const octokit = createOctokit(token)
  const normalizedQuery = normalizePrQuery(query)

  const response = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls",
    withGithubApiVersion({
      owner,
      repo,
      ...normalizedQuery,
    }),
  )

  return response.data
}

export async function listAllOpenRepositoryPullRequests({ owner, repo, token, query } = {}) {
  assertRepositoryParams(owner, repo)

  const octokit = createOctokit(token)
  const normalizedQuery = normalizePrQuery({
    ...query,
    state: "open",
    perPage: query?.perPage || 100,
  })

  const prs = []

  for await (const { data } of octokit.paginate.iterator(
    "GET /repos/{owner}/{repo}/pulls",
    withGithubApiVersion({
      owner,
      repo,
      ...normalizedQuery,
    }),
  )) {
    prs.push(...data)
  }

  return prs
}
