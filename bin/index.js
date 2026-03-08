#!/usr/bin/env node

import { Command } from 'commander'
import { analyzeAction, configAction } from '../src/commands/index.js'

const program = new Command()

program
  .name('gia')
  .version('1.0.0')
  .description('A CLI tool for analyzing repository issues.')

// TODO: Issue 自动分类,Issue 难度评估,推荐可以贡献的 Issue,项目健康度分析

program.action(analyzeAction)

program
  .command('config')
  .description('Configure GitHub token and Gemini API key.')
  .option('-t, --token <token>', 'GitHub Personal Access Token')
  .option('-g, --gemini-key <geminiKey>', 'Gemini API Key')
  .action(configAction)

program.parse(process.argv)
