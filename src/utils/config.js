import Conf from 'conf'

export const GITHUB_TOKEN_KEY = 'github.token'
export const GEMINI_API_KEY = 'gemini.apiKey'

let configInstance

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
