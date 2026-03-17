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

function formatMetricValue(value, fallback = 'N/A') {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback
  }

  return String(value)
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

export function generateHealthMDContent(report = {}) {
  const issueResponsiveness = report.issueResponsiveness || {}
  const resolutionRate = report.resolutionRate || {}
  const communityEngagement = report.communityEngagement || {}
  const goodFirstIssue = communityEngagement.goodFirstIssue || {}
  const pullRequestMergeEfficiency = report.pullRequestMergeEfficiency || {}
  const maintenanceVitality = report.maintenanceVitality || {}
  const timeframe = report.timeframe || {}

  return [
    '# Repository Health Report',
    '',
    `Repository: ${normalizeInlineMarkdownText(`${report.owner || ''}/${report.repo || ''}`, 'unknown/unknown')}`,
    `Time Window: Last ${formatMetricValue(timeframe.lookbackDays)} days (${formatMetricValue(timeframe.sinceAt)} -> ${formatMetricValue(timeframe.untilAt)})`,
    '',
    '## Issue Responsiveness',
    `- TTFR (Average): ${formatMetricValue(issueResponsiveness.averageFirstResponseHours)}h`,
    `- TTFR (Median): ${formatMetricValue(issueResponsiveness.medianFirstResponseHours)}h`,
    `- Issues With Maintainer Response: ${formatMetricValue(issueResponsiveness.issuesWithMaintainerResponseCount)}`,
    `- Issues Without Maintainer Response: ${formatMetricValue(issueResponsiveness.issuesWithoutMaintainerResponseCount)}`,
    '',
    '## Issue Resolution Rate',
    `- Closed Issues (Window): ${formatMetricValue(resolutionRate.closedIssuesCount)}`,
    `- New Issues (Window): ${formatMetricValue(resolutionRate.newIssuesCount)}`,
    `- Resolution Rate: ${formatMetricValue(resolutionRate.resolutionRatePercent)}%`,
    '',
    '## Community Engagement',
    `- Active Contributors: ${formatMetricValue(communityEngagement.activeContributorsCount)}`,
    `- Merged PR Authors: ${formatMetricValue(communityEngagement.mergedPullRequestAuthorsCount)}`,
    `- Active Commenters (>=${formatMetricValue(communityEngagement.activeCommentThreshold)} comments): ${formatMetricValue(communityEngagement.activeCommentersCount)}`,
    `- Good First Issues Created: ${formatMetricValue(goodFirstIssue.totalCount)}`,
    `- Good First Issues Open: ${formatMetricValue(goodFirstIssue.openCount)}`,
    `- Good First Issues Closed: ${formatMetricValue(goodFirstIssue.closedCount)}`,
    `- Good First Issues Quick Closed: ${formatMetricValue(goodFirstIssue.quickClosedCount)}`,
    `- Good First Issues Stale Open: ${formatMetricValue(goodFirstIssue.staleOpenCount)}`,
    `- Good First Issue Survival (Average): ${formatMetricValue(goodFirstIssue.averageSurvivalDays)}d`,
    `- Good First Issue Survival (Median): ${formatMetricValue(goodFirstIssue.medianSurvivalDays)}d`,
    '',
    '## PR Merge Efficiency',
    `- Merged PRs (Window): ${formatMetricValue(pullRequestMergeEfficiency.mergedPullRequestsCount)}`,
    `- Rejected PRs (Window): ${formatMetricValue(pullRequestMergeEfficiency.rejectedPullRequestsCount)}`,
    `- Merge Lead Time (Average): ${formatMetricValue(pullRequestMergeEfficiency.averageMergeHours)}h`,
    `- Merge Lead Time (Median): ${formatMetricValue(pullRequestMergeEfficiency.medianMergeHours)}h`,
    `- Reject/Merge Ratio: ${formatMetricValue(pullRequestMergeEfficiency.rejectToMergeRatio)}`,
    '',
    '## Maintenance Vitality',
    `- Default Branch: ${formatMetricValue(maintenanceVitality.defaultBranchName)}`,
    `- Last Commit At: ${formatMetricValue(maintenanceVitality.lastCommitAt)}`,
    `- Days Since Last Commit: ${formatMetricValue(maintenanceVitality.daysSinceLastCommit)}d`,
    `- Zombie Risk (>90 days): ${maintenanceVitality.isLikelyZombie === null || maintenanceVitality.isLikelyZombie === undefined ? 'N/A' : maintenanceVitality.isLikelyZombie ? 'Yes' : 'No'}`,
  ].join('\n')
}
