function normalizeIssueLabels(issueLabels = []) {
  return issueLabels
    .map(label => typeof label === 'string' ? label : label?.name)
    .filter(Boolean)
}

function toIssueSummary(issue = {}) {
  return {
    number: issue.number,
    title: issue.title,
  }
}

export function categorizeIssueByLabels({ labels = [], issues = [] } = {}) {
  const categoryMap = new Map(
    labels.map(label => [label, {
      name: label,
      issues: [],
    }]),
  )

  const uncategorizedIssues = []

  for (const issue of issues) {
    const issueSummary = toIssueSummary(issue)
    const issueLabels = normalizeIssueLabels(issue.labels)
    let matched = false

    for (const issueLabel of issueLabels) {
      const category = categoryMap.get(issueLabel)

      if (!category) {
        continue
      }

      category.issues.push(issueSummary)
      matched = true
    }

    if (!matched) {
      uncategorizedIssues.push(issueSummary)
    }
  }

  return {
    categorizedIssues: [...categoryMap.values()],
    uncategorizedIssues,
  }
}

export function chunkItems(items = [], size = 20) {
  const chunks = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

export function mergeCategorizedIssuesResults(...results) {
  const categoryMap = new Map()
  const uncategorizedIssueMap = new Map()

  for (const result of results) {
    for (const category of result?.categorizedIssues || []) {
      const existingCategory = categoryMap.get(category.name) || {
        name: category.name,
        issues: [],
      }
      const existingIssueNumbers = new Set(existingCategory.issues.map(issue => issue.number))

      for (const issue of category.issues || []) {
        if (existingIssueNumbers.has(issue.number)) {
          continue
        }

        existingCategory.issues.push(issue)
        existingIssueNumbers.add(issue.number)
      }

      categoryMap.set(category.name, existingCategory)
      uncategorizedIssueMap.delete(category.name)
    }

    for (const issue of result?.uncategorizedIssues || []) {
      if (!uncategorizedIssueMap.has(issue.number)) {
        uncategorizedIssueMap.set(issue.number, issue)
      }
    }
  }

  const categorizedIssueNumbers = new Set(
    [...categoryMap.values()].flatMap(category => category.issues.map(issue => issue.number)),
  )

  for (const issueNumber of categorizedIssueNumbers) {
    uncategorizedIssueMap.delete(issueNumber)
  }

  return {
    categorizedIssues: [...categoryMap.values()],
    uncategorizedIssues: [...uncategorizedIssueMap.values()],
  }
}
