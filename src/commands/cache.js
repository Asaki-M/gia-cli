import chalk from 'chalk'
import {
  clearEvaluableLabelsCache,
  clearIssueClassificationCache,
  clearIssueDifficultyCache,
} from '../utils/ai-cache.js'

export function cacheClearAction() {
  const clearedClassificationCount = clearIssueClassificationCache()
  const clearedEvaluableLabelsCount = clearEvaluableLabelsCache()
  const clearedDifficultyCount = clearIssueDifficultyCache()
  const totalClearedCount = clearedClassificationCount + clearedEvaluableLabelsCount + clearedDifficultyCount

  if (totalClearedCount === 0) {
    console.log(chalk.yellow('No AI cache found.'))
    return
  }

  console.log(chalk.green([
    `Cleared ${totalClearedCount} AI cache entr${totalClearedCount === 1 ? 'y' : 'ies'}.`,
    `Issue classifications: ${clearedClassificationCount}.`,
    `Evaluable labels: ${clearedEvaluableLabelsCount}.`,
    `Issue difficulties: ${clearedDifficultyCount}.`,
  ].join(' ')))
}
