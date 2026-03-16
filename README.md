# gia-cli

[English](#english) | [中文](#zh-cn)

<a id="english"></a>
## English

### Features
- Automatic issue categorization
- Issue difficulty assessment
- Recommend contribution candidates (TODO)
- Repository health analysis (TODO)

### Usage
- `gia`: Analyze open issues and generate `owner-repo-issue-report.md`. During prompts, select `First 30`, `Custom issue limit`, or `All open issues`. For non-all modes, you can set a page to analyze batches (e.g. `limit=30`, `page=2` -> issues `31-60`).
- `gia config`: Configure GitHub token and AI config (`baseUrl`, `model`, `apiKey`).
- `gia config get`: Show saved config with masked values.
- `gia config get --show`: Show full saved config values.
- `gia cache clear`: Clear local AI cache (issue classification + evaluable labels + difficulty assessment).

### Notes
- Existing labels are used first, then AI classifies the remaining uncategorized issues.
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
- 项目健康度分析（TODO）

### 用法
- `gia`：分析仓库 open issues 并生成 `owner-repo-issue-report.md`，在交互里可选 `前 30 条`、`自定义数量` 或 `全部 open issue`。非全部模式可输入页码进行分段分析（例如 `limit=30`、`page=2` 对应 `31-60`）。
- `gia config`：配置 GitHub Token 和 AI 配置（`baseUrl`、`model`、`apiKey`）。
- `gia config get`：查看当前已保存配置（默认脱敏）。
- `gia config get --show`：查看当前已保存配置的完整值。
- `gia cache clear`：清除本地 AI 缓存（Issue 分类 + 可评估 Labels + 难度评估）。

### 说明
- Issue 自动分类会优先使用已有 label，再由 AI 补充未分类 issue。
- AI 分类缓存键：`仓库 + labels + issue number + issue title`。
- Labels 可评估性缓存键：`仓库 + labels(name/description)`。
- 难度评估缓存键：`仓库 + 分类 + issue 内容`。
- 难度评估结果会拼接在同一份 Markdown 报告中。
- 为节省 token，Issue body 会截断到前 500 个字符。

[返回顶部](#gia-cli)
