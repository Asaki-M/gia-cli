const JSON_FENCE_PREFIX = '```json'
const GENERIC_FENCE_PREFIX = '```'

export const CATEGORIZED_ISSUES_PROMPT_VERSION = 1

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

function normalizeComparableLabelName(name) {
  return name?.trim().toLowerCase() || ''
}

function collectResultLabelNames(values = []) {
  if (!Array.isArray(values)) {
    return []
  }

  return values
    .map(value => value?.toString().trim() || '')
    .filter(Boolean)
}

export function normalizeAiEvaluableLabels(labels = [], result = {}) {
  const selectedLabelNames = new Set([
    ...collectResultLabelNames(result.evaluable_labels),
    ...collectResultLabelNames(result.unknown_labels),
  ].map(normalizeComparableLabelName))

  if (selectedLabelNames.size === 0) {
    return []
  }

  return labels.filter((label) => {
    const labelName = normalizeComparableLabelName(label?.name)
    return labelName && selectedLabelNames.has(labelName)
  })
}

export function normalizeAiCategorizedIssues(labels = [], result = {}, originalIssues = []) {
  const allowedLabels = new Set(labels)
  const originalIssueMap = new Map(
    originalIssues.map(issue => [issue.number, {
      number: issue.number,
      title: issue.title,
    }]),
  )
  const assignedIssueNumbers = new Set()

  const categorizedIssues = labels.map(label => ({
    name: label,
    issues: [],
  }))
  const categorizedIssueMap = new Map(
    categorizedIssues.map(category => [category.name, category]),
  )

  for (const category of result.categorizedIssues || []) {
    if (!allowedLabels.has(category?.name)) {
      continue
    }

    const targetCategory = categorizedIssueMap.get(category.name)

    for (const issue of category.issues || []) {
      const matchedIssue = originalIssueMap.get(issue?.number)
      if (!matchedIssue || assignedIssueNumbers.has(matchedIssue.number)) {
        continue
      }

      targetCategory.issues.push(matchedIssue)
      assignedIssueNumbers.add(matchedIssue.number)
    }
  }

  const uncategorizedIssues = []

  for (const issue of result.uncategorizedIssues || []) {
    const matchedIssue = originalIssueMap.get(issue?.number)
    if (!matchedIssue || assignedIssueNumbers.has(matchedIssue.number)) {
      continue
    }

    uncategorizedIssues.push(matchedIssue)
    assignedIssueNumbers.add(matchedIssue.number)
  }

  for (const issue of originalIssues) {
    if (!assignedIssueNumbers.has(issue.number)) {
      uncategorizedIssues.push({
        number: issue.number,
        title: issue.title,
      })
    }
  }

  return {
    categorizedIssues,
    uncategorizedIssues,
  }
}
