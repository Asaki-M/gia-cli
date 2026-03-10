#!/usr/bin/env node

import { Command } from 'commander'
import { analyzeAction, configAction, configGetAction } from '../src/commands/index.js'

const program = new Command()

program
  .name('gia')
  .version('1.0.0')
  .description('A CLI tool for analyzing repository issues.')

program.action(analyzeAction)

const configCommand = program
  .command('config')
  .description('Configure GitHub token and Gemini API key.')
  .option('-t, --token <token>', 'GitHub Personal Access Token')
  .option('-g, --gemini-key <geminiKey>', 'Gemini API Key')
  .action(configAction)

configCommand
  .command('get')
  .description('Show saved GitHub token and Gemini API key.')
  .option('-s, --show', 'Show full values instead of masked output.')
  .action(configGetAction)

program.parse(process.argv)
