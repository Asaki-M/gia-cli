import { createHash } from 'node:crypto'
import { getAiConfig, getConfig } from './config.js'
import {
  CATEGORIZED_ISSUES_PROMPT_VERSION,
  EVALUABLE_LABELS_PROMPT_VERSION,
  ISSUE_DIFFICULTY_PROMPT_VERSION,
} from './prompt.js'

const ISSUE_CLASSIFICATION_CACHE_KEY = 'ai.issueClassificationCache'
const EVALUABLE_LABELS_CACHE_KEY = 'ai.evaluableLabelsCache'
const ISSUE_DIFFICULTY_CACHE_KEY = 'ai.issueDifficultyCache'

function createEmptyCategorizedIssues(labels = []) {
  return labels.map(label => ({
    name: label,
    issues: [],
  }))
}

function normalizeLabelNames(labels = []) {
  return [...new Set(labels.filter(Boolean))].toSorted(
    (left, right) => left.localeCompare(right),
  )
}

function normalizeLabelDefinitions(labels = []) {
  return labels
    .map(label => ({
      name: label?.name?.trim() || '',
      description: label?.description?.trim() || '',
    }))
    .filter(label => label.name)
    .toSorted((left, right) => left.name.localeCompare(right.name))
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
      labels: normalizeLabelNames(labels),
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

function createEvaluableLabelsCacheKey({ owner, repo, labels = [] } = {}) {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({
      owner,
      repo,
      labels: normalizeLabelDefinitions(labels),
      model: getAiConfig().model,
      promptVersion: EVALUABLE_LABELS_PROMPT_VERSION,
    }))
    .digest('hex')

  return fingerprint
}

function getEvaluableLabelsCacheStore() {
  const config = getConfig()
  const cacheStore = config.get(EVALUABLE_LABELS_CACHE_KEY)

  if (!cacheStore || typeof cacheStore !== 'object' || Array.isArray(cacheStore)) {
    return {}
  }

  return cacheStore
}

function createIssueDifficultyCacheKey({ owner, repo, categoryName, issue = {} } = {}) {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({
      owner,
      repo,
      categoryName: categoryName?.trim() || '',
      number: issue.number,
      title: issue.title?.trim() || '',
      body: issue.formatBody || issue.body?.trim() || '',
      model: getAiConfig().model,
      promptVersion: ISSUE_DIFFICULTY_PROMPT_VERSION,
    }))
    .digest('hex')

  return fingerprint
}

function getIssueDifficultyCacheStore() {
  const config = getConfig()
  const cacheStore = config.get(ISSUE_DIFFICULTY_CACHE_KEY)

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

export function getCachedEvaluableLabels({ owner, repo, labels = [] } = {}) {
  const normalizedLabels = normalizeLabelDefinitions(labels)

  if (normalizedLabels.length === 0) {
    return null
  }

  const cacheStore = getEvaluableLabelsCacheStore()
  const cacheKey = createEvaluableLabelsCacheKey({
    owner,
    repo,
    labels: normalizedLabels,
  })
  const cachedEntry = cacheStore[cacheKey]

  if (!cachedEntry || !Array.isArray(cachedEntry.labels)) {
    return null
  }

  const evaluableLabelNameSet = new Set(
    cachedEntry.labels
      .map(labelName => labelName?.trim() || '')
      .filter(Boolean),
  )

  return normalizedLabels.filter(label => evaluableLabelNameSet.has(label.name))
}

export function saveEvaluableLabelsToCache({
  owner,
  repo,
  labels = [],
  evaluableLabels = [],
} = {}) {
  const normalizedLabels = normalizeLabelDefinitions(labels)

  if (normalizedLabels.length === 0) {
    return
  }

  const evaluableLabelNames = [...new Set(
    evaluableLabels
      .map(label => label?.name?.trim() || '')
      .filter(Boolean),
  )].toSorted((left, right) => left.localeCompare(right))
  const cacheStore = getEvaluableLabelsCacheStore()
  const cacheKey = createEvaluableLabelsCacheKey({
    owner,
    repo,
    labels: normalizedLabels,
  })
  const config = getConfig()

  config.set(EVALUABLE_LABELS_CACHE_KEY, {
    ...cacheStore,
    [cacheKey]: {
      labels: evaluableLabelNames,
      cachedAt: new Date().toISOString(),
    },
  })
}

export function clearEvaluableLabelsCache() {
  const config = getConfig()
  const cacheStore = getEvaluableLabelsCacheStore()
  const clearedCount = Object.keys(cacheStore).length

  config.delete(EVALUABLE_LABELS_CACHE_KEY)

  return clearedCount
}

export function getCachedIssueDifficulties({ owner, repo, items = [] } = {}) {
  const cacheStore = getIssueDifficultyCacheStore()
  const cachedResults = []
  const missedItems = []

  for (const item of items) {
    const cacheKey = createIssueDifficultyCacheKey({
      owner,
      repo,
      categoryName: item.categoryName,
      issue: item.issue,
    })
    const cachedEntry = cacheStore[cacheKey]

    if (!cachedEntry || !cachedEntry.difficulty_level) {
      missedItems.push(item)
      continue
    }

    cachedResults.push({
      categoryName: item.categoryName,
      issue: toIssueSummary(item.issue),
      difficulty: {
        difficulty_level: cachedEntry.difficulty_level,
        estimated_time: cachedEntry.estimated_time || 'Unknown',
        reasoning: cachedEntry.reasoning || 'No reasoning provided.',
      },
    })
  }

  return {
    cachedResults,
    missedItems,
  }
}

export function saveIssueDifficultiesToCache({ owner, repo, items = [] } = {}) {
  if (items.length === 0) {
    return
  }

  const config = getConfig()
  const cacheStore = getIssueDifficultyCacheStore()
  const nextCacheStore = {
    ...cacheStore,
  }
  const cachedAt = new Date().toISOString()

  for (const item of items) {
    if (!item?.difficulty || item.difficulty.error) {
      continue
    }

    const cacheKey = createIssueDifficultyCacheKey({
      owner,
      repo,
      categoryName: item.categoryName,
      issue: item.issue,
    })

    nextCacheStore[cacheKey] = {
      difficulty_level: item.difficulty.difficulty_level,
      estimated_time: item.difficulty.estimated_time,
      reasoning: item.difficulty.reasoning,
      cachedAt,
    }
  }

  config.set(ISSUE_DIFFICULTY_CACHE_KEY, nextCacheStore)
}

export function clearIssueDifficultyCache() {
  const config = getConfig()
  const cacheStore = getIssueDifficultyCacheStore()
  const clearedCount = Object.keys(cacheStore).length

  config.delete(ISSUE_DIFFICULTY_CACHE_KEY)

  return clearedCount
}
