const GITHUB_API_VERSION = '2022-11-28'

export function assertRepositoryParams(owner, repo) {
  if (!owner || !repo) {
    throw new Error('owner and repo are required')
  }
}

export function withGithubApiVersion(params = {}) {
  return {
    ...params,
    request: {
      ...params.request,
      headers: {
        ...params.request?.headers,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
    },
  }
}

export function normalizeIssueQuery(query = {}, defaultPerPage = 30) {
  const { perPage, ...restQuery } = query

  return {
    ...restQuery,
    per_page: restQuery.per_page || perPage || defaultPerPage,
  }
}

export function filterOutPullRequests(items = []) {
  return items.filter(item => !item.pull_request)
}
