import { t } from '../i18n/index.js'

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

function formatMetricValue(value, fallback = t('common.na')) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback
  }

  return String(value)
}

export function generateCategoryMDContent(result) {
  const { categorizedIssues, uncategorizedIssues } = result
  const categorizedSectionLines = [t('markdown.category.title')]

  for (const category of categorizedIssues) {
    if (category.issues.length > 0) {
      const categoryName = normalizeInlineMarkdownText(capitalize(category.name), t('markdown.category.uncategorized'))
      categorizedSectionLines.push(`${categoryName}(${category.issues.length})`)

      for (const issue of category.issues) {
        const issueTitle = normalizeInlineMarkdownText(issue.title, t('markdown.issue.untitled'))
        categorizedSectionLines.push(`- ${issue.number} - ${issueTitle}`)
      }
    }

    categorizedSectionLines.push('')
  }

  const uncategorizedSectionLines = [t('markdown.category.uncategorizedTitle')]

  for (const issue of uncategorizedIssues) {
    const issueTitle = normalizeInlineMarkdownText(issue.title, t('markdown.issue.untitled'))
    uncategorizedSectionLines.push(`- ${issue.number} - ${issueTitle}`)
  }

  return [
    categorizedSectionLines.join('\n').trimEnd(),
    uncategorizedSectionLines.join('\n').trimEnd(),
  ].join('\n\n').trim()
}

export function generateDifficultyMDContent(results = []) {
  const sectionLines = [t('markdown.difficulty.title')]

  if (!Array.isArray(results) || results.length === 0) {
    sectionLines.push(t('markdown.difficulty.empty'))
    return sectionLines.join('\n').trim()
  }

  for (const item of results) {
    const issueNumber = item?.issue?.number
    const issueTitle = normalizeInlineMarkdownText(item?.issue?.title, t('markdown.issue.untitled'))
    const categoryName = normalizeInlineMarkdownText(item?.categoryName, t('markdown.category.uncategorized'))
    const difficultyLevel = normalizeMarkdownText(item?.difficulty?.difficulty_level, t('common.unknown'))
    const estimatedTime = normalizeMarkdownText(item?.difficulty?.estimated_time, t('common.unknown'))
    const reasoning = normalizeMarkdownText(item?.difficulty?.reasoning, t('issueAi.fallback.reasoning'))
    const errorMessage = normalizeMarkdownText(item?.difficulty?.error, '')
    const headingIssueNumber = typeof issueNumber === 'number'
      ? `#${issueNumber}`
      : t('markdown.difficulty.unknownIssueNumber')

    sectionLines.push(`## ${headingIssueNumber} - ${issueTitle}`)
    sectionLines.push(t('markdown.difficulty.category', { value: categoryName }))
    sectionLines.push(t('markdown.difficulty.level', { value: difficultyLevel }))
    sectionLines.push(t('markdown.difficulty.estimatedTime', { value: estimatedTime }))
    sectionLines.push(t('markdown.difficulty.reasoning', { value: reasoning }))

    if (errorMessage) {
      sectionLines.push(t('markdown.difficulty.fallbackStatus', { message: errorMessage }))
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

  const zombieRiskValue = maintenanceVitality.isLikelyZombie === null || maintenanceVitality.isLikelyZombie === undefined
    ? t('common.na')
    : maintenanceVitality.isLikelyZombie ? t('common.yes') : t('common.no')

  return [
    t('markdown.health.title'),
    '',
    t('markdown.health.repository', {
      value: normalizeInlineMarkdownText(
        `${report.owner || ''}/${report.repo || ''}`,
        `${t('common.unknown')}/${t('common.unknown')}`,
      ),
    }),
    t('markdown.health.timeWindow', {
      days: formatMetricValue(timeframe.lookbackDays),
      since: formatMetricValue(timeframe.sinceAt),
      until: formatMetricValue(timeframe.untilAt),
    }),
    '',
    t('markdown.health.issueResponsiveness'),
    t('markdown.health.ttfrAverage', { value: formatMetricValue(issueResponsiveness.averageFirstResponseHours) }),
    t('markdown.health.ttfrMedian', { value: formatMetricValue(issueResponsiveness.medianFirstResponseHours) }),
    t('markdown.health.withResponse', { value: formatMetricValue(issueResponsiveness.issuesWithMaintainerResponseCount) }),
    t('markdown.health.withoutResponse', { value: formatMetricValue(issueResponsiveness.issuesWithoutMaintainerResponseCount) }),
    '',
    t('markdown.health.issueResolutionRate'),
    t('markdown.health.closedIssues', { value: formatMetricValue(resolutionRate.closedIssuesCount) }),
    t('markdown.health.newIssues', { value: formatMetricValue(resolutionRate.newIssuesCount) }),
    t('markdown.health.resolutionRate', { value: formatMetricValue(resolutionRate.resolutionRatePercent) }),
    '',
    t('markdown.health.communityEngagement'),
    t('markdown.health.activeContributors', { value: formatMetricValue(communityEngagement.activeContributorsCount) }),
    t('markdown.health.mergedPrAuthors', { value: formatMetricValue(communityEngagement.mergedPullRequestAuthorsCount) }),
    t('markdown.health.activeCommenters', {
      threshold: formatMetricValue(communityEngagement.activeCommentThreshold),
      value: formatMetricValue(communityEngagement.activeCommentersCount),
    }),
    t('markdown.health.goodFirstIssueCreated', { value: formatMetricValue(goodFirstIssue.totalCount) }),
    t('markdown.health.goodFirstIssueOpen', { value: formatMetricValue(goodFirstIssue.openCount) }),
    t('markdown.health.goodFirstIssueClosed', { value: formatMetricValue(goodFirstIssue.closedCount) }),
    t('markdown.health.goodFirstIssueQuickClosed', { value: formatMetricValue(goodFirstIssue.quickClosedCount) }),
    t('markdown.health.goodFirstIssueStaleOpen', { value: formatMetricValue(goodFirstIssue.staleOpenCount) }),
    t('markdown.health.goodFirstIssueAverageSurvival', { value: formatMetricValue(goodFirstIssue.averageSurvivalDays) }),
    t('markdown.health.goodFirstIssueMedianSurvival', { value: formatMetricValue(goodFirstIssue.medianSurvivalDays) }),
    '',
    t('markdown.health.prMergeEfficiency'),
    t('markdown.health.mergedPrs', { value: formatMetricValue(pullRequestMergeEfficiency.mergedPullRequestsCount) }),
    t('markdown.health.rejectedPrs', { value: formatMetricValue(pullRequestMergeEfficiency.rejectedPullRequestsCount) }),
    t('markdown.health.mergeLeadTimeAverage', { value: formatMetricValue(pullRequestMergeEfficiency.averageMergeHours) }),
    t('markdown.health.mergeLeadTimeMedian', { value: formatMetricValue(pullRequestMergeEfficiency.medianMergeHours) }),
    t('markdown.health.rejectMergeRatio', { value: formatMetricValue(pullRequestMergeEfficiency.rejectToMergeRatio) }),
    '',
    t('markdown.health.maintenanceVitality'),
    t('markdown.health.defaultBranch', { value: formatMetricValue(maintenanceVitality.defaultBranchName) }),
    t('markdown.health.lastCommitAt', { value: formatMetricValue(maintenanceVitality.lastCommitAt) }),
    t('markdown.health.daysSinceLastCommit', { value: formatMetricValue(maintenanceVitality.daysSinceLastCommit) }),
    t('markdown.health.zombieRisk', { value: zombieRiskValue }),
  ].join('\n')
}
