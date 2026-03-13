Features:
- Issue 自动分类
- Issue 难度评估 - TODO
- 推荐可以贡献的 Issue - TODO
- 项目健康度分析 - TODO

Usage:
- `gia`：分析仓库 Issue 分类与难度评估，并生成 `owner-repo-issue-report.md`
- `gia config`：配置 GitHub Token 和 AI Config（`baseUrl`、`model`、`apiKey`）
- `gia config get`：查看当前已保存的配置（默认脱敏）
- `gia config get --show`：查看当前已保存的完整配置
- `gia cache clear`：清除本地 AI 缓存（Issue 分类 + 可评估 Labels + 难度评估）

Notes:
- Issue 自动分类会优先使用已有 label，再由 AI 补充未分类 issue
- AI 分类结果会按 `仓库 + labels + issue number + issue title` 做本地缓存，命中时不会重复请求
- Labels 可评估性分析结果会按 `仓库 + labels(name/description)` 做本地缓存，命中时不会重复请求
- Issue 难度评估结果会按 `仓库 + 分类 + issue 内容` 做本地缓存，命中时不会重复请求
- Issue 难度评估会直接交给 AI 分析，并拼接在同一份 Markdown 报告后面
- 为节省 token，Issue body 会截断到前 500 个字符
