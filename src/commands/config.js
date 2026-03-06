import chalk from "chalk"
import inquirer from "inquirer"
import { getConfig, GITHUB_TOKEN_KEY } from "../utils/config.js"

export async function configAction(commandOptions = {}) {
  const config = getConfig()
  const currentToken = config.get(GITHUB_TOKEN_KEY)
  let token = commandOptions.token?.trim()

  if (!token) {
    const { tokenInput } = await inquirer.prompt([
      {
        type: "password",
        name: "tokenInput",
        message: currentToken
          ? "Enter GitHub Personal Access Token (Press Enter to keep current):"
          : "Enter GitHub Personal Access Token:",
        mask: "*",
        validate: (input) => {
          if (input.trim() || currentToken) {
            return true
          }
          return "GitHub Personal Access Token is required."
        },
      },
    ])

    token = tokenInput.trim() || currentToken
  }

  if (!token) {
    console.log(chalk.red("GitHub Personal Access Token was not updated."))
    return
  }

  if (token === currentToken) {
    console.log(chalk.yellow("GitHub Personal Access Token is unchanged."))
    return
  }

  config.set(GITHUB_TOKEN_KEY, token)
  console.log(chalk.green("GitHub Personal Access Token saved successfully."))
}
