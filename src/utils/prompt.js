const JSON_FENCE_PREFIX = '```json'
const GENERIC_FENCE_PREFIX = '```'

export const CATEGORIZED_ISSUES_PROMPT_VERSION = 1
export const EVALUABLE_LABELS_PROMPT_VERSION = 1
export const ISSUE_DIFFICULTY_PROMPT_VERSION = 1

export function buildCategorizedIssuesPrompt(labels = [], issues = []) {
  const normalizedIssues = issues.map(issue => ({
    number: issue.number,
    title: issue.title,
  }))

  return [
    '你是一个开源项目问题分类助手。',
    '请只根据每个 issue 的 title 进行分类，不要参考正文，不要编造信息。',
    '分类结果必须严格限制在下面给定的 labels 里，不能新增 label。',
    '如果某个 issue 无法仅凭 title 明确归类，请放到 uncategorizedIssues。',
    '一个 issue 只能归入一个 label。',
    '',
    '你必须只返回 JSON，不要输出 Markdown，不要输出解释。',
    'JSON 结构必须严格如下：',
    '{',
    '  "categorizedIssues": [',
    '    {',
    '      "name": "label name from labels",',
    '      "issues": [',
    '        { "number": 123, "title": "issue title" }',
    '      ]',
    '    }',
    '  ],',
    '  "uncategorizedIssues": [',
    '    { "number": 456, "title": "issue title" }',
    '  ]',
    '}',
    '',
    `可选 labels: ${JSON.stringify(labels)}`,
    `待分类 issues: ${JSON.stringify(normalizedIssues)}`,
  ].join('\n')
}

export function buildEvaluableLabelsPrompt(labels = []) {
  const normalizedLabels = labels
    .map(label => ({
      name: label?.name?.trim() || '',
      description: label?.description?.trim() || '',
    }))
    .filter(label => label.name)

  return [
    '你是一个资深的开源项目维护者。我现在会给你一份某开源仓库的所有 Label 列表（包含名称和描述）。',
    '请你分析这些 Label，并判断带有该 Label 的 Issue 是否需要进行“开发难度评估”。',
    '',
    '判定标准：',
    '1. 【需要评估】（evaluable）：通常是需要编写代码、修改文档或进行测试的具体任务。例如：bug, feature, enhancement, refactor, help wanted, good first issue 等。',
    '2. 【无需评估/可过滤】（ignored）：通常是沟通交流、状态标记、拒绝处理或非研发任务。例如：question, duplicate, wontfix, invalid, discussion, dependencies, locked 等。',
    '',
    '请返回严格的 JSON 格式，结构如下：',
    '{',
    '  "evaluable_labels": ["label_name_1", "label_name_2"],',
    '  "ignored_labels": ["label_name_3", "label_name_4"],',
    '  "unknown_labels": ["label_name_5"]',
    '}',
    '',
    '只返回 JSON，不要输出 Markdown，不要输出额外解释。',
    `以下是该仓库的 Label 列表：${JSON.stringify(normalizedLabels)}`,
  ].join('\n')
}

export function buildRepoContextForAI({ description, topics, languages }) {
  const topicsStr = (topics && topics.length > 0)
    ? topics.join(', ')
    : '无特定业务标签'

  let techStackStr = '未知语言'

  if (languages) {
    if (typeof languages === 'string') {
      techStackStr = languages
    }
    else if (Array.isArray(languages)) {
      techStackStr = languages.length > 0 ? languages.join(', ') : '未知语言'
    }
    else if (typeof languages === 'object') {
      const sortedLangs = Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0])

      if (sortedLangs.length > 0) {
        techStackStr = sortedLangs.join(', ')
      }
    }
  }

  return `这是一个主要使用 [${techStackStr}] 开发的开源项目。
- 项目描述: ${description}
- 技术栈/业务类型标签: ${topicsStr}`
}

export function buildUniversalDifficultyPrompt(issue, categoryName, repoContext = '未知技术栈的开源项目') {
  const systemPrompt = `
你是一个资深的顶级软件工程师和开源项目架构师。你的任务是阅读 GitHub/GitLab Issue 的标题和内容，评估修复该 Issue 或完成该任务的“开发难度”。

【项目背景上下文】
当前 Issue 属于以下类型的开源项目：${repoContext}
请结合该技术栈的普遍开发模式来评估难度。

【通用难度判定标准】
- Easy (简单 / 适合新手):
  - 涉及：修改错别字、补充或润色文档、调整简单的静态配置文件、修复极易定位的单一函数逻辑错误。
  - 特征：不需要深入理解项目的整体架构，通常只涉及 1-2 个文件的局部修改。耗时预估 < 2 小时。
- Medium (中等 / 适合常规开发者):
  - 涉及：修复常规的业务逻辑 Bug、添加标准的 API 接口或单一功能模块、增加单元测试、处理常见的数据状态同步问题。
  - 特征：需要阅读并理解项目的部分模块源码，可能涉及多个文件的交互，或者需要查阅相关框架的文档。耗时预估 半天到 1 天。
- Hard (困难 / 适合核心贡献者):
  - 涉及：核心底层架构重构、解决复杂的并发/竞争条件 (Race Conditions)、内存泄漏排查、复杂的数据库死锁或性能调优、跨系统集成故障。
  - 特征：需要对该语言或框架有极其深厚的底层机制理解，涉及牵一发而动全身的关键链路。耗时预估 > 1 天。

【输出要求】
必须严格输出合法的纯 JSON 字符串，绝对不要使用 Markdown 代码块包裹（如 \`\`\`json \`\`\`），不要输出任何其他解释性文字。
JSON 结构如下：
{
  "difficulty_level": "Easy" | "Medium" | "Hard",
  "estimated_time": "预估耗时描述，例如 '1-2 hours', '1-2 days'",
  "reasoning": "简要解释判定理由。指出具体的技术难点，例如是否涉及复杂的架构逻辑、并发处理、底层机制等。"
}
`

  const contentBody = issue.formatBody || (issue.body ? issue.body.substring(0, 1000) : '无描述')

  const userPrompt = `
请评估以下 Issue 的开发难度：

- 核心分类/标签: ${categoryName}
- Issue 标题: ${issue.title}
- Issue 详情:
${contentBody}
`

  return `${systemPrompt}\n\n---\n\n${userPrompt}`
}

export function extractJson(text = '') {
  const trimmedText = text.trim()

  if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
    return trimmedText
  }

  const jsonFenceStartIndex = trimmedText.indexOf(JSON_FENCE_PREFIX)
  if (jsonFenceStartIndex >= 0) {
    const contentStartIndex = jsonFenceStartIndex + JSON_FENCE_PREFIX.length
    const contentEndIndex = trimmedText.indexOf(GENERIC_FENCE_PREFIX, contentStartIndex)

    if (contentEndIndex > contentStartIndex) {
      return trimmedText.slice(contentStartIndex, contentEndIndex).trim()
    }
  }

  if (trimmedText.startsWith(GENERIC_FENCE_PREFIX)) {
    const contentStartIndex = trimmedText.indexOf('\n')
    const contentEndIndex = trimmedText.lastIndexOf(GENERIC_FENCE_PREFIX)

    if (contentStartIndex >= 0 && contentEndIndex > contentStartIndex) {
      return trimmedText.slice(contentStartIndex, contentEndIndex).trim()
    }
  }

  const startIndex = trimmedText.indexOf('{')
  const endIndex = trimmedText.lastIndexOf('}')

  if (startIndex >= 0 && endIndex > startIndex) {
    return trimmedText.slice(startIndex, endIndex + 1)
  }

  return trimmedText
}
