import chalk from 'chalk'
import { clearIssueClassificationCache } from '../utils/ai-cache.js'

export function cacheClearAction() {
  const clearedCount = clearIssueClassificationCache()

  if (clearedCount === 0) {
    console.log(chalk.yellow('No AI classification cache found.'))
    return
  }

  console.log(chalk.green(`Cleared ${clearedCount} AI classification cache entr${clearedCount === 1 ? 'y' : 'ies'}.`))
}
