#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8080}"
printf '\n  ФЕНЁК запускается: http://localhost:%s\n\n' "$PORT"
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
else
  echo "Нужен Python 3 (или запустите любой статический сервер в этой папке)." >&2
  exit 1
fi
