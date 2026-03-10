import chalk from 'chalk'
import inquirer from 'inquirer'
import {
  GEMINI_API_KEY,
  getConfig,
  GITHUB_TOKEN_KEY,
} from '../utils/config.js'

function normalizeInputValue(value) {
  return value?.trim() || ''
}

function keepCurrentValue(inputValue, currentValue) {
  return normalizeInputValue(inputValue) || currentValue
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

export async function configAction(commandOptions = {}) {
  const config = getConfig()
  const currentGithubToken = config.get(GITHUB_TOKEN_KEY)
  const currentGeminiKey = config.get(GEMINI_API_KEY)
  let githubToken = normalizeInputValue(commandOptions.token)
  let geminiKey = normalizeInputValue(commandOptions.geminiKey)

  if (!githubToken && !geminiKey) {
    const answers = await inquirer.prompt([
      {
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
      },
      {
        type: 'password',
        name: 'geminiKeyInput',
        message: currentGeminiKey
          ? 'Gemini API Key already set. Press Enter to keep the current value:'
          : 'Enter Gemini API Key (required):',
        mask: '*',
        validate: (input) => {
          if (normalizeInputValue(input) || currentGeminiKey) {
            return true
          }
          return 'Gemini API Key is required.'
        },
      },
    ])

    githubToken = keepCurrentValue(answers.githubTokenInput, currentGithubToken)
    geminiKey = keepCurrentValue(answers.geminiKeyInput, currentGeminiKey)
  }
  else {
    githubToken = keepCurrentValue(githubToken, currentGithubToken)
    geminiKey = keepCurrentValue(geminiKey, currentGeminiKey)
  }

  if (!githubToken) {
    console.log(chalk.red('GitHub Personal Access Token was not updated.'))
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

  if (geminiKey) {
    if (geminiKey === currentGeminiKey) {
      messages.push(chalk.yellow('Gemini API Key kept unchanged.'))
    }
    else {
      config.set(GEMINI_API_KEY, geminiKey)
      messages.push(chalk.green('Gemini API Key saved successfully.'))
    }
  }
  else if (currentGeminiKey) {
    messages.push(chalk.yellow('Gemini API Key kept unchanged.'))
  }
  else {
    messages.push(chalk.yellow('Gemini API Key is not set yet.'))
  }

  messages.forEach(message => console.log(message))
}

export function configGetAction(commandOptions = {}) {
  const config = getConfig()
  const githubToken = config.get(GITHUB_TOKEN_KEY)
  const geminiKey = config.get(GEMINI_API_KEY)
  const showFullValue = Boolean(commandOptions.show)

  console.log(`GitHub Personal Access Token: ${formatSecret(githubToken, showFullValue)}`)
  console.log(`Gemini API Key: ${formatSecret(geminiKey, showFullValue)}`)

  if (!showFullValue) {
    console.log(chalk.gray('Use `gia config get --show` to display full values.'))
  }
}
