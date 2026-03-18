# gia-cli

[English](#english) | [中文](#zh-cn)

<a id="english"></a>
## English

### Features
- Automatic issue categorization
- Issue difficulty assessment
- Recommend contribution candidates (TODO)
- Repository health analysis (`gia health`)

### Usage
- `gia`: Analyze open issues and generate `owner-repo-issue-report.md`. During prompts, select `First 30`, `Custom issue limit`, or `All open issues`. For non-all modes, you can set a page to analyze batches (e.g. `limit=30`, `page=2` -> issues `31-60`).
- `gia health`: Analyze repository health using GitHub GraphQL data and generate `owner-repo-health-report.md`.
- `gia health --owner <owner> --repo <repo> --days 90`: Run health analysis without interactive prompts.
- `gia health --comment-threshold 3`: Set minimum comments needed for counting an active commenter.
- `gia config`: Configure GitHub token and AI config (`baseUrl`, `model`, `apiKey`).
- `gia config get`: Show saved config with masked values.
- `gia config get --show`: Show full saved config values.
- `gia lang`: Select CLI display language interactively (`English` or `Chinese`).
- `gia lang --set <en|zh>`: Set CLI display language directly.
- `gia cache clear`: Clear local AI cache (issue classification + evaluable labels + difficulty assessment).

### Notes
- Existing labels are used first, then AI classifies the remaining uncategorized issues.
- Default CLI language is English (`en`).
- Unsupported language input falls back to English with a warning.
- Issue classification cache key: `repo + labels + issue number + issue title`.
- Label evaluability cache key: `repo + label(name/description)`.
- Difficulty cache key: `repo + category + issue content`.
- Difficulty results are appended to the same Markdown report.
- To save tokens, issue body is truncated to the first 500 characters.

[Back to top](#gia-cli)

<a id="zh-cn"></a>
## 中文

### 功能
- Issue 自动分类
- Issue 难度评估
- 推荐可贡献的 Issue（TODO）
- 项目健康度分析（`gia health`）

### 用法
- `gia`：分析仓库 open issues 并生成 `owner-repo-issue-report.md`，在交互里可选 `前 30 条`、`自定义数量` 或 `全部 open issue`。非全部模式可输入页码进行分段分析（例如 `limit=30`、`page=2` 对应 `31-60`）。
- `gia health`：基于 GitHub GraphQL 数据分析项目健康度，并生成 `owner-repo-health-report.md`。
- `gia health --owner <owner> --repo <repo> --days 90`：无需交互，直接执行健康度分析。
- `gia health --comment-threshold 3`：设置“积极评论者”的最小评论数阈值。
- `gia config`：配置 GitHub Token 和 AI 配置（`baseUrl`、`model`、`apiKey`）。
- `gia config get`：查看当前已保存配置（默认脱敏）。
- `gia config get --show`：查看当前已保存配置的完整值。
- `gia lang`：交互选择 CLI 显示语言（`English` 或 `中文`）。
- `gia lang --set <en|zh>`：直接设置 CLI 显示语言。
- `gia cache clear`：清除本地 AI 缓存（Issue 分类 + 可评估 Labels + 难度评估）。

### 说明
- Issue 自动分类会优先使用已有 label，再由 AI 补充未分类 issue。
- CLI 默认语言为英文（`en`）。
- 传入不支持的语言值时，会警告并回退到英文。
- AI 分类缓存键：`仓库 + labels + issue number + issue title`。
- Labels 可评估性缓存键：`仓库 + labels(name/description)`。
- 难度评估缓存键：`仓库 + 分类 + issue 内容`。
- 难度评估结果会拼接在同一份 Markdown 报告中。
- 为节省 token，Issue body 会截断到前 500 个字符。

[返回顶部](#gia-cli)
