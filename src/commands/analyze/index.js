import fs from 'node:fs'
import inquirer from 'inquirer'
import { getRepositoryBasicInfo, listAllLabelsForRepository, listAllOpenRepositoryIssues } from '../../api/github.js'
import {
  getAiConfig,
  getConfig,
  GITHUB_TOKEN_KEY,
  hasCompleteAiConfig,
} from '../../utils/config.js'
import { normalizeIssues } from '../../utils/index.js'
import {
  generateCategoryMDContent,
  generateDifficultyMDContent,
} from '../../utils/markdown.js'
import { categorizeRepositoryIssues } from './issue-classification.js'
import { estimateRepositoryIssuesDifficulty } from './issue-difficulty.js'

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
    const basicRepoInfo = await getRepositoryBasicInfo({
      owner: finalParams.owner,
      repo: finalParams.repo,
      token,
    })

    if (issues.length === 0) {
      console.log('No open issues found.')
    }

    const finalResult = await categorizeRepositoryIssues({
      owner: finalParams.owner,
      repo: finalParams.repo,
      labels,
      issues,
    })
    const categorizedIssues = normalizeIssues({
      origins: issues,
      issues: finalResult.categorizedIssues,
    })
    const uncategorizedIssues = normalizeIssues({
      origins: issues,
      issues: finalResult.uncategorizedIssues,
    })
    const difficultyResults = await estimateRepositoryIssuesDifficulty({
      owner: finalParams.owner,
      repo: finalParams.repo,
      labels,
      categorizedIssues,
      uncategorizedIssues,
      basicRepoInfo,
    })
    const reportContent = [
      generateCategoryMDContent(finalResult),
      generateDifficultyMDContent(difficultyResults),
    ].join('\n\n')
    const outputPath = `./${finalParams.owner}-${finalParams.repo}-issue-report.md`
    fs.writeFileSync(outputPath, reportContent)
    console.log(`Issue report generated: ${outputPath}`)
  }
  catch (error) {
    console.error('Failed to analyze issues:', error.message)
  }
}
