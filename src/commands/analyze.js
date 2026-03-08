import fs from 'node:fs'
import inquirer from 'inquirer'
import { categorizedIssuesByGemini } from '../api/gemini.js'
import { listAllLabelsForRepository, listAllOpenRepositoryIssues } from '../api/github.js'
import {
  categorizeIssueByLabels,
  chunkItems,
  mergeCategorizedIssuesResults,
} from '../utils/analyze.js'
import { GEMINI_API_KEY, getConfig, GITHUB_TOKEN_KEY } from '../utils/config.js'
import { generateCategoryMDContent } from '../utils/markdown.js'

export async function analyzeAction() {
  const config = getConfig()
  const token = config.get(GITHUB_TOKEN_KEY)
  const geminiKey = config.get(GEMINI_API_KEY)

  if (!token || !geminiKey) {
    const missingKeys = []

    if (!token) {
      missingKeys.push('GitHub Personal Access Token')
    }

    if (!geminiKey) {
      missingKeys.push('Gemini API Key')
    }

    console.log(`Please run \`gia config\` to save the required config: ${missingKeys.join(', ')}`)
    return
  }

  const owner = await inquirer.prompt([
    {
      type: 'input',
      name: 'owner',
      message: 'Enter the owner of the repository:',
      validate: input => !!input || 'Please enter the owner of the repository.',
    },
  ])

  const repo = await inquirer.prompt([
    {
      type: 'input',
      name: 'repo',
      message: 'Enter the repository name:',
      validate: input => !!input || 'Please enter the repository name.',
    },
  ])

  const finalParams = {
    owner: owner.owner,
    repo: repo.repo,
  }

  console.log('Fetching issues...\n')

  try {
    const labels = await listAllLabelsForRepository({
      owner: finalParams.owner,
      repo: finalParams.repo,
      token,
    })
    const issues = await listAllOpenRepositoryIssues({
      owner: finalParams.owner,
      repo: finalParams.repo,
      token,
    })

    if (issues.length === 0) {
      console.log('No open issues found.')
      return
    }

    const localResult = categorizeIssueByLabels({ labels, issues })
    const issueBatches = chunkItems(localResult.uncategorizedIssues, 20)
    const aiResults = []

    for (const [index, issueBatch] of issueBatches.entries()) {
      console.log(`Classifying issue batch ${index + 1}/${issueBatches.length} with AI...`)
      aiResults.push(await categorizedIssuesByGemini({
        labels,
        issues: issueBatch,
      }))
    }

    const finalResult = mergeCategorizedIssuesResults(localResult, ...aiResults)

    const outputPath = `./${finalParams.owner}-${finalParams.repo}-issue-report.md`
    fs.writeFileSync(outputPath, generateCategoryMDContent(finalResult))
    console.log(`Issue report generated: ${outputPath}`)
  }
  catch (error) {
    console.error('Failed to analyze issues:', error.message)
  }
}
