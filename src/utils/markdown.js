const MULTIPLE_EMPTY_LINES_REGEX = /\n{3,}/g
const INLINE_NEWLINES_REGEX = /\s*\n\s*/g

function capitalize(str) {
  if (!str)
    return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function normalizeMarkdownText(value, fallback = '') {
  const text = value?.toString().trim() || fallback
  return text.replace(MULTIPLE_EMPTY_LINES_REGEX, '\n\n')
}

function escapeMarkdownInlineHTML(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function normalizeInlineMarkdownText(value, fallback = '') {
  return escapeMarkdownInlineHTML(
    normalizeMarkdownText(value, fallback).replace(INLINE_NEWLINES_REGEX, ' '),
  )
}

export function generateCategoryMDContent(result) {
  const { categorizedIssues, uncategorizedIssues } = result
  const categorizedSectionLines = ['# Categorized Issues']

  for (const category of categorizedIssues) {
    if (category.issues.length > 0) {
      const categoryName = normalizeInlineMarkdownText(capitalize(category.name), 'Uncategorized')
      categorizedSectionLines.push(`${categoryName}(${category.issues.length})`)

      for (const issue of category.issues) {
        const issueTitle = normalizeInlineMarkdownText(issue.title, 'Untitled issue')
        categorizedSectionLines.push(`- ${issue.number} - ${issueTitle}`)
      }
    }

    categorizedSectionLines.push('')
  }

  const uncategorizedSectionLines = ['# Uncategorized Issues']

  for (const issue of uncategorizedIssues) {
    const issueTitle = normalizeInlineMarkdownText(issue.title, 'Untitled issue')
    uncategorizedSectionLines.push(`- ${issue.number} - ${issueTitle}`)
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
    const issueTitle = normalizeInlineMarkdownText(item?.issue?.title, 'Untitled issue')
    const categoryName = normalizeInlineMarkdownText(item?.categoryName, 'uncategorized')
    const difficultyLevel = normalizeMarkdownText(item?.difficulty?.difficulty_level, 'Unknown')
    const estimatedTime = normalizeMarkdownText(item?.difficulty?.estimated_time, 'Unknown')
    const reasoning = normalizeMarkdownText(item?.difficulty?.reasoning, 'No reasoning provided.')
    const errorMessage = normalizeMarkdownText(item?.difficulty?.error, '')
    const headingIssueNumber = typeof issueNumber === 'number' ? `#${issueNumber}` : '#Unknown'

    sectionLines.push(`## ${headingIssueNumber} - ${issueTitle}`)
    sectionLines.push(`Category: ${categoryName}\n`)
    sectionLines.push(`Difficulty: ${difficultyLevel}\n`)
    sectionLines.push(`Estimated Time: ${estimatedTime}\n`)
    sectionLines.push(`Reasoning: ${reasoning}\n`)

    if (errorMessage) {
      sectionLines.push(`Status: Fallback result due to AI error (${errorMessage})`)
    }

    sectionLines.push('')
  }

  return sectionLines.join('\n').trimEnd()
}
