import { filterEvaluableLabelsByAI } from '../../api/issue.js'

function filterAssignedIssues(issues = []) {
  return issues.filter((issue) => {
    if (Array.isArray(issue.assignees)) {
      return issue.assignees.length > 0
    }

    return Boolean(issue.assignee)
  })
}

function filterLockedIssues(issues = []) {
  return issues.filter(issue => !issue.locked)
}

function normalizeIssueLabels(issueLabels = []) {
  return issueLabels
    .map(label => typeof label === 'string' ? label : label?.name)
    .filter(Boolean)
}

async function filterIssuesByEvaluableLabels({ labels = [], issues = [] } = {}) {
  const evaluableLabels = await filterEvaluableLabelsByAI({ labels })

  if (evaluableLabels.length === 0 || issues.length === 0) {
    return []
  }

  const evaluableLabelNameSet = new Set(evaluableLabels.map(label => label.name))

  return issues.filter((issue) => {
    const issueLabels = normalizeIssueLabels(issue.labels)
    return issueLabels.some(labelName => evaluableLabelNameSet.has(labelName))
  })
}

async function filterIssues({ labels = [], issues = [] } = {}) {
  if (issues.length === 0) {
    return []
  }

  const evaluableIssues = await filterIssuesByEvaluableLabels({
    labels,
    issues,
  })

  return filterLockedIssues(filterAssignedIssues(evaluableIssues))
}

export async function estimateRepositoryIssuesDifficulty({ labels = [], issues = [] }) {
  const filteredIssues = await filterIssues({ labels, issues })
  console.log(filteredIssues, labels)
}
