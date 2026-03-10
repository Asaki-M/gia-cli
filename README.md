Features:
- Issue 自动分类
- Issue 难度评估
- 推荐可以贡献的 Issue
- 项目健康度分析

Usage:
- `gia`：分析仓库 Issue 分类与难度评估，并生成 `owner-repo-issue-report.md`
- `gia config`：配置 GitHub Token 和 Gemini API Key
- `gia config get`：查看当前已保存的配置（默认脱敏）
- `gia config get --show`：查看当前已保存的完整配置

Notes:
- Issue 自动分类会优先使用已有 label，再由 AI 补充未分类 issue
- Issue 难度评估会直接交给 AI 分析，并拼接在同一份 Markdown 报告后面
- 为节省 token，Issue body 会截断到前 500 个字符
