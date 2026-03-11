import {
  buildCategorizedIssuesPrompt,
  extractJson,
  normalizeAiCategorizedIssues,
} from '../utils/issue.js'
import { askForAI } from './shared/ai.js'

export async function categorizedIssuesByAI({ labels = [], issues = [] } = {}) {
  const categorizedIssuesPrompt = buildCategorizedIssuesPrompt(labels, issues)

  try {
    const response = await askForAI(categorizedIssuesPrompt)
    const parsedResponse = JSON.parse(extractJson(response.text || '{}'))

    return normalizeAiCategorizedIssues(labels, parsedResponse, issues)
  }
  catch (error) {
    return {
      categorizedIssues: labels.map(label => ({
        name: label,
        issues: [],
      })),
      uncategorizedIssues: issues.map(issue => ({
        number: issue.number,
        title: issue.title,
      })),
      error: `AI 分类失败：${error.message}`,
    }
  }
}
