import chalk from 'chalk'
import {
  difficultyIssuesByAI,
  filterEvaluableLabelsByAI,
} from '../../api/issue.js'
import {
  getCachedEvaluableLabels,
  getCachedIssueDifficulties,
  saveEvaluableLabelsToCache,
  saveIssueDifficultiesToCache,
} from '../../utils/ai-cache.js'
import { chunkItems } from '../../utils/analyze.js'
import { buildRepoContextForAI } from '../../utils/prompt.js'

function normalizeCategoryName(name) {
  return name?.trim() || 'uncategorized'
}

function normalizeCategoryItems(items = [], fallbackCategoryName = 'uncategorized') {
  const normalizedItems = []

  for (const item of items) {
    if (Array.isArray(item?.issues)) {
      const categoryName = normalizeCategoryName(item?.name)

      for (const issue of item.issues) {
        normalizedItems.push({
          categoryName,
          issue,
        })
      }

      continue
    }

    if (typeof item?.number === 'number') {
      normalizedItems.push({
        categoryName: fallbackCategoryName,
        issue: item,
      })
    }
  }

  return normalizedItems
}

function isIssueUnassigned(issue = {}) {
  if (Array.isArray(issue.assignees)) {
    return issue.assignees.length === 0
  }

  return !issue.assignee
}

function isIssueUnlocked(issue = {}) {
  return !issue.locked
}

function filterIssueItemsByStatus(items = []) {
  return items.filter(item => isIssueUnassigned(item.issue) && isIssueUnlocked(item.issue))
}

async function getEvaluableLabels({ owner, repo, labels = [] } = {}) {
  const cachedEvaluableLabels = getCachedEvaluableLabels({ owner, repo, labels })

  if (cachedEvaluableLabels !== null) {
    console.log(`Loaded ${cachedEvaluableLabels.length} evaluable labels from cache.`)
    return cachedEvaluableLabels
  }

  const evaluableLabels = await filterEvaluableLabelsByAI({ labels })
  saveEvaluableLabelsToCache({
    owner,
    repo,
    labels,
    evaluableLabels,
  })

  return evaluableLabels
}

function filterIssueItemsByEvaluableLabels({ items = [], evaluableLabels = [] } = {}) {
  if (items.length === 0 || evaluableLabels.length === 0) {
    return []
  }

  const evaluableLabelNameSet = new Set(evaluableLabels.map(label => label.name))
  return items.filter(item => evaluableLabelNameSet.has(item.categoryName))
}

async function estimateIssueDifficulties({
  owner,
  repo,
  issueItems = [],
  repoContext = '',
} = {}) {
  if (issueItems.length === 0) {
    return []
  }

  const { cachedResults, missedItems } = getCachedIssueDifficulties({
    owner,
    repo,
    items: issueItems,
  })
  const cachedCount = cachedResults.length
  const issueBatches = chunkItems(missedItems, 10)
  const aiResults = []

  if (cachedCount > 0) {
    console.log(`Loaded ${cachedCount} issue difficulties from cache.`)
  }

  for (const [index, issueBatch] of issueBatches.entries()) {
    console.log(`Evaluating issue difficulty batch ${index + 1}/${issueBatches.length} with AI...`)
    const batchResults = []

    for (const issueItem of issueBatch) {
      const difficulty = await difficultyIssuesByAI({
        issue: issueItem.issue,
        categoryName: issueItem.categoryName,
        repoContext: repoContext || `${owner}/${repo}`,
      })
      const result = {
        categoryName: issueItem.categoryName,
        issue: issueItem.issue,
        difficulty,
      }

      aiResults.push({
        ...result,
        issue: {
          number: issueItem.issue.number,
          title: issueItem.issue.title,
        },
      })

      if (!difficulty.error) {
        batchResults.push(result)
      }
      else {
        console.log(chalk.yellow(`Failed to evaluate issue #${issueItem.issue.number} difficulty with AI. Message: ${difficulty.error}`))
      }
    }

    saveIssueDifficultiesToCache({
      owner,
      repo,
      items: batchResults,
    })
  }

  return [
    ...cachedResults,
    ...aiResults,
  ]
}

export async function estimateRepositoryIssuesDifficulty({
  owner,
  repo,
  labels = [],
  categorizedIssues = [],
  uncategorizedIssues = [],
  basicRepoInfo = {},
} = {}) {
  const evaluableLabels = await getEvaluableLabels({
    owner,
    repo,
    labels,
  })

  if (evaluableLabels.length === 0) {
    return []
  }

  const repoContext = buildRepoContextForAI(basicRepoInfo)

  const categorizedIssueItems = normalizeCategoryItems(categorizedIssues)
  const uncategorizedIssueItems = normalizeCategoryItems(uncategorizedIssues)
  const issueItems = filterIssueItemsByStatus([
    ...categorizedIssueItems,
    ...uncategorizedIssueItems,
  ])
  const filteredIssueItems = filterIssueItemsByEvaluableLabels({
    items: issueItems,
    evaluableLabels,
  })

  return estimateIssueDifficulties({
    owner,
    repo,
    issueItems: filteredIssueItems,
    repoContext,
  })
}
