import chalk from 'chalk'
import { categorizedIssuesByAI } from '../../api/issue.js'
import { t } from '../../i18n/index.js'
import {
  getCachedIssueClassifications,
  saveIssueClassificationsToCache,
} from '../../utils/ai-cache.js'
import {
  categorizeIssueByLabels,
  chunkItems,
  mergeCategorizedIssuesResults,
} from '../../utils/analyze.js'
import {
  createProgressBar,
  createSpinner,
} from '../../utils/loading.js'

export async function categorizeRepositoryIssues({ owner, repo, labels = [], issues = [] } = {}) {
  const labelsNameList = labels.map(label => label.name)
  const localResult = categorizeIssueByLabels({ labels: labelsNameList, issues })
  const { cachedResult, missedIssues } = getCachedIssueClassifications({
    owner,
    repo,
    labels: labelsNameList,
    issues: localResult.uncategorizedIssues,
  })
  const cachedCount = localResult.uncategorizedIssues.length - missedIssues.length
  const issueBatches = chunkItems(missedIssues, 20)
  const aiResults = []
  const failureMessages = []

  if (cachedCount > 0) {
    console.log(t('classification.log.loadedCache', { count: cachedCount }))
  }

  const progressBar = createProgressBar({
    total: issueBatches.length,
    format: t('classification.progress.format'),
  })
  const spinner = issueBatches.length > 0
    ? createSpinner(t('classification.spinner.batch', { current: 1, total: issueBatches.length }))
    : null

  for (const [index, issueBatch] of issueBatches.entries()) {
    if (spinner) {
      spinner.text = t('classification.spinner.batch', { current: index + 1, total: issueBatches.length })
    }

    const aiResult = await categorizedIssuesByAI({
      labels: labelsNameList,
      issues: issueBatch,
    })

    aiResults.push(aiResult)

    if (!aiResult.error) {
      saveIssueClassificationsToCache({
        owner,
        repo,
        labels: labelsNameList,
        result: aiResult,
      })
    }
    else {
      failureMessages.push(t('classification.error.batchFailed', {
        current: index + 1,
        total: issueBatches.length,
        message: aiResult.error,
      }))
    }

    progressBar?.increment()
  }

  progressBar?.stop()

  if (spinner) {
    spinner.succeed(t('classification.spinner.completed', { count: issueBatches.length }))
  }

  for (const message of failureMessages) {
    console.log(chalk.yellow(message))
  }

  return mergeCategorizedIssuesResults(localResult, cachedResult, ...aiResults)
}
