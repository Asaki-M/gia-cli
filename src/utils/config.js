import Conf from 'conf'

export const GITHUB_TOKEN_KEY = 'github.token'
export const AI_CONFIG_KEY = 'aiConfig'

let configInstance

function normalizeInputValue(value) {
  return value?.trim() || ''
}

export function normalizeAiConfig(value = {}) {
  const aiConfig = value && typeof value === 'object' ? value : {}

  return {
    baseUrl: normalizeInputValue(aiConfig.baseUrl),
    model: normalizeInputValue(aiConfig.model),
    apiKey: normalizeInputValue(aiConfig.apiKey),
  }
}

export function getConfig() {
  if (!configInstance) {
    try {
      configInstance = new Conf({
        projectName: 'gia-cli',
      })
    }
    catch {
      configInstance = new Conf({
        projectName: 'gia-cli',
        cwd: process.cwd(),
      })
    }
  }

  return configInstance
}

export function getAiConfig() {
  return normalizeAiConfig(getConfig().get(AI_CONFIG_KEY))
}

export function hasCompleteAiConfig(aiConfig = getAiConfig()) {
  return Boolean(aiConfig.baseUrl && aiConfig.model && aiConfig.apiKey)
}
