import fs from 'node:fs'
import inquirer from 'inquirer'
import {
  getRepositoryBasicInfo,
  listAllLabelsForRepository,
  listAllOpenRepositoryIssues,
  listOpenRepositoryIssuesWithLimit,
} from '../../api/github.js'
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

const DEFAULT_ISSUE_LIMIT = 30

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

  const issueRange = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'mode',
      message: 'Select issue analysis range:',
      default: 'default',
      choices: [
        {
          name: `First ${DEFAULT_ISSUE_LIMIT} issues (default)`,
          value: 'default',
        },
        {
          name: 'Custom issue limit',
          value: 'custom',
        },
        {
          name: 'All open issues',
          value: 'all',
        },
      ],
    },
    {
      type: 'input',
      name: 'limit',
      message: 'Enter issue limit:',
      when: answers => answers.mode === 'custom',
      validate: (input) => {
        const parsedValue = Number.parseInt(input, 10)
        return Number.isInteger(parsedValue) && parsedValue > 0
          ? true
          : 'Please enter a positive integer.'
      },
      filter: input => Number.parseInt(input, 10),
    },
    {
      type: 'input',
      name: 'page',
      message: 'Enter issue page (1-based):',
      default: 1,
      when: answers => answers.mode !== 'all',
      validate: (input) => {
        const parsedValue = Number.parseInt(input, 10)
        return Number.isInteger(parsedValue) && parsedValue > 0
          ? true
          : 'Please enter a positive integer.'
      },
      filter: input => Number.parseInt(input, 10),
    },
  ])
  const analyzeAllIssues = issueRange.mode === 'all'
  const issueLimit = issueRange.mode === 'custom' ? issueRange.limit : DEFAULT_ISSUE_LIMIT
  const issuePage = issueRange.mode === 'all' ? 1 : issueRange.page
  const issueOffset = (issuePage - 1) * issueLimit

  console.log('Fetching issues...\n')

  try {
    const listOpenRepositoryIssues = analyzeAllIssues
      ? listAllOpenRepositoryIssues
      : listOpenRepositoryIssuesWithLimit
    const [labels, basicRepoInfo, issuesToAnalyze] = await Promise.all([
      listAllLabelsForRepository({
        owner: finalParams.owner,
        repo: finalParams.repo,
        token,
      }),
      getRepositoryBasicInfo({
        owner: finalParams.owner,
        repo: finalParams.repo,
        token,
      }),
      listOpenRepositoryIssues({
        owner: finalParams.owner,
        repo: finalParams.repo,
        token,
        limit: issueLimit,
        offset: issueOffset,
      }),
    ])

    if (issuesToAnalyze.length === 0) {
      if (!analyzeAllIssues && issueOffset > 0) {
        const rangeStart = issueOffset + 1
        const rangeEnd = issueOffset + issueLimit
        console.log(`No open issues found in selected range: ${rangeStart}-${rangeEnd}.`)
      }
      else {
        console.log('No open issues found.')
      }
      return
    }

    if (analyzeAllIssues) {
      console.log(`Analyzing all ${issuesToAnalyze.length} open issues.`)
    }
    else {
      const rangeStart = issueOffset + 1
      const rangeEnd = issueOffset + issuesToAnalyze.length
      console.log(`Analyzing open issues ${rangeStart}-${rangeEnd} (limit: ${issueLimit}, page: ${issuePage}).`)
    }

    const finalResult = await categorizeRepositoryIssues({
      owner: finalParams.owner,
      repo: finalParams.repo,
      labels,
      issues: issuesToAnalyze,
    })
    const categorizedIssues = normalizeIssues({
      origins: issuesToAnalyze,
      issues: finalResult.categorizedIssues,
    })
    const uncategorizedIssues = normalizeIssues({
      origins: issuesToAnalyze,
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
