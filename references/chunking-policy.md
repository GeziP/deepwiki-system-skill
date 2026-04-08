# Chunking Policy

- 小函数可合并到同文件片段。
- 大文件优先按导出符号切分。
- 配置文件按段落和键空间切分。
- 对自动生成文件降低权重或跳过。
- 对 `dist`, `build`, `coverage`, `node_modules` 默认排除。
