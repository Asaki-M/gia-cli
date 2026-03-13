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

export function normalizeDifficultyLevel(value) {
  const normalizedValue = value?.toString().trim().toLowerCase() || ''

  if (normalizedValue === 'easy') {
    return 'Easy'
  }

  if (normalizedValue === 'hard') {
    return 'Hard'
  }

  return 'Medium'
}

export function normalizeAiDifficultyResult(result = {}) {
  const estimatedTime = result?.estimated_time?.toString().trim() || 'Unknown'
  const reasoning = result?.reasoning?.toString().trim() || 'No reasoning provided.'

  return {
    difficulty_level: normalizeDifficultyLevel(result?.difficulty_level),
    estimated_time: estimatedTime,
    reasoning,
  }
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
