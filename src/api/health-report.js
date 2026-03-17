import { extractJson } from '../utils/prompt.js'
import { askForAI } from './shared/ai.js'

const VALID_HEALTH_GRADES = new Set(['A', 'B', 'C', 'D'])

function toSafeNumber(value, fallbackValue = -1) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallbackValue
}

function normalizeString(value, fallbackValue = '') {
  if (typeof value !== 'string') {
    return fallbackValue
  }

  const trimmedValue = value.trim()
  return trimmedValue || fallbackValue
}

function normalizeStringArray(value, limit = 2) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => normalizeString(item))
    .filter(Boolean)
    .slice(0, limit)
}

export function normalizeHealthMetricsForAI(healthData = {}) {
  const inputAlreadyNormalized = healthData?.vitality && healthData?.issues && healthData?.pull_requests

  if (inputAlreadyNormalized) {
    return {
      vitality: {
        days_since_last_push: toSafeNumber(healthData.vitality.days_since_last_push),
      },
      issues: {
        resolution_rate_percent: toSafeNumber(healthData.issues.resolution_rate_percent),
        avg_first_response_hours: toSafeNumber(healthData.issues.avg_first_response_hours),
      },
      pull_requests: {
        merged_count: toSafeNumber(healthData.pull_requests.merged_count, 0),
        rejected_count: toSafeNumber(healthData.pull_requests.rejected_count, 0),
        avg_merge_time_days: toSafeNumber(healthData.pull_requests.avg_merge_time_days),
      },
    }
  }

  const averageMergeHours = toSafeNumber(healthData?.pullRequestMergeEfficiency?.averageMergeHours)
  const averageMergeDays = averageMergeHours >= 0
    ? Math.round((averageMergeHours / 24) * 100) / 100
    : -1

  return {
    vitality: {
      days_since_last_push: toSafeNumber(healthData?.maintenanceVitality?.daysSinceLastCommit),
    },
    issues: {
      resolution_rate_percent: toSafeNumber(healthData?.resolutionRate?.resolutionRatePercent),
      avg_first_response_hours: toSafeNumber(healthData?.issueResponsiveness?.averageFirstResponseHours),
    },
    pull_requests: {
      merged_count: toSafeNumber(healthData?.pullRequestMergeEfficiency?.mergedPullRequestsCount, 0),
      rejected_count: toSafeNumber(healthData?.pullRequestMergeEfficiency?.rejectedPullRequestsCount, 0),
      avg_merge_time_days: averageMergeDays,
    },
  }
}

export function buildHealthReportPrompt(healthData = {}) {
  const metrics = normalizeHealthMetricsForAI(healthData)

  return [
    '你是一位资深的开源社区布道师和顶级架构师。你的任务是根据提供的仓库最近 90 天的统计指标（Metrics），对该开源项目的“健康状况”和“社区活跃度”进行专家级诊断，并为准备参与贡献的开发者提供避坑建议。',
    '',
    '【硬性诊断基准参考】',
    '- 优秀 (A级)：Issue 解决率 > 70%，首评响应 < 24小时；PR 合并效率高，距离上次提交 < 7天。',
    '- 良好 (B级)：各项指标平稳，可能有少量 PR 积压，响应时间在 1-3 天内。',
    '- 亚健康 (C级)：Issue 解决率 < 40%，首评响应 > 3天；或者 PR 拒绝率极高；距离上次提交超过 1 个月。',
    '- 危险 (D级)：Issue 几乎无人处理，PR 积压严重或长期无人合并，距离上次提交超过 3 个月（大概率已废弃）。',
    '',
    '【输入数据格式说明】',
    '- vitality.days_since_last_push: 距离最近一次代码提交的天数。',
    '- issues.resolution_rate_percent: Issue 解决率（%）。',
    '- issues.avg_first_response_hours: Issue 平均首次响应时间（小时）。-1 表示无人回复。',
    '- pull_requests.merged_count / rejected_count: PR 合并与关闭的数量对比。',
    '- pull_requests.avg_merge_time_days: PR 平均合并耗时（天）。',
    '',
    '【输出要求】',
    '必须严格输出合法的纯 JSON 字符串，绝对不要使用 Markdown 代码块包裹（如 ```json ```），不要输出任何其他解释性文字。结构如下：',
    '{',
    '  "health_grade": "A" | "B" | "C" | "D",',
    '  "summary": "一句话高度概括该仓库目前的整体健康状态（如：\'该项目处于极度活跃的黄金期，社区响应极其迅速。\'）",',
    '  "strengths": ["优点1", "优点2"],',
    '  "risks": ["风险1", "风险2"],',
    '  "contribution_advice": "给想要给该项目提 PR 的开发者的具体建议，例如是否值得投入时间，或者提 PR 时需要注意什么态度。"',
    '}',
    '',
    '请对以下数据进行诊断：',
    JSON.stringify(metrics),
  ].join('\n')
}

function normalizeHealthReportResult(result = {}) {
  const healthGrade = normalizeString(result.health_grade, 'C').toUpperCase()

  return {
    health_grade: VALID_HEALTH_GRADES.has(healthGrade) ? healthGrade : 'C',
    summary: normalizeString(result.summary, '暂无可用诊断结果。'),
    strengths: normalizeStringArray(result.strengths, 2),
    risks: normalizeStringArray(result.risks, 2),
    contribution_advice: normalizeString(
      result.contribution_advice,
      '建议先阅读仓库贡献指南并从小范围修复开始，逐步建立与维护者的协作信任。',
    ),
  }
}

export async function generateHealthReport({ healthData = {} } = {}) {
  const prompt = buildHealthReportPrompt(healthData)

  try {
    const response = await askForAI(prompt)
    const parsedResponse = JSON.parse(extractJson(response.text || '{}'))

    return normalizeHealthReportResult(parsedResponse)
  }
  catch (error) {
    return {
      health_grade: 'C',
      summary: 'AI diagnosis unavailable, fallback result returned.',
      strengths: [],
      risks: [
        `AI diagnosis failed: ${error.message}`,
      ],
      contribution_advice: 'Use the raw health metrics first and verify repository activity manually before investing major effort.',
    }
  }
}
