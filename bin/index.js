#!/usr/bin/env node

import { Command } from 'commander'
import { analyzeAction, cacheClearAction, configAction, configGetAction } from '../src/commands/index.js'

const program = new Command()

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
  .description('Manage cached AI issue classifications.')

cacheCommand
  .command('clear')
  .description('Clear cached AI issue classifications.')
  .action(cacheClearAction)

program.parse(process.argv)
