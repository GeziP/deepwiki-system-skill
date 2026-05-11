# DeepWiki System Architecture Skill

系统级架构设计文档生成 Skill。扫描代码仓库，生成包含 Mermaid 架构图、模块摘要、数据流分析的系统设计文档。**双格式输出：Markdown + HTML。**

## 特性

- **Mermaid 架构图** — 分层架构 flowchart，客户端渲染，深色/浅色主题自适应
- **代码语法高亮** — highlight.js，C++ / JSON / Bash 自动识别
- **深色 / 浅色主题** — 跟随系统偏好，一键切换 + localStorage 记忆
- **模块折叠面板** — 模块详情自动折叠，按需展开
- **索引导航页** — 自动生成 `index.html`，支持搜索和分组筛选
- **单文件 HTML** — 零外部依赖（仅 CDN），可离线浏览 / 分享

## 目录

```
deepwiki-system-skill/
├── SKILL.md                    # Skill 入口说明
├── README.md                   # 本文件
├── skill.yaml                  # 技能元数据
├── template-system.html        # 系统文档 HTML 模板（含 Mermaid.js + highlight.js）
├── template-index.html         # 索引导航页模板
├── system-md-to-html.js        # MD → HTML 转换器
├── references/                 # 核心系统提示词、工作流
├── templates/                  # Mermaid、摘要与问答输出模板
├── schemas/                    # 中间产物 JSON Schema
├── tests/                      # Evals 测试用例
├── scripts/                    # 仓库解析脚本
└── examples/                   # 输入输出示例
```

## 输出

| 输出 | 路径 | 格式 |
|------|------|------|
| 系统架构文档 | `doc/<Name>_Design.md` | Markdown |
| 系统架构文档 | `doc/<Name>_Design.html` | HTML（含 Mermaid + 代码高亮） |
| 索引导航页 | `doc/index.html` | HTML |
| 架构图 | `artifacts/architecture.mmd` | Mermaid |
| 模块摘要 | `artifacts/module-summaries.json` | JSON |

## 快速开始

```bash
# Claude Code
git submodule add https://github.com/GeziP/deepwiki-system-skill.git .claude/skills/deepwiki-system-skill

# Cursor
git submodule add https://github.com/GeziP/deepwiki-system-skill.git .cursor/skills/deepwiki-system-skill
```

## 使用

```
> 生成系统设计文档
> 帮我分析这个仓库的架构
> 生成系统架构 Mermaid 图
```

生成 Markdown 后，运行转换器生成 HTML：

```bash
node system-md-to-html.js --all
node system-md-to-html.js --index "项目名" "项目描述"
```

## 预期能力

1. 扫描代码仓库并输出 repo map
2. 基于 repo map 生成 Mermaid 架构图
3. 为模块生成统一结构摘要
4. 基于代码块、文档块和符号索引执行 RAG 问答
5. 输出双格式文档（Markdown + HTML）
