#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EMSDK_DIR="$PROJECT_DIR/emsdk"

echo "=== Emscripten SDK セットアップ ==="

# emsdk がなければクローン
if [ ! -d "$EMSDK_DIR" ]; then
    echo "emsdk をクローン中..."
    git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
fi

cd "$EMSDK_DIR"

# 最新版をインストール
echo "Emscripten をインストール中..."
./emsdk install latest

# アクティベート
echo "Emscripten をアクティベート中..."
./emsdk activate latest

echo ""
echo "=== セットアップ完了 ==="
echo ""
echo "使用前に以下を実行してください:"
echo "  source $EMSDK_DIR/emsdk_env.sh"
echo ""
