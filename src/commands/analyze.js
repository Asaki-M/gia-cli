import inquirer from "inquirer"
import { listAllOpenRepositoryIssues, listAllOpenRepositoryPullRequests } from "../api/github.js"

export async function analyzeAction() {
  const reqType = await inquirer.prompt([
    {
      type: "rawlist",
      name: "type",
      message: "What do you want to analyze?",
      choices: ["issue", "pr"],
      default: 'issue'
    },
  ])

  const owner = await inquirer.prompt([
    {
      type: "input",
      name: "owner",
      message: "Enter the owner of the repository:",
      validate: (input) => {
        if (input) {
          return true
        }
        return "Please enter the owner of the repository."
      },
    },
  ])

  const repo = await inquirer.prompt([
    {
      type: "input",
      name: "repo",
      message: "Enter the repository name:",
      validate: (input) => {
        if (input) {
          return true
        }
        return "Please enter the repository name."
      },
    },
  ])

  const finalParams = {
    type: reqType.type,
    owner: owner.owner,
    repo: repo.repo,
  }

  if (finalParams.type === "issue") {
    console.log("正在获取 Issues，请稍候...\n")
    try {
      const issues = await listAllOpenRepositoryIssues({
        owner: finalParams.owner,
        repo: finalParams.repo,
      })

      if (issues.length === 0) {
        console.log("该仓库暂无开放的 Issue。")
      } else {
        console.log(`===== Issues（共 ${issues.length} 条）=====`)
        issues.forEach((issue, index) => {
          console.log(`\n[${index + 1}] #${issue.number} ${issue.title}`)
          console.log(`    状态：${issue.state}`)
          console.log(`    创建者：${issue.user?.login}`)
          console.log(`    创建时间：${issue.created_at}`)
          console.log(`    链接：${issue.html_url}`)
        })
        console.log("\n====================\n")
      }
    } catch (error) {
      console.error("获取 Issues 失败：", error.message)
    }
  }

  if (finalParams.type === "pr") {
    console.log("正在获取 Pull Requests，请稍候...\n")
    try {
      const prs = await listAllOpenRepositoryPullRequests({
        owner: finalParams.owner,
        repo: finalParams.repo,
      })

      if (prs.length === 0) {
        console.log("该仓库暂无开放的 Pull Request。")
      } else {
        console.log(`===== Pull Requests（共 ${prs.length} 条）=====`)
        prs.forEach((pr, index) => {
          console.log(`\n[${index + 1}] #${pr.number} ${pr.title}`)
          console.log(`    状态：${pr.state}`)
          console.log(`    创建者：${pr.user?.login}`)
          console.log(`    创建时间：${pr.created_at}`)
          console.log(`    分支：${pr.head?.ref} → ${pr.base?.ref}`)
          console.log(`    链接：${pr.html_url}`)
        })
        console.log("\n====================\n")
      }
    } catch (error) {
      console.error("获取 Pull Requests 失败：", error.message)
    }
  }
}