# Retrieval Spec

## Sources
- Source code chunks
- README / docs chunks
- Module summaries
- Config and schema files
- Symbol index

## Ranking Strategy
1. lexical hit on symbol/path
2. semantic similarity on chunk text
3. module summary boost
4. recency / entrypoint boost

## Chunking Guidance
- 代码按语义边界切分：类、函数、接口、路由、配置块。
- 文档按标题层级切分。
- 每个 chunk 保留 `filepath`, `start_line`, `end_line`, `symbols`, `language`。
