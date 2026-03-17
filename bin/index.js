#!/usr/bin/env node

import chalk from 'chalk'
import { Command } from 'commander'
import {
  analyzeAction,
  cacheClearAction,
  configAction,
  configGetAction,
  healthAction,
} from '../src/commands/index.js'

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
    handleInterrupt('Command interrupted by user (SIGINT).', 130)
  })

  process.on('SIGTERM', () => {
    handleInterrupt('Command interrupted by system (SIGTERM).', 143)
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
  .description('A CLI tool for analyzing repository issues.')

program.action(analyzeAction)

const configCommand = program
  .command('config')
  .description('Configure GitHub token and AI config.')
  .option('-t, --token <token>', 'GitHub Personal Access Token')
  .option('-b, --ai-base-url <aiBaseUrl>', 'AI Base URL')
  .option('-m, --ai-model <aiModel>', 'AI model')
  .option('-k, --ai-api-key <aiApiKey>', 'AI API Key')
  .action(configAction)

configCommand
  .command('get')
  .description('Show saved GitHub token and AI config.')
  .option('-s, --show', 'Show full values instead of masked output.')
  .action(configGetAction)

const cacheCommand = program
  .command('cache')
  .description('Manage cached AI analysis results.')

cacheCommand
  .command('clear')
  .description('Clear cached AI analysis results.')
  .action(cacheClearAction)

program
  .command('health')
  .description('Analyze repository health metrics using GitHub GraphQL data.')
  .option('-o, --owner <owner>', 'Repository owner')
  .option('-r, --repo <repo>', 'Repository name')
  .option('-d, --days <days>', 'Lookback window in days (default: 90)')
  .option('-c, --comment-threshold <commentThreshold>', 'Minimum comments to count as an active commenter (default: 3)')
  .action(healthAction)

program.parseAsync(process.argv).catch((error) => {
  if (isPromptInterruptError(error)) {
    handleInterrupt('Command interrupted by user.', 130)
    return
  }

  process.stderr.write(`\n${chalk.red(`Unexpected error: ${error.message}`)}\n`)
  process.exit(1)
})
