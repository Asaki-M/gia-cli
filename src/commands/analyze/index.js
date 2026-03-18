import fs from 'node:fs'
import inquirer from 'inquirer'
import {
  getRepositoryBasicInfo,
  listAllLabelsForRepository,
  listAllOpenRepositoryIssues,
  listOpenRepositoryIssuesWithLimit,
} from '../../api/github.js'
import { t } from '../../i18n/index.js'
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
      missingKeys.push(t('analyze.config.githubToken'))
    }

    if (!aiConfig.baseUrl) {
      missingKeys.push(t('analyze.config.aiBaseUrl'))
    }

    if (!aiConfig.model) {
      missingKeys.push(t('analyze.config.aiModel'))
    }

    if (!aiConfig.apiKey) {
      missingKeys.push(t('analyze.config.aiApiKey'))
    }

    console.log(t('analyze.error.missingConfig', { keys: missingKeys.join(', ') }))
    return
  }

  const owner = await inquirer.prompt([
    {
      type: 'input',
      name: 'owner',
      message: t('analyze.prompt.owner'),
      validate: input => !!input || t('analyze.prompt.owner.required'),
    },
  ])

  const repo = await inquirer.prompt([
    {
      type: 'input',
      name: 'repo',
      message: t('analyze.prompt.repo'),
      validate: input => !!input || t('analyze.prompt.repo.required'),
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
      message: t('analyze.prompt.range'),
      default: 'default',
      choices: [
        {
          name: t('analyze.prompt.range.default', { limit: DEFAULT_ISSUE_LIMIT }),
          value: 'default',
        },
        {
          name: t('analyze.prompt.range.custom'),
          value: 'custom',
        },
        {
          name: t('analyze.prompt.range.all'),
          value: 'all',
        },
      ],
    },
    {
      type: 'input',
      name: 'limit',
      message: t('analyze.prompt.limit'),
      when: answers => answers.mode === 'custom',
      validate: (input) => {
        const parsedValue = Number.parseInt(input, 10)
        return Number.isInteger(parsedValue) && parsedValue > 0
          ? true
          : t('common.positiveInteger')
      },
      filter: input => Number.parseInt(input, 10),
    },
    {
      type: 'input',
      name: 'page',
      message: t('analyze.prompt.page'),
      default: 1,
      when: answers => answers.mode !== 'all',
      validate: (input) => {
        const parsedValue = Number.parseInt(input, 10)
        return Number.isInteger(parsedValue) && parsedValue > 0
          ? true
          : t('common.positiveInteger')
      },
      filter: input => Number.parseInt(input, 10),
    },
  ])
  const analyzeAllIssues = issueRange.mode === 'all'
  const issueLimit = issueRange.mode === 'custom' ? issueRange.limit : DEFAULT_ISSUE_LIMIT
  const issuePage = issueRange.mode === 'all' ? 1 : issueRange.page
  const issueOffset = (issuePage - 1) * issueLimit

  console.log(t('analyze.log.fetchingIssues'))

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
        console.log(t('analyze.log.noIssuesRange', {
          start: rangeStart,
          end: rangeEnd,
        }))
      }
      else {
        console.log(t('analyze.log.noIssues'))
      }
      return
    }

    if (analyzeAllIssues) {
      console.log(t('analyze.log.analyzingAll', { count: issuesToAnalyze.length }))
    }
    else {
      const rangeStart = issueOffset + 1
      const rangeEnd = issueOffset + issuesToAnalyze.length
      console.log(t('analyze.log.analyzingRange', {
        start: rangeStart,
        end: rangeEnd,
        limit: issueLimit,
        page: issuePage,
      }))
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
    console.log(t('analyze.log.reportGenerated', { path: outputPath }))
  }
  catch (error) {
    console.error(t('analyze.error.failed', { message: error.message }))
  }
}
