---
name: deepwiki-system
description: 生成系统级架构设计文档的 Skill。当用户询问"系统设计文档"、"架构设计"、"整体设计"、"仓库结构分析"、"模块关系"、"架构图"、或要求生成 Mermaid 系统图时，**务必使用此 Skill**。如果用户只问单个模块的设计细节或"技术设计文档"，则使用 deepwiki skill。
---

# DeepWiki System Architecture Skill

## 用途

**该 Skill 专门用于生成系统级架构设计文档**，不适用于单个模块文档。

| 触发词 | 说明 |
|--------|------|
| "系统设计文档" | 生成整体架构文档 |
| "架构设计文档" | 生成架构设计文档 |
| "整体设计文档" | 生成整体设计文档 |
| "仓库结构分析" | 分析整体模块关系 |
| "架构图" / "系统图" | 生成系统架构 Mermaid 图 |
| "deepwiki-system" | 显式调用此 Skill |

**模块级文档请使用**: `deepwiki` skill（触发词："模块文档"、"技术设计文档"、"单模块分析"）

## Compatibility

- 需要 Read, Grep, Glob, Bash 工具
- 可选：Mermaid 渲染环境（用于架构图预览）
- 输出目录：`doc/` 根目录

## 输出目标

```
doc/Scheduler_Architecture_Design.md  ← 系统架构文档
artifacts/architecture.mmd            ← Mermaid 架构图
artifacts/module-summaries.json       ← 模块摘要集合
```

## 与 deepwiki skill 的区别

| 特性 | deepwiki-system (本 Skill) | deepwiki |
|------|---------------------------|----------|
| 输出级别 | 系统级架构文档 | 模块级设计文档 |
| 输出位置 | `doc/` 根目录 | `doc/tech-docs/` |
| 触发词 | 系统设计、架构设计、整体设计、架构图 | 模块文档、技术设计、单模块 |
| 内容范围 | 多组件协作、数据流、线程模型 | 单模块 API、实现细节 |
| 图表类型 | 系统架构图、组件关系图 | 类图、状态图、流程图 |

## 何时读取参考文件

采用渐进式加载策略，按需读取参考文件：

| 任务 | 参考文件 | 何时读取 |
|------|----------|----------|
| 代码分析 | `references/code-analysis.md` | 分析仓库结构时 |
| 架构图生成 | `references/architecture-mermaid.md` | 需要生成 Mermaid 图时 |
| 模块摘要 | `references/module-summary.md` | 需要为模块生成摘要时 |
| RAG 问答 | `references/rag-qa.md` | 回答代码库问题时 |
| 分块策略 | `references/chunking-policy.md` | 需要理解分块规则时 |
| 检索规范 | `references/retrieval-spec.md` | 需要理解检索策略时 |
| 分类体系 | `references/taxonomy.md` | 需要模块分类时 |

## Examples

**Example 1: 系统架构分析**
- Input: "帮我生成这个仓库的系统设计文档"
- Output: `doc/Scheduler_Architecture_Design.md` 包含：
  - 分层架构 Mermaid 图
  - 核心模块职责表
  - 数据流描述
  - 线程模型（如有）
  - 配置系统说明

**Example 2: 架构图生成**
- Input: "生成系统架构 Mermaid 图"
- Output: 可渲染的 Mermaid flowchart，展示：
  ```mermaid
  flowchart TD
    subgraph Interface
      UI[User Interface]
    end
    subgraph Application
      SVC[Core Service]
    end
    subgraph Data
      DB[(Database)]
    end
    UI --> SVC --> DB
  ```

**Example 3: 模块关系分析**
- Input: "分析仓库的模块关系和依赖"
- Output: JSON 结构的 repo map + 文字说明，包含模块名、路径、依赖方向

## 工作流程

1. **仓库结构分析**
   - 读取 `references/code-analysis.md`
   - 分析代码目录结构
   - 识别核心组件与入口点

2. **架构图生成**
   - 读取 `references/architecture-mermaid.md`
   - 生成 Mermaid 架构图
   - 使用 `templates/architecture-template.mmd` 作为参考

3. **模块摘要**
   - 读取 `references/module-summary.md`
   - 使用 `templates/module-summary-template.md` 为每个核心模块生成摘要

4. **整合输出**
   - 生成系统架构设计文档
   - 包含：分层架构、组件职责、数据流、线程模型、配置系统等

## Operating Model

- 输入优先使用 repo map、符号表、README、配置文件、入口文件
- 所有回答尽量引用文件路径、符号名、函数名、配置键
- 当证据不足时，明确写出"不确定"和缺失上下文
- 架构图默认输出 Mermaid flowchart 或 ASCII 架构图
- **不得臆造未在仓库中出现的服务、模块或依赖**

## Recommended Sequence

1. 读取 `references/workflows/repo-analysis.md`
2. 读取 `references/code-analysis.md` 并执行分析
3. 读取 `references/architecture-mermaid.md` 并生成架构图
4. 读取 `references/module-summary.md` 并批量生成模块摘要
5. 整合生成系统架构文档