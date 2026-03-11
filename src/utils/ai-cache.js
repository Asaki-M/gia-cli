import { createHash } from 'node:crypto'
import { getAiConfig, getConfig } from './config.js'
import { CATEGORIZED_ISSUES_PROMPT_VERSION } from './issue.js'

const ISSUE_CLASSIFICATION_CACHE_KEY = 'ai.issueClassificationCache'

function createEmptyCategorizedIssues(labels = []) {
  return labels.map(label => ({
    name: label,
    issues: [],
  }))
}

function normalizeLabels(labels = []) {
  return [...new Set(labels.filter(Boolean))].toSorted(
    (left, right) => left.localeCompare(right),
  )
}

function toIssueSummary(issue = {}) {
  return {
    number: issue.number,
    title: issue.title,
  }
}

function createIssueClassificationCacheKey({ owner, repo, labels = [], issue = {} } = {}) {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({
      owner,
      repo,
      labels: normalizeLabels(labels),
      number: issue.number,
      title: issue.title?.trim() || '',
      model: getAiConfig().model,
      promptVersion: CATEGORIZED_ISSUES_PROMPT_VERSION,
    }))
    .digest('hex')

  return fingerprint
}

function getIssueClassificationCacheStore() {
  const config = getConfig()
  const cacheStore = config.get(ISSUE_CLASSIFICATION_CACHE_KEY)

  if (!cacheStore || typeof cacheStore !== 'object' || Array.isArray(cacheStore)) {
    return {}
  }

  return cacheStore
}

export function getCachedIssueClassifications({ owner, repo, labels = [], issues = [] } = {}) {
  const cacheStore = getIssueClassificationCacheStore()
  const categorizedIssues = createEmptyCategorizedIssues(labels)
  const categorizedIssueMap = new Map(
    categorizedIssues.map(category => [category.name, category]),
  )
  const uncategorizedIssues = []
  const missedIssues = []

  for (const issue of issues) {
    const cacheKey = createIssueClassificationCacheKey({
      owner,
      repo,
      labels,
      issue,
    })
    const cachedEntry = cacheStore[cacheKey]

    if (!cachedEntry) {
      missedIssues.push(issue)
      continue
    }

    const issueSummary = toIssueSummary(issue)

    if (!cachedEntry.label) {
      uncategorizedIssues.push(issueSummary)
      continue
    }

    const targetCategory = categorizedIssueMap.get(cachedEntry.label)

    if (!targetCategory) {
      missedIssues.push(issue)
      continue
    }

    targetCategory.issues.push(issueSummary)
  }

  return {
    cachedResult: {
      categorizedIssues,
      uncategorizedIssues,
    },
    missedIssues,
  }
}

export function saveIssueClassificationsToCache({
  owner,
  repo,
  labels = [],
  result = {},
} = {}) {
  const config = getConfig()
  const cacheStore = getIssueClassificationCacheStore()
  const nextCacheStore = {
    ...cacheStore,
  }
  const cachedAt = new Date().toISOString()

  for (const category of result.categorizedIssues || []) {
    for (const issue of category.issues || []) {
      const cacheKey = createIssueClassificationCacheKey({
        owner,
        repo,
        labels,
        issue,
      })

      nextCacheStore[cacheKey] = {
        label: category.name,
        cachedAt,
      }
    }
  }

  for (const issue of result.uncategorizedIssues || []) {
    const cacheKey = createIssueClassificationCacheKey({
      owner,
      repo,
      labels,
      issue,
    })

    nextCacheStore[cacheKey] = {
      label: null,
      cachedAt,
    }
  }

  config.set(ISSUE_CLASSIFICATION_CACHE_KEY, nextCacheStore)
}

export function clearIssueClassificationCache() {
  const config = getConfig()
  const cacheStore = getIssueClassificationCacheStore()
  const clearedCount = Object.keys(cacheStore).length

  config.delete(ISSUE_CLASSIFICATION_CACHE_KEY)

  return clearedCount
}
