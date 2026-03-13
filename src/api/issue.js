import {
  normalizeAiCategorizedIssues,
  normalizeAiDifficultyResult,
  normalizeAiEvaluableLabels,
} from '../utils/issue.js'
import {
  buildCategorizedIssuesPrompt,
  buildEvaluableLabelsPrompt,
  buildUniversalDifficultyPrompt,
  extractJson,
} from '../utils/prompt.js'
import { askForAI } from './shared/ai.js'

export async function filterEvaluableLabelsByAI({ labels = [] } = {}) {
  const normalizedLabels = labels
    .map(label => ({
      name: label?.name?.trim() || '',
      description: label?.description?.trim() || '',
    }))
    .filter(label => label.name)

  if (normalizedLabels.length === 0) {
    return []
  }

  const evaluableLabelsPrompt = buildEvaluableLabelsPrompt(normalizedLabels)

  try {
    const response = await askForAI(evaluableLabelsPrompt)
    const parsedResponse = JSON.parse(extractJson(response.text || '{}'))

    return normalizeAiEvaluableLabels(normalizedLabels, parsedResponse)
  }
  catch {
    return normalizedLabels
  }
}

export async function difficultyIssuesByAI({
  issue = {},
  categoryName = 'uncategorized',
  repoContext,
} = {}) {
  const difficultyPrompt = buildUniversalDifficultyPrompt(
    issue,
    categoryName,
    repoContext,
  )

  try {
    const response = await askForAI(difficultyPrompt)
    const parsedResponse = JSON.parse(extractJson(response.text || '{}'))

    return normalizeAiDifficultyResult(parsedResponse)
  }
  catch (error) {
    return {
      difficulty_level: 'Medium',
      estimated_time: 'Unknown',
      reasoning: 'Failed to evaluate issue difficulty with AI.',
      error: `AI difficulty evaluation failed: ${error.message}`,
    }
  }
}

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
