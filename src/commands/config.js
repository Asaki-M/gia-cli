import chalk from 'chalk'
import inquirer from 'inquirer'
import {
  GEMINI_API_KEY,
  getConfig,
  GITHUB_TOKEN_KEY,
} from '../utils/config.js'

export async function configAction(commandOptions = {}) {
  const config = getConfig()
  const currentGithubToken = config.get(GITHUB_TOKEN_KEY)
  const currentGeminiKey = config.get(GEMINI_API_KEY)
  let githubToken = commandOptions.token?.trim()
  let geminiKey = commandOptions.geminiKey?.trim()

  if (!githubToken && !geminiKey) {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'githubTokenInput',
        message: currentGithubToken
          ? 'Enter GitHub Personal Access Token (Press Enter to keep current):'
          : 'Enter GitHub Personal Access Token:',
        mask: '*',
        validate: (input) => {
          if (input.trim() || currentGithubToken) {
            return true
          }
          return 'GitHub Personal Access Token is required.'
        },
      },
      {
        type: 'password',
        name: 'geminiKeyInput',
        message: currentGeminiKey
          ? 'Enter Gemini API Key (Press Enter to keep current):'
          : 'Enter Gemini API Key (Optional):',
        mask: '*',
        validate: (input) => {
          if (input.trim() || currentGeminiKey) {
            return true
          }
          return 'Gemini API Key is required.'
        },
      },
    ])

    githubToken = answers.githubTokenInput.trim() || currentGithubToken
    geminiKey = answers.geminiKeyInput.trim() || currentGeminiKey
  }
  else {
    githubToken = githubToken || currentGithubToken
    geminiKey = geminiKey || currentGeminiKey
  }

  if (!githubToken) {
    console.log(chalk.red('GitHub Personal Access Token was not updated.'))
    return
  }

  const messages = []

  if (githubToken === currentGithubToken) {
    messages.push(chalk.yellow('GitHub Personal Access Token is unchanged.'))
  }
  else {
    config.set(GITHUB_TOKEN_KEY, githubToken)
    messages.push(chalk.green('GitHub Personal Access Token saved successfully.'))
  }

  if (geminiKey) {
    if (geminiKey === currentGeminiKey) {
      messages.push(chalk.yellow('Gemini API Key is unchanged.'))
    }
    else {
      config.set(GEMINI_API_KEY, geminiKey)
      messages.push(chalk.green('Gemini API Key saved successfully.'))
    }
  }
  else if (currentGeminiKey) {
    messages.push(chalk.yellow('Gemini API Key is unchanged.'))
  }
  else {
    messages.push(chalk.yellow('Gemini API Key is not set.'))
  }

  messages.forEach(message => console.log(message))
}
