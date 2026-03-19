#!/bin/zsh

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

PORT=8080
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

LOCAL_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")"

echo ""
echo "猛健樂紀錄伺服器準備啟動中..."
echo "專案位置: $SCRIPT_DIR"
echo "電腦開啟網址: http://localhost:$PORT"
echo "手機同 Wi-Fi 可開啟: http://$LOCAL_IP:$PORT"
echo ""
echo "按 Ctrl+C 可停止伺服器。"
echo ""

python3 -m http.server "$PORT" &
SERVER_PID=$!

sleep 2
TARGET_URL="http://localhost:$PORT"

osascript <<EOF >/dev/null 2>&1
tell application "Safari"
  activate
  open location "$TARGET_URL"
end tell
EOF

if [ $? -ne 0 ]; then
  open "$TARGET_URL"
fi

echo "如果瀏覽器沒有自動跳出，請手動打開：$TARGET_URL"
echo "手機網址：http://$LOCAL_IP:$PORT"

wait "$SERVER_PID"
