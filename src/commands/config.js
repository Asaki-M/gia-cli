import chalk from 'chalk'
import inquirer from 'inquirer'
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
    return chalk.gray('Not set')
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***${value.slice(-2)}`
  }

  return `${value.slice(0, 4)}${'*'.repeat(value.length - 8)}${value.slice(-4)}`
}

function formatSecret(value, showFullValue = false) {
  if (!value) {
    return chalk.gray('Not set')
  }

  return showFullValue ? value : maskSecret(value)
}

function formatValue(value) {
  return value || chalk.gray('Not set')
}

function createTokenQuestion(currentGithubToken) {
  return {
    type: 'password',
    name: 'githubTokenInput',
    message: currentGithubToken
      ? 'GitHub Personal Access Token already set. Press Enter to keep the current value:'
      : 'Enter GitHub Personal Access Token (required):',
    mask: '*',
    validate: (input) => {
      if (normalizeInputValue(input) || currentGithubToken) {
        return true
      }

      return 'GitHub Personal Access Token is required.'
    },
  }
}

function createAiConfigQuestions(currentAiConfig) {
  return [
    {
      type: 'input',
      name: 'aiBaseUrlInput',
      message: currentAiConfig.baseUrl
        ? 'AI Base URL already set. Press Enter to keep the current value:'
        : 'Enter AI Base URL (required):',
      validate: (input) => {
        if (normalizeInputValue(input) || currentAiConfig.baseUrl) {
          return true
        }

        return 'AI Base URL is required.'
      },
    },
    {
      type: 'input',
      name: 'aiModelInput',
      message: currentAiConfig.model
        ? 'AI model already set. Press Enter to keep the current value:'
        : 'Enter AI model (required):',
      validate: (input) => {
        if (normalizeInputValue(input) || currentAiConfig.model) {
          return true
        }

        return 'AI model is required.'
      },
    },
    {
      type: 'password',
      name: 'aiApiKeyInput',
      message: currentAiConfig.apiKey
        ? 'AI API Key already set. Press Enter to keep the current value:'
        : 'Enter AI API Key (required):',
      mask: '*',
      validate: (input) => {
        if (normalizeInputValue(input) || currentAiConfig.apiKey) {
          return true
        }

        return 'AI API Key is required.'
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
    console.log(chalk.red('GitHub Personal Access Token was not updated.'))
    return
  }

  if (!hasCompleteAiConfig(aiConfig)) {
    console.log(chalk.red('AI config was not updated.'))
    return
  }

  const messages = []

  if (githubToken === currentGithubToken) {
    messages.push(chalk.yellow('GitHub Personal Access Token kept unchanged.'))
  }
  else {
    config.set(GITHUB_TOKEN_KEY, githubToken)
    messages.push(chalk.green('GitHub Personal Access Token saved successfully.'))
  }

  if (!hasStoredAiConfig || !isAiConfigEqual(aiConfig, storedAiConfig)) {
    config.set(AI_CONFIG_KEY, aiConfig)

    messages.push(chalk.green('AI config saved successfully.'))
  }
  else {
    messages.push(chalk.yellow('AI config kept unchanged.'))
  }

  messages.forEach(message => console.log(message))
}

export function configGetAction(commandOptions = {}) {
  const config = getConfig()
  const githubToken = normalizeInputValue(config.get(GITHUB_TOKEN_KEY))
  const aiConfig = getCurrentAiConfig(config)
  const showFullValue = Boolean(commandOptions.show)

  console.log(`GitHub Personal Access Token: ${formatSecret(githubToken, showFullValue)}`)
  console.log(`AI Base URL: ${formatValue(aiConfig.baseUrl)}`)
  console.log(`AI Model: ${formatValue(aiConfig.model)}`)
  console.log(`AI API Key: ${formatSecret(aiConfig.apiKey, showFullValue)}`)

  if (!showFullValue) {
    console.log(chalk.gray('Use `gia config get --show` to display full secret values.'))
  }
}
