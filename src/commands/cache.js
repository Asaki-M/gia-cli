import chalk from 'chalk'
import { t } from '../i18n/index.js'
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
    console.log(chalk.yellow(t('cache.log.noCache')))
    return
  }

  const entryWord = totalClearedCount === 1
    ? t('cache.log.entrySingular')
    : t('cache.log.entryPlural')

  console.log(chalk.green([
    t('cache.log.summary', { count: totalClearedCount, entryWord }),
    t('cache.log.issueClassifications', { count: clearedClassificationCount }),
    t('cache.log.evaluableLabels', { count: clearedEvaluableLabelsCount }),
    t('cache.log.issueDifficulties', { count: clearedDifficultyCount }),
  ].join(' ')))
}
