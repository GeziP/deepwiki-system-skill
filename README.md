# DeepWiki-System Skill

> 系统级架构设计文档生成 Skill，基于 DeepWiki 风格构建

## 项目描述

DeepWiki-System 是一个面向代码库理解与系统架构分析的 AI Skill。它能够：

- **仓库结构分析**：扫描代码仓库，识别入口点、核心模块、依赖关系
- **架构图生成**：基于分析结果生成 Mermaid 系统架构图
- **模块摘要生成**：为每个核心模块生成统一结构的技术摘要
- **RAG 问答**：基于代码块、文档块和符号索引回答技术问题

与模块级文档 Skill（`deepwiki`）不同，本 Skill 专注于**系统级**的架构视图，输出多组件协作、数据流、分层架构等宏观视角。

## Tags

`architecture` `documentation` `mermaid` `rag` `code-analysis` `system-design` `deepwiki` `zh-CN`

## 安装

将此 Skill 安装到 Claude Code：

```bash
# 方式一：克隆到 skills 目录
git clone https://github.com/your-org/deepwiki-system-skill.git ~/.claude/skills/deepwiki-system

# 方式二：直接使用 .skill 文件（如有）
# 将 deepwiki-system.skill 文件放入 ~/.claude/skills/
```

## 使用方法

### 触发词

以下短语会触发此 Skill：

| 触发词 | 说明 |
|--------|------|
| `"系统设计文档"` | 生成整体架构文档 |
| `"架构设计文档"` | 生成架构设计文档 |
| `"整体设计文档"` | 生成整体设计文档 |
| `"仓库结构分析"` | 分析整体模块关系 |
| `"架构图"` / `"系统图"` | 生成系统架构 Mermaid 图 |

### 示例用法

```text
用户: 帮我生成这个仓库的系统设计文档
Claude: [触发 deepwiki-system] 分析代码结构，生成架构图和模块摘要...

用户: 生成系统架构 Mermaid 图
Claude: [触发 deepwiki-system] 生成 flowchart TD 架构图...

用户: 分析仓库的模块关系和依赖
Claude: [触发 deepwiki-system] 输出 repo map 和模块依赖表...
```

### 与 deepwiki Skill 的区别

| 特性 | deepwiki-system (本 Skill) | deepwiki |
|------|---------------------------|----------|
| 输出级别 | 系统级架构文档 | 模块级设计文档 |
| 输出位置 | `doc/` 根目录 | `doc/tech-docs/` |
| 触发词 | 系统设计、架构设计、整体设计 | 模块文档、技术设计、单模块 |
| 内容范围 | 多组件协作、数据流、线程模型 | 单模块 API、实现细节 |
| 图表类型 | 系统架构图、组件关系图 | 类图、状态图、流程图 |

## 目录结构

```
deepwiki-system-skill/
├── SKILL.md              # Skill 入口（name + description + 使用指南）
├── skill.yaml            # 元数据、能力声明、路由信息
├── README.md             # 本文档
├── references/           # 参考文件（渐进式加载）
│   ├── code-analysis.md       # 代码分析系统提示词
│   ├── architecture-mermaid.md # 架构图生成系统提示词
│   ├── module-summary.md      # 模块摘要系统提示词
│   ├── rag-qa.md              # RAG 问答系统提示词
│   ├── chunking-policy.md     # 分块策略
│   ├── retrieval-spec.md      # 检索规范
│   ├── taxonomy.md            # 模块分类体系
│   └── workflows/
│       ├── repo-analysis.md   # 仓库分析工作流
│       └── rag-pipeline.md    # RAG 管线工作流
├── templates/            # 输出模板
│   ├── architecture-template.mmd   # Mermaid 架构图模板
│   ├── module-summary-template.md  # 模块摘要模板
│   └── rag-answer-template.md      # RAG 答案模板
├── schemas/              # JSON Schema
│   ├── chunk.schema.json        # 代码块结构
│   └── repo-map.schema.json     # Repo Map 结构
├── tests/                # 测试用例
│   └── evals.json              # Evals 定义
├── scripts/              # 脚本
│   └── repo_ingest.sh          # 仓库解析脚本
└── examples/             # 示例
    ├── example-question.md     # 示例问题
    └── example-answer.md       # 示例答案
```

## 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│  用户请求: "生成系统设计文档"                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. 仓库结构分析                                             │
│     - 读取 references/code-analysis.md                       │
│     - 分析目录结构、识别入口点、核心组件                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 架构图生成                                               │
│     - 读取 references/architecture-mermaid.md                │
│     - 生成 Mermaid flowchart，展示分层架构                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 模块摘要                                                 │
│     - 读取 references/module-summary.md                      │
│     - 为每个核心模块生成职责、API、依赖摘要                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. 整合输出                                                 │
│     - 输出 doc/Scheduler_Architecture_Design.md              │
│     - 包含架构图、模块摘要、数据流、配置系统                      │
└─────────────────────────────────────────────────────────────┘
```

## 输出产物

| 文件 | 说明 |
|------|------|
| `artifacts/repo-map.json` | 仓库结构映射 |
| `artifacts/chunks.jsonl` | 代码块索引 |
| `artifacts/module-summaries.json` | 模块摘要集合 |
| `artifacts/architecture.mmd` | Mermaid 架构图 |
| `doc/Scheduler_Architecture_Design.md` | 系统架构文档 |

## 测试

运行 Skill 评估：

```bash
# 使用 skill-creator 的评估流程
python -m scripts.run_eval --skill-path ./tests/evals.json
```

测试覆盖场景：
- 仓库概述分析
- 架构图生成
- 模块摘要生成
- RAG 问答
- 系统文档生成

## 贡献

欢迎提交 Issue 和 PR 来改进此 Skill。

## License

MIT

## 作者

team-ai