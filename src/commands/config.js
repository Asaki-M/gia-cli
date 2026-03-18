import chalk from 'chalk'
import inquirer from 'inquirer'
import { t } from '../i18n/index.js'
import {
  AI_CONFIG_KEY,
  getConfig,
  GITHUB_TOKEN_KEY,
} from '../utils/config.js'

function normalizeInputValue(value) {
  return value?.trim() || ''
}

function normalizeAiConfig(value = {}) {
  const aiConfig = value && typeof value === 'object' ? value : {}

  return {
    baseUrl: normalizeInputValue(aiConfig.baseUrl),
    model: normalizeInputValue(aiConfig.model),
    apiKey: normalizeInputValue(aiConfig.apiKey),
  }
}

function buildAiConfigFromOptions(commandOptions = {}) {
  return normalizeAiConfig({
    baseUrl: commandOptions.aiBaseUrl,
    model: commandOptions.aiModel,
    apiKey: commandOptions.aiApiKey,
  })
}

function getCurrentAiConfig(config) {
  return normalizeAiConfig(config.get(AI_CONFIG_KEY))
}

function keepCurrentValue(inputValue, currentValue) {
  return normalizeInputValue(inputValue) || currentValue
}

function mergeAiConfig(currentAiConfig, nextAiConfig) {
  return normalizeAiConfig({
    baseUrl: nextAiConfig.baseUrl || currentAiConfig.baseUrl,
    model: nextAiConfig.model || currentAiConfig.model,
    apiKey: nextAiConfig.apiKey || currentAiConfig.apiKey,
  })
}

function hasCompleteAiConfig(aiConfig) {
  return Boolean(aiConfig.baseUrl && aiConfig.model && aiConfig.apiKey)
}

function isAiConfigEqual(leftAiConfig, rightAiConfig) {
  return leftAiConfig.baseUrl === rightAiConfig.baseUrl
    && leftAiConfig.model === rightAiConfig.model
    && leftAiConfig.apiKey === rightAiConfig.apiKey
}

function maskSecret(value) {
  if (!value) {
    return chalk.gray(t('common.notSet'))
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`
  }

  return `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`
}

function formatSecret(value, showFullValue = false) {
  if (!value) {
    return chalk.gray(t('common.notSet'))
  }

  return showFullValue ? value : maskSecret(value)
}

function formatValue(value) {
  return value || chalk.gray(t('common.notSet'))
}

function createTokenQuestion(currentGithubToken) {
  return {
    type: 'password',
    name: 'githubTokenInput',
    message: currentGithubToken
      ? t('config.prompt.token.keep')
      : t('config.prompt.token.enter'),
    mask: '*',
    validate: (input) => {
      if (normalizeInputValue(input) || currentGithubToken) {
        return true
      }

      return t('config.validate.token.required')
    },
  }
}

function createAiConfigQuestions(currentAiConfig) {
  return [
    {
      type: 'input',
      name: 'aiBaseUrlInput',
      message: currentAiConfig.baseUrl
        ? t('config.prompt.aiBaseUrl.keep')
        : t('config.prompt.aiBaseUrl.enter'),
      validate: (input) => {
        if (normalizeInputValue(input) || currentAiConfig.baseUrl) {
          return true
        }

        return t('config.validate.aiBaseUrl.required')
      },
    },
    {
      type: 'input',
      name: 'aiModelInput',
      message: currentAiConfig.model
        ? t('config.prompt.aiModel.keep')
        : t('config.prompt.aiModel.enter'),
      validate: (input) => {
        if (normalizeInputValue(input) || currentAiConfig.model) {
          return true
        }

        return t('config.validate.aiModel.required')
      },
    },
    {
      type: 'password',
      name: 'aiApiKeyInput',
      message: currentAiConfig.apiKey
        ? t('config.prompt.aiApiKey.keep')
        : t('config.prompt.aiApiKey.enter'),
      mask: '*',
      validate: (input) => {
        if (normalizeInputValue(input) || currentAiConfig.apiKey) {
          return true
        }

        return t('config.validate.aiApiKey.required')
      },
    },
  ]
}

async function promptForAllConfig(currentGithubToken, currentAiConfig) {
  return inquirer.prompt([
    createTokenQuestion(currentGithubToken),
    ...createAiConfigQuestions(currentAiConfig),
  ])
}

async function promptForMissingConfig(githubToken, aiConfig) {
  const questions = []

  if (!githubToken) {
    questions.push(createTokenQuestion(githubToken))
  }

  if (!aiConfig.baseUrl) {
    questions.push(createAiConfigQuestions(aiConfig)[0])
  }

  if (!aiConfig.model) {
    questions.push(createAiConfigQuestions(aiConfig)[1])
  }

  if (!aiConfig.apiKey) {
    questions.push(createAiConfigQuestions(aiConfig)[2])
  }

  if (questions.length === 0) {
    return {}
  }

  return inquirer.prompt(questions)
}

export async function configAction(commandOptions = {}) {
  const config = getConfig()
  const currentGithubToken = normalizeInputValue(config.get(GITHUB_TOKEN_KEY))
  const storedAiConfig = normalizeAiConfig(config.get(AI_CONFIG_KEY))
  const currentAiConfig = getCurrentAiConfig(config)
  const hasStoredAiConfig = config.has(AI_CONFIG_KEY)

  let githubToken = normalizeInputValue(commandOptions.token)
  let aiConfig = buildAiConfigFromOptions(commandOptions)

  const hasCommandLineAiConfig = Object.values(aiConfig).some(Boolean)

  if (!githubToken && !hasCommandLineAiConfig) {
    const answers = await promptForAllConfig(currentGithubToken, currentAiConfig)

    githubToken = keepCurrentValue(answers.githubTokenInput, currentGithubToken)
    aiConfig = mergeAiConfig(currentAiConfig, {
      baseUrl: answers.aiBaseUrlInput,
      model: answers.aiModelInput,
      apiKey: answers.aiApiKeyInput,
    })
  }
  else {
    githubToken = keepCurrentValue(githubToken, currentGithubToken)
    aiConfig = mergeAiConfig(currentAiConfig, aiConfig)

    if (!githubToken || !hasCompleteAiConfig(aiConfig)) {
      const answers = await promptForMissingConfig(githubToken, aiConfig)

      githubToken = keepCurrentValue(answers.githubTokenInput || githubToken, currentGithubToken)
      aiConfig = mergeAiConfig(aiConfig, {
        baseUrl: answers.aiBaseUrlInput,
        model: answers.aiModelInput,
        apiKey: answers.aiApiKeyInput,
      })
    }
  }

  if (!githubToken) {
    console.log(chalk.red(t('config.error.tokenNotUpdated')))
    return
  }

  if (!hasCompleteAiConfig(aiConfig)) {
    console.log(chalk.red(t('config.error.aiConfigNotUpdated')))
    return
  }

  const messages = []

  if (githubToken === currentGithubToken) {
    messages.push(chalk.yellow(t('config.info.tokenUnchanged')))
  }
  else {
    config.set(GITHUB_TOKEN_KEY, githubToken)
    messages.push(chalk.green(t('config.info.tokenSaved')))
  }

  if (!hasStoredAiConfig || !isAiConfigEqual(aiConfig, storedAiConfig)) {
    config.set(AI_CONFIG_KEY, aiConfig)

    messages.push(chalk.green(t('config.info.aiConfigSaved')))
  }
  else {
    messages.push(chalk.yellow(t('config.info.aiConfigUnchanged')))
  }

  messages.forEach(message => console.log(message))
}

export function configGetAction(commandOptions = {}) {
  const config = getConfig()
  const githubToken = normalizeInputValue(config.get(GITHUB_TOKEN_KEY))
  const aiConfig = getCurrentAiConfig(config)
  const showFullValue = Boolean(commandOptions.show)

  console.log(t('config.get.githubToken', { value: formatSecret(githubToken, showFullValue) }))
  console.log(t('config.get.aiBaseUrl', { value: formatValue(aiConfig.baseUrl) }))
  console.log(t('config.get.aiModel', { value: formatValue(aiConfig.model) }))
  console.log(t('config.get.aiApiKey', { value: formatSecret(aiConfig.apiKey, showFullValue) }))

  if (!showFullValue) {
    console.log(chalk.gray(t('config.get.showHint')))
  }
}
