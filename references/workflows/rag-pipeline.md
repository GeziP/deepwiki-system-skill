# Workflow: RAG Pipeline

1. 对源码和文档进行语义切块。
2. 生成 embedding 并建立向量索引。
3. 构建符号倒排索引与路径索引。
4. 查询时混合 lexical + semantic 检索。
5. 使用 `prompts/rag-qa.md` 组装最终答案。
