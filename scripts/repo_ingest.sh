#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-.}"
mkdir -p artifacts
find "$ROOT" -type f \
  ! -path '*/node_modules/*' \
  ! -path '*/dist/*' \
  ! -path '*/build/*' \
  | sort > artifacts/file-tree.txt
printf '{"project":"demo","modules":[]}' > artifacts/repo-map.json
printf '' > artifacts/chunks.jsonl
