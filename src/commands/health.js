import fs from 'node:fs'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { generateHealthReport } from '../api/health-report.js'
import { analyzeRepositoryHealthByGraphQL } from '../api/health.js'
import {
  getConfig,
  GITHUB_TOKEN_KEY,
} from '../utils/config.js'
import { createSpinner } from '../utils/loading.js'

const DEFAULT_LOOKBACK_DAYS = 90
const DEFAULT_ACTIVE_COMMENT_THRESHOLD = 3

function normalizeInputValue(value) {
  return value?.toString().trim() || ''
}

function parsePositiveInteger(value, fallbackValue) {
  const parsedValue = Number.parseInt(value, 10)
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue
}

function normalizeAiReportArray(values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return ['N/A']
  }

  return values
}

function isAiFallbackReport(aiReport = {}) {
  const risks = Array.isArray(aiReport?.risks) ? aiReport.risks : []
  return risks.some(risk => typeof risk === 'string' && risk.startsWith('AI diagnosis failed:'))
}

function buildHealthReportMarkdown({ owner, repo, aiReport = {}, metrics = {} } = {}) {
  const strengths = normalizeAiReportArray(aiReport.strengths)
  const risks = normalizeAiReportArray(aiReport.risks)

  return [
    '# Repository Health AI Report',
    '',
    `Repository: ${owner}/${repo}`,
    '',
    `Health Grade: ${aiReport.health_grade || 'N/A'}`,
    '',
    '## Summary',
    aiReport.summary || 'N/A',
    '',
    '## Strengths',
    ...strengths.map(item => `- ${item}`),
    '',
    '## Risks',
    ...risks.map(item => `- ${item}`),
    '',
    '## Contribution Advice',
    aiReport.contribution_advice || 'N/A',
    '',
    '## Metadata',
    '```json',
    JSON.stringify(metrics, null, 2),
    '```',
  ].join('\n')
}

async function promptRepositoryParams(owner, repo) {
  const questions = []

  if (!owner) {
    questions.push({
      type: 'input',
      name: 'owner',
      message: 'Enter the owner of the repository:',
      validate: input => !!normalizeInputValue(input) || 'Please enter the owner of the repository.',
    })
  }

  if (!repo) {
    questions.push({
      type: 'input',
      name: 'repo',
      message: 'Enter the repository name:',
      validate: input => !!normalizeInputValue(input) || 'Please enter the repository name.',
    })
  }

  if (questions.length === 0) {
    return {
      owner,
      repo,
    }
  }

  const answers = await inquirer.prompt(questions)

  return {
    owner: owner || normalizeInputValue(answers.owner),
    repo: repo || normalizeInputValue(answers.repo),
  }
}

export async function healthAction(commandOptions = {}) {
  const config = getConfig()
  const token = normalizeInputValue(config.get(GITHUB_TOKEN_KEY))

  if (!token) {
    console.log(chalk.yellow('Please run `gia config` to save GitHub Personal Access Token.'))
    return
  }

  const inputOwner = normalizeInputValue(commandOptions.owner)
  const inputRepo = normalizeInputValue(commandOptions.repo)
  const lookbackDays = parsePositiveInteger(commandOptions.days, DEFAULT_LOOKBACK_DAYS)
  const activeCommentThreshold = parsePositiveInteger(commandOptions.commentThreshold, DEFAULT_ACTIVE_COMMENT_THRESHOLD)

  const finalParams = await promptRepositoryParams(inputOwner, inputRepo)

  console.log(
    chalk.cyan(`Running health analysis for ${finalParams.owner}/${finalParams.repo} (last ${lookbackDays} days)...`),
  )

  let metricsSpinner
  let aiSpinner
  let writeSpinner

  try {
    metricsSpinner = createSpinner('Collecting repository health metrics...')
    const healthMetrics = await analyzeRepositoryHealthByGraphQL({
      owner: finalParams.owner,
      repo: finalParams.repo,
      token,
      lookbackDays,
      activeCommentThreshold,
    })
    metricsSpinner.succeed('Repository health metrics collected.')

    aiSpinner = createSpinner('Generating AI health diagnosis...')
    const aiReport = await generateHealthReport({
      healthData: healthMetrics,
    })

    if (isAiFallbackReport(aiReport)) {
      aiSpinner.warn('AI diagnosis fallback used (report still generated).')
    }
    else {
      aiSpinner.succeed('AI health diagnosis generated.')
    }

    const reportContent = buildHealthReportMarkdown({
      owner: finalParams.owner,
      repo: finalParams.repo,
      aiReport,
      metrics: healthMetrics,
    })
    const outputPath = `./${finalParams.owner}-${finalParams.repo}-health-report.md`

    writeSpinner = createSpinner('Writing health report file...')
    fs.writeFileSync(outputPath, reportContent)
    writeSpinner.succeed(`Health report written to ${outputPath}`)

    console.log(chalk.green(`Health report generated: ${outputPath}`))
  }
  catch (error) {
    if (metricsSpinner?.isSpinning) {
      metricsSpinner.fail('Failed to collect repository health metrics.')
    }

    if (aiSpinner?.isSpinning) {
      aiSpinner.fail('Failed to generate AI health diagnosis.')
    }

    if (writeSpinner?.isSpinning) {
      writeSpinner.fail('Failed to write health report file.')
    }

    console.error(chalk.red(`Failed to analyze repository health: ${error.message}`))
  }
}
