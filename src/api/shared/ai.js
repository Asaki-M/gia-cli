import OpenAI from 'openai'
import { getAiConfig, hasCompleteAiConfig } from '../../utils/config.js'

function normalizeAiResponse(response) {
  return {
    ...response,
    text: response.output_text || '',
  }
}

export async function askForAI(contents) {
  const aiConfig = getAiConfig()

  if (!hasCompleteAiConfig(aiConfig)) {
    throw new Error('AI 配置不完整，请先运行 `gia config`')
  }

  const ai = new OpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseUrl,
  })

  try {
    const response = await ai.responses.create({
      model: aiConfig.model,
      input: contents,
    })

    return normalizeAiResponse(response)
  }
  catch (error) {
    throw new Error(`AI 错误：${error.message}`)
  }
}
