import Conf from "conf"

export const GITHUB_TOKEN_KEY = "github.token"

let configInstance

export function getConfig() {
  if (!configInstance) {
    try {
      configInstance = new Conf({
        projectName: "gia-cli",
      })
    } catch (error) {
      configInstance = new Conf({
        projectName: "gia-cli",
        cwd: process.cwd(),
      })
    }
  }

  return configInstance
}
