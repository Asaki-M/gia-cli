import { GoogleGenAI } from '@google/genai'
import { GEMINI_API_KEY, getConfig } from '../utils/config.js'
import {
  buildCategorizedIssuesPrompt,
  extractJson,
  GEMINI_MODEL,
  normalizeAiCategorizedIssues,
} from '../utils/gemini.js'

async function askGemini(contents) {
  const config = getConfig()
  const apiKey = config.get(GEMINI_API_KEY)
  const ai = new GoogleGenAI({ apiKey })

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
    })
    return response
  }
  catch (error) {
    throw new Error(`Gemini 错误：${error.message}`)
  }
}

export async function categorizedIssuesByGemini({ labels = [], issues = [] } = {}) {
  const categorizedIssuesPrompt = buildCategorizedIssuesPrompt(labels, issues)

  try {
    const response = await askGemini(categorizedIssuesPrompt)
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
      error: `Gemini 分类失败：${error.message}`,
    }
  }
}
