import chalk from 'chalk'
import { categorizedIssuesByAI } from '../../api/issue.js'
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
    console.log(`Loaded ${cachedCount} issue classifications from cache.`)
  }

  const progressBar = createProgressBar({
    total: issueBatches.length,
    format: 'Issue classification |{bar}| {value}/{total} batches',
  })
  const spinner = issueBatches.length > 0
    ? createSpinner(`Classifying issue batch 1/${issueBatches.length} with AI...`)
    : null

  for (const [index, issueBatch] of issueBatches.entries()) {
    if (spinner) {
      spinner.text = `Classifying issue batch ${index + 1}/${issueBatches.length} with AI...`
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
      failureMessages.push(`Failed to classify issue batch ${index + 1}/${issueBatches.length} with AI. Message: ${aiResult.error}`)
    }

    progressBar?.increment()
  }

  progressBar?.stop()

  if (spinner) {
    spinner.succeed(`Issue classification completed (${issueBatches.length} batches).`)
  }

  for (const message of failureMessages) {
    console.log(chalk.yellow(message))
  }

  return mergeCategorizedIssuesResults(localResult, cachedResult, ...aiResults)
}
