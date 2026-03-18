import chalk from 'chalk'
import {
  difficultyIssuesByAI,
  filterEvaluableLabelsByAI,
} from '../../api/issue.js'
import { t } from '../../i18n/index.js'
import {
  getCachedEvaluableLabels,
  getCachedIssueDifficulties,
  saveEvaluableLabelsToCache,
  saveIssueDifficultiesToCache,
} from '../../utils/ai-cache.js'
import { chunkItems } from '../../utils/analyze.js'
import {
  createProgressBar,
  createSpinner,
} from '../../utils/loading.js'
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
    console.log(t('difficulty.log.loadedEvaluableLabelsCache', {
      count: cachedEvaluableLabels.length,
    }))
    return cachedEvaluableLabels
  }

  const spinner = createSpinner(t('difficulty.spinner.filterLabels'))
  const evaluableLabels = await filterEvaluableLabelsByAI({ labels })
  spinner.succeed(t('difficulty.spinner.labelsReady', { count: evaluableLabels.length }))
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
  const failureMessages = []

  if (cachedCount > 0) {
    console.log(t('difficulty.log.loadedCache', { count: cachedCount }))
  }

  const progressBar = createProgressBar({
    total: missedItems.length,
    format: t('difficulty.progress.format'),
  })
  const spinner = missedItems.length > 0
    ? createSpinner(t('difficulty.spinner.start', { total: missedItems.length }))
    : null
  let finishedCount = 0

  for (const [index, issueBatch] of issueBatches.entries()) {
    if (spinner) {
      spinner.text = t('difficulty.spinner.batch', {
        current: index + 1,
        total: issueBatches.length,
      })
    }

    const batchResults = []

    for (const issueItem of issueBatch) {
      if (spinner) {
        spinner.text = t('difficulty.spinner.issue', {
          issueNumber: issueItem.issue.number,
          current: finishedCount + 1,
          total: missedItems.length,
        })
      }

      const difficulty = await difficultyIssuesByAI({
        issue: issueItem.issue,
        categoryName: issueItem.categoryName,
        repoContext: repoContext || `${owner}/${repo}`,
      })
      finishedCount += 1
      progressBar?.update(finishedCount)
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
        failureMessages.push(t('difficulty.error.issueFailed', {
          issueNumber: issueItem.issue.number,
          message: difficulty.error,
        }))
      }
    }

    saveIssueDifficultiesToCache({
      owner,
      repo,
      items: batchResults,
    })
  }

  progressBar?.stop()

  if (spinner) {
    spinner.succeed(t('difficulty.spinner.completed', { count: missedItems.length }))
  }

  for (const message of failureMessages) {
    console.log(chalk.yellow(message))
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
