import fs from 'node:fs'
import inquirer from 'inquirer'
import { listAllLabelsForRepository, listAllOpenRepositoryIssues } from '../../api/github.js'
import {
  getAiConfig,
  getConfig,
  GITHUB_TOKEN_KEY,
  hasCompleteAiConfig,
} from '../../utils/config.js'
import { generateCategoryMDContent } from '../../utils/markdown.js'
import { categorizeRepositoryIssues } from './issue-classification.js'

export async function analyzeAction() {
  const config = getConfig()
  const token = config.get(GITHUB_TOKEN_KEY)
  const aiConfig = getAiConfig()

  if (!token || !hasCompleteAiConfig(aiConfig)) {
    const missingKeys = []

    if (!token) {
      missingKeys.push('GitHub Personal Access Token')
    }

    if (!aiConfig.baseUrl) {
      missingKeys.push('AI Base URL')
    }

    if (!aiConfig.model) {
      missingKeys.push('AI Model')
    }

    if (!aiConfig.apiKey) {
      missingKeys.push('AI API Key')
    }

    console.log(`Please run \`gia config\` to save the required config: ${missingKeys.join(', ')}`)
    return
  }

  const owner = await inquirer.prompt([
    {
      type: 'input',
      name: 'owner',
      message: 'Enter the owner of the repository:',
      validate: input => !!input || 'Please enter the owner of the repository.',
    },
  ])

  const repo = await inquirer.prompt([
    {
      type: 'input',
      name: 'repo',
      message: 'Enter the repository name:',
      validate: input => !!input || 'Please enter the repository name.',
    },
  ])

  const finalParams = {
    owner: owner.owner,
    repo: repo.repo,
  }

  console.log('Fetching issues...\n')

  try {
    const labels = await listAllLabelsForRepository({
      owner: finalParams.owner,
      repo: finalParams.repo,
      token,
    })
    const issues = await listAllOpenRepositoryIssues({
      owner: finalParams.owner,
      repo: finalParams.repo,
      token,
    })
    if (issues.length === 0) {
      console.log('No open issues found.')
      return
    }

    const finalResult = await categorizeRepositoryIssues({
      owner: finalParams.owner,
      repo: finalParams.repo,
      labels,
      issues,
    })

    const outputPath = `./${finalParams.owner}-${finalParams.repo}-issue-report.md`
    fs.writeFileSync(outputPath, generateCategoryMDContent(finalResult))
    console.log(`Issue report generated: ${outputPath}`)
  }
  catch (error) {
    console.error('Failed to analyze issues:', error.message)
  }
}
