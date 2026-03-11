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

  if (cachedCount > 0) {
    console.log(`Loaded ${cachedCount} issue classifications from cache.`)
  }

  for (const [index, issueBatch] of issueBatches.entries()) {
    console.log(`Classifying issue batch ${index + 1}/${issueBatches.length} with AI...`)
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
      console.log(chalk.yellow(`Failed to classify issue batch ${index + 1}/${issueBatches.length} with AI. Message: ${aiResult.error}`))
    }
  }

  return mergeCategorizedIssuesResults(localResult, cachedResult, ...aiResults)
}
