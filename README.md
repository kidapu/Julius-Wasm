# Julius WASM - ブラウザで動く日本語音素アライメント

Julius 音声認識エンジンを WebAssembly にコンパイルし、音声データをサーバーに送信せずブラウザ内だけで音素解析が完結する日本語音素アライメント（Forced Alignment）を実現。

## 特徴

- **ブラウザ内で完結**: 音声データを外部に送信せず、クライアントサイドのみで処理
- **日本語対応**: ひらがなテキストから音素タイミングを抽出
- **リアルタイム解析**: 録音終了後すぐに結果を表示
- **Variable Font アニメーション**: 音量・ピッチに応じたフォントサイズ/ウェイト変化
- **ダウンロードサイズ**: 約 4.1MB（WASM 510KB + HMMモデル 3.5MB + その他）

## デモ

https://kidapu.github.io/Julius-Wasm/

## ビルド

### 前提条件

- Emscripten SDK (emsdk)
- Git

### 手順

```bash
# 1. Emscripten SDK セットアップ
./build-scripts/setup-emsdk.sh
source ./emsdk/emsdk_env.sh

# 2. Julius ソースをクローン（初回のみ）
git clone https://github.com/julius-speech/julius.git src/julius

# 3. WASM ビルド
./build-scripts/build.sh
```


## 使い方

### JavaScript API

```javascript
import { hiraganaToPhonemes, generateDict, generateDfa } from './src/js/hiragana-to-phoneme.js';

// WASM モジュール初期化
const JuliusModule = (await import('./dist/julius.js')).default;
const julius = await JuliusModule({
  print: (text) => console.log('[Julius]', text),
  printErr: (text) => console.log('[Julius stderr]', text),
  locateFile: (path) => './dist/' + path,
});

// ひらがな → 音素変換
const text = 'こんにちは';
const { phonemes, hiraganaInfo } = hiraganaToPhonemes(text);

// 文法ファイル生成
const dictContent = generateDict(phonemes);
const dfaContent = generateDfa(phonemes.length + 2);

// 仮想ファイルシステムに書き込み
const FS = julius.FS;
FS.mkdir('/work');
FS.writeFile('/work/input.wav', wavData);  // 16kHz, 16bit, mono
FS.writeFile('/work/input.dict', dictContent);
FS.writeFile('/work/input.dfa', dfaContent);
FS.writeFile('/work/filelist.txt', '/work/input.wav\n');

// Julius 実行
julius.callMain([
  '-h', '/models/hmmdefs_monof_mix16_gid.binhmm',
  '-dfa', '/work/input.dfa',
  '-v', '/work/input.dict',
  '-input', 'rawfile',
  '-filelist', '/work/filelist.txt',
  '-palign',
]);
```

### 出力フォーマット

```json
[
  {
    "char": "こ",
    "start": 0.12,
    "end": 0.25,
    "duration": 0.13,
    "phonemes": ["k", "o"],
    "volume_db": -15.2,
    "pitch_hz": 245
  }
]
```

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                     Browser                              │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │ MediaRecorder│───▶│ WAV変換     │───▶│ Julius WASM │ │
│  │ (WebM)      │    │ (16kHz mono)│    │             │ │
│  └─────────────┘    └─────────────┘    └──────┬──────┘ │
│                                               │        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────▼──────┐ │
│  │ Variable    │◀───│ Web Audio   │◀───│ Alignment  │ │
│  │ Font Anim   │    │ (vol/pitch) │    │ Results    │ │
│  └─────────────┘    └─────────────┘    └────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 構造

```
Julius-Wasm/
├── index.html            # デモページ (GitHub Pages)
├── dist/                 # ビルド成果物
│   ├── julius.js
│   ├── julius.wasm
│   └── julius.data
├── src/js/               # JavaScript ラッパー
│   ├── julius-fa.js
│   └── hiragana-to-phoneme.js
├── models/               # 日本語音響モデル
└── build-scripts/        # ビルドスクリプト（実行時は不要）
    ├── setup-emsdk.sh
    └── build.sh
```

## 技術詳細

### Julius 設定

- **HMM モデル**: モノフォン 16混合ガウス (`hmmdefs_monof_mix16_gid.binhmm`)
- **音響パラメータ**: MFCC_E_D_N_Z (25次元)
- **サンプリング**: 16kHz
- **フレームシフト**: 10ms

### WASM ビルド設定

```bash
emcc ... \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORTED_FUNCTIONS="['_main', '_malloc', '_free']" \
  -s EXPORTED_RUNTIME_METHODS="['FS', 'callMain']" \
  --preload-file models
```

### Web Audio 解析

- **音量**: RMS → dB 変換
- **ピッチ**: Autocorrelation アルゴリズム
- **Variable Font**: Noto Sans JP (wght 100-900)
  - 音量 → フォントサイズ (4rem〜7rem)
  - ピッチ → フォントウェイト (高い=細い, 低い=太い)

## 制限事項

- 録音からの WAV 変換が一部ブラウザで正常に動作しない場合がある
- 長い音声（10秒以上）は処理に時間がかかる
- カタカナ・漢字は非対応（ひらがなのみ）

## ライセンス

- Julius: BSD-3-Clause License
- このプロジェクト: MIT License
