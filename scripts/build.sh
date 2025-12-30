#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_DIR/src"
JULIUS_DIR="$SRC_DIR/julius"
DIST_DIR="$PROJECT_DIR/dist"
MODELS_DIR="$PROJECT_DIR/models"

# Emscripten 環境チェック
if ! command -v emcc &> /dev/null; then
    echo "Error: emcc が見つかりません"
    echo "以下を実行してください:"
    echo "  source $PROJECT_DIR/emsdk/emsdk_env.sh"
    exit 1
fi

echo "=== Julius WASM ビルド ==="

# Julius ソースをダウンロード
if [ ! -d "$JULIUS_DIR" ]; then
    echo "Julius をダウンロード中..."
    mkdir -p "$SRC_DIR"
    cd "$SRC_DIR"

    # Julius 4.6 をダウンロード
    curl -L -o julius-4.6.tar.gz https://github.com/julius-speech/julius/archive/refs/tags/v4.6.tar.gz
    tar xzf julius-4.6.tar.gz
    mv julius-4.6 julius
    rm julius-4.6.tar.gz
fi

# 日本語モデルをコピー
echo "日本語モデルをコピー中..."
SEGKIT_MODELS="$PROJECT_DIR/../01-Julius/models/segmentation-kit/models"
if [ -d "$SEGKIT_MODELS" ]; then
    mkdir -p "$MODELS_DIR"
    cp -r "$SEGKIT_MODELS"/* "$MODELS_DIR/"
    echo "モデルをコピーしました: $(ls "$MODELS_DIR")"
else
    echo "Warning: segmentation-kit モデルが見つかりません: $SEGKIT_MODELS"
fi

# libsent をビルド
echo "libsent をビルド中..."
cd "$JULIUS_DIR/libsent"
if [ ! -f "libsent.a" ]; then
    make clean 2>/dev/null || true
    emconfigure ./configure --enable-words-int --with-mictype=wasm CFLAGS="-O2"
    emmake make -j4
fi

# libjulius をビルド
echo "libjulius をビルド中..."
cd "$JULIUS_DIR/libjulius"
if [ ! -f "libjulius.a" ]; then
    make clean 2>/dev/null || true
    emconfigure ./configure CFLAGS="-O2"
    emmake make -j4
fi

# julius アプリをビルド
echo "julius をビルド中..."
cd "$JULIUS_DIR/julius"
make clean 2>/dev/null || true
emmake make

# ブラウザ用 WASM モジュールを生成
echo "ブラウザ用 WASM モジュールを生成中..."
mkdir -p "$DIST_DIR"

emcc \
    -O2 \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="JuliusModule" \
    -s EXPORTED_FUNCTIONS='["_main", "_malloc", "_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "FS", "UTF8ToString", "callMain"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=67108864 \
    -s FORCE_FILESYSTEM=1 \
    -s EXIT_RUNTIME=0 \
    --preload-file "$MODELS_DIR"@/models \
    "$JULIUS_DIR/julius/main.o" \
    "$JULIUS_DIR/julius/recogloop.o" \
    "$JULIUS_DIR/julius/module.o" \
    "$JULIUS_DIR/julius/output_module.o" \
    "$JULIUS_DIR/julius/output_stdout.o" \
    "$JULIUS_DIR/julius/output_file.o" \
    "$JULIUS_DIR/julius/record.o" \
    "$JULIUS_DIR/julius/charconv.o" \
    "$JULIUS_DIR/libjulius/libjulius.a" \
    "$JULIUS_DIR/libsent/libsent.a" \
    -lm \
    -o "$DIST_DIR/julius.js"

echo ""
echo "=== ビルド完了 ==="
echo "出力:"
ls -lh "$DIST_DIR/"
