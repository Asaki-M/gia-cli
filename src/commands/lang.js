import chalk from 'chalk'
import inquirer from 'inquirer'
import {
  DEFAULT_LANGUAGE,
  getLanguage,
  getLanguageDisplayName,
  isLanguageSupported,
  setLanguage,
  t,
} from '../i18n/index.js'

function normalizeInputValue(value) {
  return value?.toString().trim().toLowerCase() || ''
}

async function promptLanguageSelection(currentLanguage) {
  const answer = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'language',
      message: t('lang.prompt.select'),
      default: currentLanguage,
      choices: [
        {
          name: `${getLanguageDisplayName('en')} (en)`,
          value: 'en',
        },
        {
          name: `${getLanguageDisplayName('zh')} (zh)`,
          value: 'zh',
        },
      ],
    },
  ])

  return answer.language
}

function printLanguageState(language) {
  console.log(chalk.green(t('lang.log.updated', {
    language: getLanguageDisplayName(language, language),
  }, language)))
  console.log(chalk.gray(t('lang.log.current', {
    language: getLanguageDisplayName(language, language),
  }, language)))
}

export async function langAction(commandOptions = {}) {
  const currentLanguage = getLanguage()
  const requestedLanguage = normalizeInputValue(commandOptions.set)

  if (requestedLanguage) {
    if (!isLanguageSupported(requestedLanguage)) {
      const fallbackLanguage = setLanguage(DEFAULT_LANGUAGE)
      console.log(chalk.yellow(t('lang.warn.invalidFallback', {
        input: requestedLanguage,
      }, fallbackLanguage)))
      printLanguageState(fallbackLanguage)
      return
    }

    const nextLanguage = setLanguage(requestedLanguage)
    printLanguageState(nextLanguage)
    return
  }

  const selectedLanguage = await promptLanguageSelection(currentLanguage)
  const nextLanguage = setLanguage(selectedLanguage)
  printLanguageState(nextLanguage)
}
