# gia-cli

## Features | 功能
- Automatic issue categorization | Issue 自动分类
- Issue difficulty assessment | Issue 难度评估
- Recommend contribution candidates (TODO) | 推荐可贡献的 Issue（TODO）
- Repository health analysis (TODO) | 项目健康度分析（TODO）

## Usage | 用法
- `gia`: Analyze open issues and generate `owner-repo-issue-report.md`. During prompts, select `First 30`, `Custom issue limit`, or `All open issues`. For non-all modes, you can set a page to analyze batches (e.g. `limit=30`, `page=2` -> issues `31-60`). | 分析仓库 open issues 并生成 `owner-repo-issue-report.md`，在交互里可选 `前 30 条`、`自定义数量` 或 `全部 open issue`。非全部模式可输入页码进行分段分析（例如 `limit=30`、`page=2` 对应 `31-60`）。
- `gia config`: Configure GitHub token and AI config (`baseUrl`, `model`, `apiKey`). | 配置 GitHub Token 和 AI 配置（`baseUrl`、`model`、`apiKey`）。
- `gia config get`: Show saved config with masked values. | 查看当前已保存配置（默认脱敏）。
- `gia config get --show`: Show full saved config values. | 查看当前已保存配置的完整值。
- `gia cache clear`: Clear local AI cache (issue classification + evaluable labels + difficulty assessment). | 清除本地 AI 缓存（Issue 分类 + 可评估 Labels + 难度评估）。

## Notes | 说明
- Existing labels are used first, then AI classifies the remaining uncategorized issues. | Issue 自动分类会优先使用已有 label，再由 AI 补充未分类 issue。
- Issue classification cache key: `repo + labels + issue number + issue title`. | AI 分类缓存键：`仓库 + labels + issue number + issue title`。
- Label evaluability cache key: `repo + label(name/description)`. | Labels 可评估性缓存键：`仓库 + labels(name/description)`。
- Difficulty cache key: `repo + category + issue content`. | 难度评估缓存键：`仓库 + 分类 + issue 内容`。
- Difficulty results are appended to the same Markdown report. | 难度评估结果会拼接在同一份 Markdown 报告中。
- To save tokens, issue body is truncated to the first 500 characters. | 为节省 token，Issue body 会截断到前 500 个字符。
