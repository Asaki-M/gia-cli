import { assertRepositoryParams } from '../utils/github.js'
import { createOctokit } from './shared/octokit.js'

const MAINTAINER_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const BOT_LOGIN_SUFFIX = '[bot]'
const MILLISECONDS_IN_HOUR = 1000 * 60 * 60
const MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24
const DEFAULT_LOOKBACK_DAYS = 90
const DEFAULT_ACTIVE_COMMENT_THRESHOLD = 3
const DEFAULT_GOOD_FIRST_ISSUE_LABEL = 'good first issue'
const DEFAULT_QUICK_CLOSE_DAYS = 7
const DEFAULT_STALE_OPEN_DAYS = 30

const SEARCH_COUNT_QUERY = `
  query SearchCount($searchQuery: String!) {
    search(query: $searchQuery, type: ISSUE, first: 1) {
      issueCount
    }
  }
`

const SEARCH_ISSUES_CREATED_QUERY = `
  query SearchIssuesCreated($searchQuery: String!, $first: Int!, $after: String) {
    search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on Issue {
          number
          url
          title
          createdAt
          closedAt
          state
          labels(first: 50) {
            nodes {
              name
            }
          }
          comments(first: 50) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              createdAt
              authorAssociation
              author {
                login
              }
            }
          }
        }
      }
    }
  }
`

const SEARCH_PULL_REQUESTS_CREATED_QUERY = `
  query SearchPullRequestsCreated($searchQuery: String!, $first: Int!, $after: String) {
    search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on PullRequest {
          number
          createdAt
          mergedAt
          closedAt
          state
          author {
            login
          }
          comments(first: 50) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              createdAt
              author {
                login
              }
            }
          }
          reviews(first: 50) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              submittedAt
              author {
                login
              }
            }
          }
        }
      }
    }
  }
`

const SEARCH_MERGED_PULL_REQUESTS_QUERY = `
  query SearchMergedPullRequests($searchQuery: String!, $first: Int!, $after: String) {
    search(query: $searchQuery, type: ISSUE, first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on PullRequest {
          number
          createdAt
          mergedAt
          author {
            login
          }
        }
      }
    }
  }
`

const ISSUE_COMMENTS_QUERY = `
  query IssueComments($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        comments(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            createdAt
            authorAssociation
            author {
              login
            }
          }
        }
      }
    }
  }
`

const PULL_REQUEST_COMMENTS_QUERY = `
  query PullRequestComments($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        comments(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            createdAt
            author {
              login
            }
          }
        }
      }
    }
  }
`

const PULL_REQUEST_REVIEWS_QUERY = `
  query PullRequestReviews($owner: String!, $repo: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviews(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            submittedAt
            author {
              login
            }
          }
        }
      }
    }
  }
`

const REPOSITORY_DEFAULT_BRANCH_QUERY = `
  query RepositoryDefaultBranch($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      defaultBranchRef {
        name
        target {
          ... on Commit {
            committedDate
          }
        }
      }
    }
  }
`

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function normalizePositiveInteger(value, fallbackValue) {
  const parsedValue = Number.parseInt(value, 10)
  return isPositiveInteger(parsedValue) ? parsedValue : fallbackValue
}

function formatDateForSearch(date) {
  return date.toISOString().slice(0, 10)
}

function createRepositorySearchQuery(owner, repo, qualifiers = []) {
  return [`repo:${owner}/${repo}`, ...qualifiers].join(' ')
}

function isBotLogin(login = '') {
  return typeof login === 'string' && login.toLowerCase().endsWith(BOT_LOGIN_SUFFIX)
}

function safeDiffInHours(startDateString, endDateString) {
  if (!startDateString || !endDateString) {
    return null
  }

  const diff = new Date(endDateString).getTime() - new Date(startDateString).getTime()
  return diff >= 0 ? diff / MILLISECONDS_IN_HOUR : null
}

function safeDiffInDays(startDateString, endDateString) {
  if (!startDateString || !endDateString) {
    return null
  }

  const diff = new Date(endDateString).getTime() - new Date(startDateString).getTime()
  return diff >= 0 ? diff / MILLISECONDS_IN_DAY : null
}

function calculateAverage(numbers = []) {
  if (numbers.length === 0) {
    return null
  }

  const total = numbers.reduce((sum, value) => sum + value, 0)
  return total / numbers.length
}

function calculateMedian(numbers = []) {
  if (numbers.length === 0) {
    return null
  }

  const sortedNumbers = numbers.toSorted((a, b) => a - b)
  const middleIndex = Math.floor(sortedNumbers.length / 2)

  if (sortedNumbers.length % 2 === 0) {
    return (sortedNumbers[middleIndex - 1] + sortedNumbers[middleIndex]) / 2
  }

  return sortedNumbers[middleIndex]
}

function roundNumber(value, precision = 2) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function increaseUserCount(counterMap, login) {
  if (!login || isBotLogin(login)) {
    return
  }

  counterMap.set(login, (counterMap.get(login) || 0) + 1)
}

function mergeUserCountMap(targetMap, sourceMap) {
  for (const [login, count] of sourceMap.entries()) {
    targetMap.set(login, (targetMap.get(login) || 0) + count)
  }
}

function getEarliestMaintainerCommentAt(commentNodes = []) {
  let earliestTimestamp = null

  for (const comment of commentNodes) {
    const association = comment?.authorAssociation
    const createdAt = comment?.createdAt

    if (!MAINTAINER_ASSOCIATIONS.has(association) || !createdAt) {
      continue
    }

    const createdTimestamp = new Date(createdAt).getTime()
    if (!Number.isFinite(createdTimestamp)) {
      continue
    }

    if (earliestTimestamp === null || createdTimestamp < earliestTimestamp) {
      earliestTimestamp = createdTimestamp
    }
  }

  return earliestTimestamp === null ? null : new Date(earliestTimestamp).toISOString()
}

function normalizeLabelName(labelName = '') {
  return labelName.toString().trim().toLowerCase()
}

function isGoodFirstIssue(issue, expectedLabelName) {
  const normalizedExpectedLabelName = normalizeLabelName(expectedLabelName)

  return (issue?.labels?.nodes || []).some(label => normalizeLabelName(label?.name).includes(normalizedExpectedLabelName))
}

async function runSearchCount(octokit, query) {
  const result = await octokit.graphql(SEARCH_COUNT_QUERY, {
    searchQuery: query,
  })
  return result?.search?.issueCount || 0
}

async function paginateSearchNodes(octokit, query, queryTemplate) {
  const nodes = []
  let hasNextPage = true
  let cursor = null

  while (hasNextPage) {
    const result = await octokit.graphql(queryTemplate, {
      searchQuery: query,
      first: 100,
      after: cursor,
    })
    const pageNodes = result?.search?.nodes || []
    const pageInfo = result?.search?.pageInfo

    nodes.push(...pageNodes.filter(Boolean))

    hasNextPage = Boolean(pageInfo?.hasNextPage)
    cursor = pageInfo?.endCursor || null
  }

  return nodes
}

async function fetchIssueCommentsPage({ octokit, owner, repo, issueNumber, afterCursor = null }) {
  const result = await octokit.graphql(ISSUE_COMMENTS_QUERY, {
    owner,
    repo,
    number: issueNumber,
    after: afterCursor,
  })

  return result?.repository?.issue?.comments || {
    nodes: [],
    pageInfo: {
      hasNextPage: false,
      endCursor: null,
    },
  }
}

async function fetchPullRequestCommentsPage({ octokit, owner, repo, pullRequestNumber, afterCursor = null }) {
  const result = await octokit.graphql(PULL_REQUEST_COMMENTS_QUERY, {
    owner,
    repo,
    number: pullRequestNumber,
    after: afterCursor,
  })

  return result?.repository?.pullRequest?.comments || {
    nodes: [],
    pageInfo: {
      hasNextPage: false,
      endCursor: null,
    },
  }
}

async function fetchPullRequestReviewsPage({ octokit, owner, repo, pullRequestNumber, afterCursor = null }) {
  const result = await octokit.graphql(PULL_REQUEST_REVIEWS_QUERY, {
    owner,
    repo,
    number: pullRequestNumber,
    after: afterCursor,
  })

  return result?.repository?.pullRequest?.reviews || {
    nodes: [],
    pageInfo: {
      hasNextPage: false,
      endCursor: null,
    },
  }
}

function collectIssueCommentStatsFromNodes(commentNodes = [], sinceAt) {
  const userCounts = new Map()

  for (const comment of commentNodes) {
    const createdAt = comment?.createdAt
    const login = comment?.author?.login

    if (!createdAt || !sinceAt) {
      continue
    }

    if (new Date(createdAt).getTime() >= sinceAt.getTime()) {
      increaseUserCount(userCounts, login)
    }
  }

  return {
    firstMaintainerResponseAt: getEarliestMaintainerCommentAt(commentNodes),
    userCounts,
  }
}

async function collectIssueCommentStats({ octokit, owner, repo, issue, sinceAt }) {
  const initialNodes = issue?.comments?.nodes || []
  const userCounts = new Map()
  const firstMaintainerResponseCandidates = []

  const initialStats = collectIssueCommentStatsFromNodes(initialNodes, sinceAt)
  mergeUserCountMap(userCounts, initialStats.userCounts)

  if (initialStats.firstMaintainerResponseAt) {
    firstMaintainerResponseCandidates.push(initialStats.firstMaintainerResponseAt)
  }

  let hasNextPage = Boolean(issue?.comments?.pageInfo?.hasNextPage)
  let cursor = issue?.comments?.pageInfo?.endCursor || null

  while (hasNextPage) {
    const commentsPage = await fetchIssueCommentsPage({
      octokit,
      owner,
      repo,
      issueNumber: issue.number,
      afterCursor: cursor,
    })
    const pageStats = collectIssueCommentStatsFromNodes(commentsPage.nodes || [], sinceAt)

    mergeUserCountMap(userCounts, pageStats.userCounts)

    if (pageStats.firstMaintainerResponseAt) {
      firstMaintainerResponseCandidates.push(pageStats.firstMaintainerResponseAt)
    }

    hasNextPage = Boolean(commentsPage?.pageInfo?.hasNextPage)
    cursor = commentsPage?.pageInfo?.endCursor || null
  }

  const firstMaintainerResponseAt = firstMaintainerResponseCandidates.length > 0
    ? firstMaintainerResponseCandidates.sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0]
    : null

  return {
    firstMaintainerResponseAt,
    userCounts,
  }
}

function collectPullRequestCommentStatsFromNodes(commentNodes = [], sinceAt) {
  const userCounts = new Map()

  for (const comment of commentNodes) {
    const createdAt = comment?.createdAt
    const login = comment?.author?.login

    if (!createdAt || !sinceAt) {
      continue
    }

    if (new Date(createdAt).getTime() >= sinceAt.getTime()) {
      increaseUserCount(userCounts, login)
    }
  }

  return userCounts
}

function collectPullRequestReviewStatsFromNodes(reviewNodes = [], sinceAt) {
  const userCounts = new Map()

  for (const review of reviewNodes) {
    const submittedAt = review?.submittedAt
    const login = review?.author?.login

    if (!submittedAt || !sinceAt) {
      continue
    }

    if (new Date(submittedAt).getTime() >= sinceAt.getTime()) {
      increaseUserCount(userCounts, login)
    }
  }

  return userCounts
}

async function collectPullRequestDiscussionStats({ octokit, owner, repo, pullRequest, sinceAt }) {
  const userCounts = new Map()

  const initialCommentCounts = collectPullRequestCommentStatsFromNodes(pullRequest?.comments?.nodes || [], sinceAt)
  mergeUserCountMap(userCounts, initialCommentCounts)

  const initialReviewCounts = collectPullRequestReviewStatsFromNodes(pullRequest?.reviews?.nodes || [], sinceAt)
  mergeUserCountMap(userCounts, initialReviewCounts)

  let hasNextComments = Boolean(pullRequest?.comments?.pageInfo?.hasNextPage)
  let commentCursor = pullRequest?.comments?.pageInfo?.endCursor || null

  while (hasNextComments) {
    const commentsPage = await fetchPullRequestCommentsPage({
      octokit,
      owner,
      repo,
      pullRequestNumber: pullRequest.number,
      afterCursor: commentCursor,
    })

    const pageCommentCounts = collectPullRequestCommentStatsFromNodes(commentsPage.nodes || [], sinceAt)
    mergeUserCountMap(userCounts, pageCommentCounts)

    hasNextComments = Boolean(commentsPage?.pageInfo?.hasNextPage)
    commentCursor = commentsPage?.pageInfo?.endCursor || null
  }

  let hasNextReviews = Boolean(pullRequest?.reviews?.pageInfo?.hasNextPage)
  let reviewCursor = pullRequest?.reviews?.pageInfo?.endCursor || null

  while (hasNextReviews) {
    const reviewsPage = await fetchPullRequestReviewsPage({
      octokit,
      owner,
      repo,
      pullRequestNumber: pullRequest.number,
      afterCursor: reviewCursor,
    })

    const pageReviewCounts = collectPullRequestReviewStatsFromNodes(reviewsPage.nodes || [], sinceAt)
    mergeUserCountMap(userCounts, pageReviewCounts)

    hasNextReviews = Boolean(reviewsPage?.pageInfo?.hasNextPage)
    reviewCursor = reviewsPage?.pageInfo?.endCursor || null
  }

  return userCounts
}

async function fetchDefaultBranchCommitInfo({ octokit, owner, repo }) {
  const result = await octokit.graphql(REPOSITORY_DEFAULT_BRANCH_QUERY, {
    owner,
    repo,
  })

  const defaultBranch = result?.repository?.defaultBranchRef

  return {
    defaultBranchName: defaultBranch?.name || null,
    lastCommitAt: defaultBranch?.target?.committedDate || null,
  }
}

export async function analyzeRepositoryHealthByGraphQL({
  owner,
  repo,
  token,
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  activeCommentThreshold = DEFAULT_ACTIVE_COMMENT_THRESHOLD,
  goodFirstIssueLabel = DEFAULT_GOOD_FIRST_ISSUE_LABEL,
  quickCloseDays = DEFAULT_QUICK_CLOSE_DAYS,
  staleOpenDays = DEFAULT_STALE_OPEN_DAYS,
} = {}) {
  assertRepositoryParams(owner, repo)

  const normalizedLookbackDays = normalizePositiveInteger(lookbackDays, DEFAULT_LOOKBACK_DAYS)
  const normalizedActiveCommentThreshold = normalizePositiveInteger(activeCommentThreshold, DEFAULT_ACTIVE_COMMENT_THRESHOLD)
  const normalizedQuickCloseDays = normalizePositiveInteger(quickCloseDays, DEFAULT_QUICK_CLOSE_DAYS)
  const normalizedStaleOpenDays = normalizePositiveInteger(staleOpenDays, DEFAULT_STALE_OPEN_DAYS)

  const octokit = createOctokit(token)
  const now = new Date()
  const sinceAt = new Date(now.getTime() - normalizedLookbackDays * MILLISECONDS_IN_DAY)
  const sinceDate = formatDateForSearch(sinceAt)

  const newIssuesQuery = createRepositorySearchQuery(owner, repo, [
    'is:issue',
    `created:>=${sinceDate}`,
  ])
  const closedIssuesQuery = createRepositorySearchQuery(owner, repo, [
    'is:issue',
    `closed:>=${sinceDate}`,
  ])
  const issuesCreatedQuery = createRepositorySearchQuery(owner, repo, [
    'is:issue',
    `created:>=${sinceDate}`,
    'sort:created-asc',
  ])
  const issuesDiscussedQuery = createRepositorySearchQuery(owner, repo, [
    'is:issue',
    `updated:>=${sinceDate}`,
    'sort:updated-desc',
  ])
  const pullRequestsDiscussedQuery = createRepositorySearchQuery(owner, repo, [
    'is:pr',
    `updated:>=${sinceDate}`,
    'sort:updated-desc',
  ])
  const mergedPullRequestsQuery = createRepositorySearchQuery(owner, repo, [
    'is:pr',
    'is:merged',
    `merged:>=${sinceDate}`,
    'sort:updated-desc',
  ])
  const rejectedPullRequestsQuery = createRepositorySearchQuery(owner, repo, [
    'is:pr',
    'is:closed',
    '-is:merged',
    `closed:>=${sinceDate}`,
  ])

  const [
    newIssuesCount,
    closedIssuesCount,
    rejectedPullRequestsCount,
    createdIssues,
    discussedIssues,
    discussedPullRequests,
    mergedPullRequests,
    defaultBranchInfo,
  ] = await Promise.all([
    runSearchCount(octokit, newIssuesQuery),
    runSearchCount(octokit, closedIssuesQuery),
    runSearchCount(octokit, rejectedPullRequestsQuery),
    paginateSearchNodes(octokit, issuesCreatedQuery, SEARCH_ISSUES_CREATED_QUERY),
    paginateSearchNodes(octokit, issuesDiscussedQuery, SEARCH_ISSUES_CREATED_QUERY),
    paginateSearchNodes(octokit, pullRequestsDiscussedQuery, SEARCH_PULL_REQUESTS_CREATED_QUERY),
    paginateSearchNodes(octokit, mergedPullRequestsQuery, SEARCH_MERGED_PULL_REQUESTS_QUERY),
    fetchDefaultBranchCommitInfo({ octokit, owner, repo }),
  ])

  const issueResponseHours = []
  let issueResponseCount = 0
  const issueCommentUserCounts = new Map()
  const issueCommentStatsCache = new Map()

  async function getIssueCommentStats(issue) {
    if (issueCommentStatsCache.has(issue.number)) {
      return issueCommentStatsCache.get(issue.number)
    }

    const issueCommentStats = await collectIssueCommentStats({
      octokit,
      owner,
      repo,
      issue,
      sinceAt,
    })

    issueCommentStatsCache.set(issue.number, issueCommentStats)
    return issueCommentStats
  }

  for (const issue of createdIssues) {
    const issueCommentStats = await getIssueCommentStats(issue)

    if (!issueCommentStats.firstMaintainerResponseAt) {
      continue
    }

    const responseHours = safeDiffInHours(issue.createdAt, issueCommentStats.firstMaintainerResponseAt)

    if (typeof responseHours === 'number') {
      issueResponseHours.push(responseHours)
      issueResponseCount += 1
    }
  }

  const goodFirstIssues = createdIssues.filter(issue => isGoodFirstIssue(issue, goodFirstIssueLabel))
  let goodFirstIssueQuickClosedCount = 0
  let goodFirstIssueStaleOpenCount = 0
  const goodFirstIssueSurvivalDays = []

  for (const issue of goodFirstIssues) {
    const endDateString = issue.closedAt || now.toISOString()
    const survivalDays = safeDiffInDays(issue.createdAt, endDateString)

    if (typeof survivalDays === 'number') {
      goodFirstIssueSurvivalDays.push(survivalDays)
    }

    if (issue.closedAt) {
      const closeDays = safeDiffInDays(issue.createdAt, issue.closedAt)
      if (typeof closeDays === 'number' && closeDays <= normalizedQuickCloseDays) {
        goodFirstIssueQuickClosedCount += 1
      }
      continue
    }

    const openDays = safeDiffInDays(issue.createdAt, now.toISOString())
    if (typeof openDays === 'number' && openDays >= normalizedStaleOpenDays) {
      goodFirstIssueStaleOpenCount += 1
    }
  }

  for (const issue of discussedIssues) {
    const issueCommentStats = await getIssueCommentStats(issue)
    mergeUserCountMap(issueCommentUserCounts, issueCommentStats.userCounts)
  }

  const pullRequestDiscussionUserCounts = new Map()
  const pullRequestDiscussionStatsCache = new Map()

  async function getPullRequestDiscussionStats(pullRequest) {
    if (pullRequestDiscussionStatsCache.has(pullRequest.number)) {
      return pullRequestDiscussionStatsCache.get(pullRequest.number)
    }

    const pullRequestDiscussionStats = await collectPullRequestDiscussionStats({
      octokit,
      owner,
      repo,
      pullRequest,
      sinceAt,
    })

    pullRequestDiscussionStatsCache.set(pullRequest.number, pullRequestDiscussionStats)
    return pullRequestDiscussionStats
  }

  for (const pullRequest of discussedPullRequests) {
    const pullRequestDiscussionStats = await getPullRequestDiscussionStats(pullRequest)
    mergeUserCountMap(pullRequestDiscussionUserCounts, pullRequestDiscussionStats)
  }

  const mergedPullRequestLeadHours = []
  const mergedPullRequestAuthorSet = new Set()

  for (const pullRequest of mergedPullRequests) {
    const mergeLeadHours = safeDiffInHours(pullRequest.createdAt, pullRequest.mergedAt)
    if (typeof mergeLeadHours === 'number') {
      mergedPullRequestLeadHours.push(mergeLeadHours)
    }

    const authorLogin = pullRequest?.author?.login
    if (authorLogin && !isBotLogin(authorLogin)) {
      mergedPullRequestAuthorSet.add(authorLogin)
    }
  }

  const activeCommenterSet = new Set()
  const combinedCommentUserCounts = new Map(issueCommentUserCounts)
  mergeUserCountMap(combinedCommentUserCounts, pullRequestDiscussionUserCounts)

  for (const [login, count] of combinedCommentUserCounts.entries()) {
    if (count >= normalizedActiveCommentThreshold) {
      activeCommenterSet.add(login)
    }
  }

  const activeContributorSet = new Set([...mergedPullRequestAuthorSet, ...activeCommenterSet])

  const resolutionRate = newIssuesCount > 0 ? (closedIssuesCount / newIssuesCount) * 100 : null
  const rejectToMergeRatio = mergedPullRequests.length > 0
    ? rejectedPullRequestsCount / mergedPullRequests.length
    : null

  const daysSinceLastCommit = safeDiffInDays(defaultBranchInfo.lastCommitAt, now.toISOString())

  return {
    owner,
    repo,
    timeframe: {
      lookbackDays: normalizedLookbackDays,
      sinceAt: sinceAt.toISOString(),
      untilAt: now.toISOString(),
    },
    issueResponsiveness: {
      newIssuesCount,
      issuesWithMaintainerResponseCount: issueResponseCount,
      issuesWithoutMaintainerResponseCount: Math.max(newIssuesCount - issueResponseCount, 0),
      averageFirstResponseHours: roundNumber(calculateAverage(issueResponseHours)),
      medianFirstResponseHours: roundNumber(calculateMedian(issueResponseHours)),
    },
    resolutionRate: {
      closedIssuesCount,
      newIssuesCount,
      resolutionRatePercent: roundNumber(resolutionRate),
    },
    communityEngagement: {
      activeContributorsCount: activeContributorSet.size,
      mergedPullRequestAuthorsCount: mergedPullRequestAuthorSet.size,
      activeCommentersCount: activeCommenterSet.size,
      activeCommentThreshold: normalizedActiveCommentThreshold,
      goodFirstIssue: {
        totalCount: goodFirstIssues.length,
        openCount: goodFirstIssues.filter(issue => !issue.closedAt).length,
        closedCount: goodFirstIssues.filter(issue => Boolean(issue.closedAt)).length,
        quickClosedCount: goodFirstIssueQuickClosedCount,
        staleOpenCount: goodFirstIssueStaleOpenCount,
        averageSurvivalDays: roundNumber(calculateAverage(goodFirstIssueSurvivalDays)),
        medianSurvivalDays: roundNumber(calculateMedian(goodFirstIssueSurvivalDays)),
      },
    },
    pullRequestMergeEfficiency: {
      mergedPullRequestsCount: mergedPullRequests.length,
      rejectedPullRequestsCount,
      averageMergeHours: roundNumber(calculateAverage(mergedPullRequestLeadHours)),
      medianMergeHours: roundNumber(calculateMedian(mergedPullRequestLeadHours)),
      rejectToMergeRatio: roundNumber(rejectToMergeRatio),
    },
    maintenanceVitality: {
      defaultBranchName: defaultBranchInfo.defaultBranchName,
      lastCommitAt: defaultBranchInfo.lastCommitAt,
      daysSinceLastCommit: roundNumber(daysSinceLastCommit),
      isLikelyZombie: typeof daysSinceLastCommit === 'number' ? daysSinceLastCommit > 90 : null,
    },
  }
}
