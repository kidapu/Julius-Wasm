/**
 * Julius Forced Alignment - WASM ラッパー
 *
 * ブラウザで動作する日本語音素アライメント
 */

import { hiraganaToPhonemes, generateDict, generateDfa } from './hiragana-to-phoneme.js';

/**
 * Julius Forced Alignment クラス
 */
export class JuliusFA {
  constructor() {
    this.module = null;
    this.initialized = false;
    this.outputBuffer = [];
  }

  /**
   * 初期化
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) return;

    // WASM モジュールを読み込み
    const JuliusModule = (await import('../../dist/julius.js')).default;

    this.module = await JuliusModule({
      // stdout/stderr をキャプチャ
      print: (text) => {
        console.log('[Julius]', text);
        this.outputBuffer.push(text);
      },
      printErr: (text) => console.error('[Julius]', text),
    });

    this.initialized = true;
    console.log('JuliusFA initialized');
  }

  /**
   * 音声とテキストから音素タイミングを取得
   * @param {Blob|ArrayBuffer} audio - 音声データ (WAV, 16kHz, 16bit, mono)
   * @param {string} text - ひらがなテキスト
   * @returns {Promise<Array<{char: string, start: number, end: number, phonemes: string[]}>>}
   */
  async align(audio, text) {
    if (!this.initialized) {
      await this.init();
    }

    // 出力バッファをクリア
    this.outputBuffer = [];

    // 音声データを ArrayBuffer に変換
    let audioBuffer;
    if (audio instanceof Blob) {
      audioBuffer = await audio.arrayBuffer();
    } else {
      audioBuffer = audio;
    }

    // ひらがな → 音素変換
    const { phonemes, hiraganaInfo } = hiraganaToPhonemes(text);

    // 文法ファイル生成
    const dictContent = generateDict(phonemes);
    const dfaContent = generateDfa();

    console.log('Dict:', dictContent);
    console.log('DFA:', dfaContent);

    // 仮想ファイルシステムに書き込み
    const FS = this.module.FS;

    // 作業ディレクトリ作成
    try {
      FS.mkdir('/work');
    } catch (e) {
      // already exists
    }

    // 音声ファイル書き込み
    const audioData = new Uint8Array(audioBuffer);
    FS.writeFile('/work/input.wav', audioData);

    // 文法ファイル書き込み
    FS.writeFile('/work/input.dict', dictContent);
    FS.writeFile('/work/input.dfa', dfaContent);
    FS.writeFile('/work/filelist.txt', '/work/input.wav\n');

    // Julius 実行 (モノフォンモデルでは -hlist 不要)
    const args = [
      '-h', '/models/hmmdefs_monof_mix16_gid.binhmm',
      '-dfa', '/work/input.dfa',
      '-v', '/work/input.dict',
      '-input', 'rawfile',
      '-filelist', '/work/filelist.txt',
      '-palign',           // 音素アライメント出力
    ];

    console.log('Julius args:', args.join(' '));

    // main() を呼び出し
    try {
      this.module.callMain(args);
    } catch (e) {
      console.error('Julius execution failed:', e);
      throw e;
    }

    // stdout 出力をパース
    const output = this.outputBuffer.join('\n');
    console.log('Julius output:', output);

    // 音素アライメント結果をパース
    const phonemeSegments = this.parseAlignmentOutput(output);

    if (phonemeSegments.length === 0) {
      throw new Error('No alignment result found');
    }

    // 音素セグメント → ひらがなセグメントに変換
    const result = this.phonemesToHiragana(hiraganaInfo, phonemeSegments);

    return result;
  }

  /**
   * Julius の出力から音素アライメントをパース
   * @param {string} output - Julius stdout 出力
   * @returns {Array<{phoneme: string, start: number, end: number}>}
   */
  parseAlignmentOutput(output) {
    const segments = [];
    const lines = output.split('\n');

    // 音素アライメントセクションを探す
    let inPhonemeSection = false;

    for (const line of lines) {
      // 音素アライメントの開始
      if (line.includes('=== begin forced alignment ===')) {
        inPhonemeSection = true;
        continue;
      }

      // 音素アライメントの終了
      if (line.includes('=== end forced alignment ===')) {
        inPhonemeSection = false;
        continue;
      }

      if (inPhonemeSection) {
        // 形式: [ start end] score phoneme
        // 例: [    0    30]  -5.000 silB
        const match = line.match(/\[\s*(\d+)\s+(\d+)\]\s+[\d.-]+\s+(\S+)/);
        if (match) {
          const startFrame = parseInt(match[1], 10);
          const endFrame = parseInt(match[2], 10);
          const phoneme = match[3];

          // フレーム番号を秒に変換 (10ms = 1フレーム)
          segments.push({
            start: startFrame * 0.01,
            end: endFrame * 0.01,
            phoneme: phoneme,
          });
        }
      }
    }

    return segments;
  }

  /**
   * 音素セグメント → ひらがなセグメントに変換
   * @param {Array<{char: string, phonemes: string[]}>} hiraganaInfo
   * @param {Array<{phoneme: string, start: number, end: number}>} phonemeSegments
   * @returns {Array<{char: string, start: number, end: number, phonemes: string[]}>}
   */
  phonemesToHiragana(hiraganaInfo, phonemeSegments) {
    // silB, silE を除外
    const phonemes = phonemeSegments.filter(
      (s) => s.phoneme !== 'silB' && s.phoneme !== 'silE'
    );

    const result = [];
    let phonemeIdx = 0;

    for (const info of hiraganaInfo) {
      const expectedCount = info.phonemes.length;

      if (phonemeIdx + expectedCount > phonemes.length) {
        console.warn('Phoneme count mismatch');
        break;
      }

      const start = phonemes[phonemeIdx].start;
      const end = phonemes[phonemeIdx + expectedCount - 1].end;
      const actualPhonemes = phonemes
        .slice(phonemeIdx, phonemeIdx + expectedCount)
        .map((p) => p.phoneme);

      result.push({
        char: info.char,
        start,
        end,
        duration: end - start,
        phonemes: actualPhonemes,
      });

      phonemeIdx += expectedCount;
    }

    return result;
  }
}

export default JuliusFA;
