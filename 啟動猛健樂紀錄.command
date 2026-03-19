#!/bin/zsh

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

PORT=8080

LOCAL_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")"

echo ""
echo "猛健樂紀錄伺服器準備啟動中..."
echo "專案位置: $SCRIPT_DIR"
echo "電腦開啟網址: http://localhost:$PORT"
echo "手機同 Wi-Fi 可開啟: http://$LOCAL_IP:$PORT"
echo ""
echo "按 Ctrl+C 可停止伺服器。"
echo ""

open "http://localhost:$PORT"
python3 -m http.server "$PORT"
