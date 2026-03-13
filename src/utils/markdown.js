const MULTIPLE_EMPTY_LINES_REGEX = /\n{3,}/g

function capitalize(str) {
  if (!str)
    return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function normalizeMarkdownText(value, fallback = '') {
  const text = value?.toString().trim() || fallback
  return text.replace(MULTIPLE_EMPTY_LINES_REGEX, '\n\n')
}

export function generateCategoryMDContent(result) {
  const { categorizedIssues, uncategorizedIssues } = result
  const categorizedSectionLines = ['# Categorized Issues']

  for (const category of categorizedIssues) {
    if (category.issues.length > 0) {
      categorizedSectionLines.push(`${capitalize(category.name)}(${category.issues.length})`)

      for (const issue of category.issues) {
        categorizedSectionLines.push(`- ${issue.number} - ${issue.title}`)
      }
    }

    categorizedSectionLines.push('')
  }

  const uncategorizedSectionLines = ['# Uncategorized Issues']

  for (const issue of uncategorizedIssues) {
    uncategorizedSectionLines.push(`- ${issue.number} - ${issue.title}`)
  }

  return [
    categorizedSectionLines.join('\n').trimEnd(),
    uncategorizedSectionLines.join('\n').trimEnd(),
  ].join('\n\n').trim()
}

export function generateDifficultyMDContent(results = []) {
  const sectionLines = ['# Issue Difficulty Assessment']

  if (!Array.isArray(results) || results.length === 0) {
    sectionLines.push('No issue difficulty assessments available.')
    return sectionLines.join('\n').trim()
  }

  for (const item of results) {
    const issueNumber = item?.issue?.number
    const issueTitle = normalizeMarkdownText(item?.issue?.title, 'Untitled issue')
    const categoryName = normalizeMarkdownText(item?.categoryName, 'uncategorized')
    const difficultyLevel = normalizeMarkdownText(item?.difficulty?.difficulty_level, 'Unknown')
    const estimatedTime = normalizeMarkdownText(item?.difficulty?.estimated_time, 'Unknown')
    const reasoning = normalizeMarkdownText(item?.difficulty?.reasoning, 'No reasoning provided.')
    const errorMessage = normalizeMarkdownText(item?.difficulty?.error, '')
    const headingIssueNumber = typeof issueNumber === 'number' ? `#${issueNumber}` : '#Unknown'

    sectionLines.push(`## ${headingIssueNumber} - ${issueTitle}`)
    sectionLines.push(`Category: ${categoryName}`)
    sectionLines.push(`Difficulty: ${difficultyLevel}`)
    sectionLines.push(`Estimated Time: ${estimatedTime}`)
    sectionLines.push(`Reasoning: ${reasoning}`)

    if (errorMessage) {
      sectionLines.push(`Status: Fallback result due to AI error (${errorMessage})`)
    }

    sectionLines.push('')
  }

  return sectionLines.join('\n').trimEnd()
}
