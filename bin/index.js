#!/usr/bin/env node

import chalk from 'chalk'
import { Command } from 'commander'
import {
  analyzeAction,
  cacheClearAction,
  configAction,
  configGetAction,
  healthAction,
  langAction,
} from '../src/commands/index.js'
import { t } from '../src/i18n/index.js'

let hasHandledInterrupt = false

function handleInterrupt(message, exitCode = 130) {
  if (hasHandledInterrupt) {
    return
  }

  hasHandledInterrupt = true
  process.stderr.write(`\n${chalk.yellow(message)}\n`)
  process.exit(exitCode)
}

function registerInterruptHandlers() {
  process.on('SIGINT', () => {
    handleInterrupt(t('cli.interrupt.sigint'), 130)
  })

  process.on('SIGTERM', () => {
    handleInterrupt(t('cli.interrupt.sigterm'), 143)
  })
}

function isPromptInterruptError(error) {
  const errorName = error?.name || ''
  const errorMessage = error?.message || ''

  return errorName === 'ExitPromptError'
    || errorName === 'AbortPromptError'
    || errorMessage.includes('User force closed')
}

const program = new Command()

registerInterruptHandlers()

program
  .name('gia')
  .version('1.0.0')
  .description(t('cli.description'))

program.action(analyzeAction)

const configCommand = program
  .command('config')
  .description(t('command.config.description'))
  .option('-t, --token <token>', t('command.config.option.token'))
  .option('-b, --ai-base-url <aiBaseUrl>', t('command.config.option.aiBaseUrl'))
  .option('-m, --ai-model <aiModel>', t('command.config.option.aiModel'))
  .option('-k, --ai-api-key <aiApiKey>', t('command.config.option.aiApiKey'))
  .action(configAction)

configCommand
  .command('get')
  .description(t('command.config.get.description'))
  .option('-s, --show', t('command.config.get.option.show'))
  .action(configGetAction)

const cacheCommand = program
  .command('cache')
  .description(t('command.cache.description'))

cacheCommand
  .command('clear')
  .description(t('command.cache.clear.description'))
  .action(cacheClearAction)

program
  .command('health')
  .description(t('command.health.description'))
  .option('-o, --owner <owner>', t('command.health.option.owner'))
  .option('-r, --repo <repo>', t('command.health.option.repo'))
  .option('-d, --days <days>', t('command.health.option.days'))
  .option('-c, --comment-threshold <commentThreshold>', t('command.health.option.commentThreshold'))
  .action(healthAction)

program
  .command('lang')
  .description(t('command.lang.description'))
  .option('-s, --set <language>', t('command.lang.option.set'))
  .action(langAction)

program.parseAsync(process.argv).catch((error) => {
  if (isPromptInterruptError(error)) {
    handleInterrupt(t('cli.interrupt.user'), 130)
    return
  }

  process.stderr.write(`\n${chalk.red(t('cli.error.unexpected', { message: error.message }))}\n`)
  process.exit(1)
})
