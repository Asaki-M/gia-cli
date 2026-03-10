function capitalize(str) {
  if (!str)
    return str
  return str.charAt(0).toUpperCase() + str.slice(1)
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
