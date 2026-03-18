import OpenAI from 'openai'
import { t } from '../../i18n/index.js'
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
    throw new Error(t('ai.error.configIncomplete'))
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
    throw new Error(t('ai.error.requestFailed', { message: error.message }))
  }
}
