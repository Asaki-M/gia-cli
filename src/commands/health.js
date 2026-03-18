import fs from 'node:fs'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { generateHealthReport } from '../api/health-report.js'
import { analyzeRepositoryHealthByGraphQL } from '../api/health.js'
import { t } from '../i18n/index.js'
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
    return [t('common.na')]
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
    t('health.aiReport.title'),
    '',
    t('health.aiReport.repository', { owner, repo }),
    '',
    t('health.aiReport.grade', { value: aiReport.health_grade || t('common.na') }),
    '',
    t('health.aiReport.summary'),
    aiReport.summary || t('common.na'),
    '',
    t('health.aiReport.strengths'),
    ...strengths.map(item => `- ${item}`),
    '',
    t('health.aiReport.risks'),
    ...risks.map(item => `- ${item}`),
    '',
    t('health.aiReport.contributionAdvice'),
    aiReport.contribution_advice || t('common.na'),
    '',
    t('health.aiReport.metadata'),
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
      message: t('health.prompt.owner'),
      validate: input => !!normalizeInputValue(input) || t('health.prompt.owner.required'),
    })
  }

  if (!repo) {
    questions.push({
      type: 'input',
      name: 'repo',
      message: t('health.prompt.repo'),
      validate: input => !!normalizeInputValue(input) || t('health.prompt.repo.required'),
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
    console.log(chalk.yellow(t('health.error.missingToken')))
    return
  }

  const inputOwner = normalizeInputValue(commandOptions.owner)
  const inputRepo = normalizeInputValue(commandOptions.repo)
  const lookbackDays = parsePositiveInteger(commandOptions.days, DEFAULT_LOOKBACK_DAYS)
  const activeCommentThreshold = parsePositiveInteger(commandOptions.commentThreshold, DEFAULT_ACTIVE_COMMENT_THRESHOLD)

  const finalParams = await promptRepositoryParams(inputOwner, inputRepo)

  console.log(
    chalk.cyan(t('health.log.running', {
      owner: finalParams.owner,
      repo: finalParams.repo,
      days: lookbackDays,
    })),
  )

  let metricsSpinner
  let aiSpinner
  let writeSpinner

  try {
    metricsSpinner = createSpinner(t('health.spinner.collectMetrics'))
    const healthMetrics = await analyzeRepositoryHealthByGraphQL({
      owner: finalParams.owner,
      repo: finalParams.repo,
      token,
      lookbackDays,
      activeCommentThreshold,
    })
    metricsSpinner.succeed(t('health.spinner.metricsCollected'))

    aiSpinner = createSpinner(t('health.spinner.generateDiagnosis'))
    const aiReport = await generateHealthReport({
      healthData: healthMetrics,
    })

    if (isAiFallbackReport(aiReport)) {
      aiSpinner.warn(t('health.spinner.diagnosisFallback'))
    }
    else {
      aiSpinner.succeed(t('health.spinner.diagnosisGenerated'))
    }

    const reportContent = buildHealthReportMarkdown({
      owner: finalParams.owner,
      repo: finalParams.repo,
      aiReport,
      metrics: healthMetrics,
    })
    const outputPath = `./${finalParams.owner}-${finalParams.repo}-health-report.md`

    writeSpinner = createSpinner(t('health.spinner.writeReport'))
    fs.writeFileSync(outputPath, reportContent)
    writeSpinner.succeed(t('health.spinner.reportWritten', { path: outputPath }))

    console.log(chalk.green(t('health.log.reportGenerated', { path: outputPath })))
  }
  catch (error) {
    if (metricsSpinner?.isSpinning) {
      metricsSpinner.fail(t('health.spinner.collectMetricsFailed'))
    }

    if (aiSpinner?.isSpinning) {
      aiSpinner.fail(t('health.spinner.diagnosisFailed'))
    }

    if (writeSpinner?.isSpinning) {
      writeSpinner.fail(t('health.spinner.writeFailed'))
    }

    console.error(chalk.red(t('health.error.failed', { message: error.message })))
  }
}
