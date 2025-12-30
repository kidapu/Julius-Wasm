/**
 * ひらがな → 音素変換
 * segment_julius.pl の変換ルールを移植
 */

// ひらがな → 音素マッピング
const HIRAGANA_TO_PHONEMES = {
  // 基本母音
  'あ': ['a'], 'い': ['i'], 'う': ['u'], 'え': ['e'], 'お': ['o'],

  // か行
  'か': ['k', 'a'], 'き': ['k', 'i'], 'く': ['k', 'u'], 'け': ['k', 'e'], 'こ': ['k', 'o'],

  // さ行
  'さ': ['s', 'a'], 'し': ['sh', 'i'], 'す': ['s', 'u'], 'せ': ['s', 'e'], 'そ': ['s', 'o'],

  // た行
  'た': ['t', 'a'], 'ち': ['ch', 'i'], 'つ': ['ts', 'u'], 'て': ['t', 'e'], 'と': ['t', 'o'],

  // な行
  'な': ['n', 'a'], 'に': ['n', 'i'], 'ぬ': ['n', 'u'], 'ね': ['n', 'e'], 'の': ['n', 'o'],

  // は行
  'は': ['h', 'a'], 'ひ': ['h', 'i'], 'ふ': ['f', 'u'], 'へ': ['h', 'e'], 'ほ': ['h', 'o'],

  // ま行
  'ま': ['m', 'a'], 'み': ['m', 'i'], 'む': ['m', 'u'], 'め': ['m', 'e'], 'も': ['m', 'o'],

  // や行
  'や': ['y', 'a'], 'ゆ': ['y', 'u'], 'よ': ['y', 'o'],

  // ら行
  'ら': ['r', 'a'], 'り': ['r', 'i'], 'る': ['r', 'u'], 'れ': ['r', 'e'], 'ろ': ['r', 'o'],

  // わ行
  'わ': ['w', 'a'], 'を': ['o'], 'ん': ['N'],

  // 濁音 - が行
  'が': ['g', 'a'], 'ぎ': ['g', 'i'], 'ぐ': ['g', 'u'], 'げ': ['g', 'e'], 'ご': ['g', 'o'],

  // 濁音 - ざ行
  'ざ': ['z', 'a'], 'じ': ['j', 'i'], 'ず': ['z', 'u'], 'ぜ': ['z', 'e'], 'ぞ': ['z', 'o'],

  // 濁音 - だ行
  'だ': ['d', 'a'], 'ぢ': ['j', 'i'], 'づ': ['z', 'u'], 'で': ['d', 'e'], 'ど': ['d', 'o'],

  // 濁音 - ば行
  'ば': ['b', 'a'], 'び': ['b', 'i'], 'ぶ': ['b', 'u'], 'べ': ['b', 'e'], 'ぼ': ['b', 'o'],

  // 半濁音 - ぱ行
  'ぱ': ['p', 'a'], 'ぴ': ['p', 'i'], 'ぷ': ['p', 'u'], 'ぺ': ['p', 'e'], 'ぽ': ['p', 'o'],

  // 特殊
  'っ': ['q'],
  'ー': [], // 長音は前の母音を延長（別処理）

  // 拗音 - き
  'きゃ': ['ky', 'a'], 'きゅ': ['ky', 'u'], 'きょ': ['ky', 'o'],

  // 拗音 - し
  'しゃ': ['sh', 'a'], 'しゅ': ['sh', 'u'], 'しょ': ['sh', 'o'],

  // 拗音 - ち
  'ちゃ': ['ch', 'a'], 'ちゅ': ['ch', 'u'], 'ちょ': ['ch', 'o'],

  // 拗音 - に
  'にゃ': ['ny', 'a'], 'にゅ': ['ny', 'u'], 'にょ': ['ny', 'o'],

  // 拗音 - ひ
  'ひゃ': ['hy', 'a'], 'ひゅ': ['hy', 'u'], 'ひょ': ['hy', 'o'],

  // 拗音 - み
  'みゃ': ['my', 'a'], 'みゅ': ['my', 'u'], 'みょ': ['my', 'o'],

  // 拗音 - り
  'りゃ': ['ry', 'a'], 'りゅ': ['ry', 'u'], 'りょ': ['ry', 'o'],

  // 拗音 - ぎ
  'ぎゃ': ['gy', 'a'], 'ぎゅ': ['gy', 'u'], 'ぎょ': ['gy', 'o'],

  // 拗音 - じ
  'じゃ': ['j', 'a'], 'じゅ': ['j', 'u'], 'じょ': ['j', 'o'],

  // 拗音 - び
  'びゃ': ['by', 'a'], 'びゅ': ['by', 'u'], 'びょ': ['by', 'o'],

  // 拗音 - ぴ
  'ぴゃ': ['py', 'a'], 'ぴゅ': ['py', 'u'], 'ぴょ': ['py', 'o'],
};

// 母音リスト（長音処理用）
const VOWELS = ['a', 'i', 'u', 'e', 'o'];

/**
 * ひらがなテキストを音素列に変換
 * @param {string} text - ひらがなテキスト
 * @returns {Object} { phonemes: string[], hiraganaInfo: Array<{char, phonemes}> }
 */
export function hiraganaToPhonemes(text) {
  const phonemes = [];
  const hiraganaInfo = [];
  let lastVowel = null;

  let i = 0;
  while (i < text.length) {
    // 2文字の拗音をチェック
    if (i + 1 < text.length) {
      const twoChar = text.substring(i, i + 2);
      if (HIRAGANA_TO_PHONEMES[twoChar]) {
        const p = HIRAGANA_TO_PHONEMES[twoChar];
        phonemes.push(...p);
        hiraganaInfo.push({ char: twoChar, phonemes: [...p] });
        if (p.length > 0) {
          lastVowel = p[p.length - 1];
        }
        i += 2;
        continue;
      }
    }

    // 1文字
    const char = text[i];

    // 長音記号の処理
    if (char === 'ー' && lastVowel && VOWELS.includes(lastVowel)) {
      phonemes.push(lastVowel);
      hiraganaInfo.push({ char: 'ー', phonemes: [lastVowel] });
      i++;
      continue;
    }

    if (HIRAGANA_TO_PHONEMES[char]) {
      const p = HIRAGANA_TO_PHONEMES[char];
      phonemes.push(...p);
      hiraganaInfo.push({ char, phonemes: [...p] });
      if (p.length > 0) {
        lastVowel = p[p.length - 1];
      }
    } else if (char.trim()) {
      // 未知の文字
      console.warn(`Unknown character: ${char}`);
    }

    i++;
  }

  return { phonemes, hiraganaInfo };
}

/**
 * Julius用の .dict ファイル内容を生成
 * segment_julius.pl 形式: 各音素が1ワードとして定義される
 * @param {string[]} phonemes - 音素列
 * @returns {string} dict ファイル内容
 */
export function generateDict(phonemes) {
  // silB + phonemes + silE の各要素を1ワードとして定義
  const words = ['silB', ...phonemes, 'silE'];
  let dict = '';
  for (let i = 0; i < words.length; i++) {
    dict += `${i}\t[w_${i}]\t${words[i]}\n`;
  }
  return dict;
}

/**
 * Julius用の .dfa ファイル内容を生成
 * segment_julius.pl 形式: 線形状態遷移
 * @param {number} numWords - 単語数 (silB + phonemes + silE)
 * @returns {string} dfa ファイル内容
 */
export function generateDfa(numWords) {
  const num = numWords - 1;  // 最後のインデックス
  let dfa = '';

  // 各状態の遷移を定義
  for (let i = 0; i <= num; i++) {
    const category = num - i;
    const nextState = i + 1;
    const isStart = i === 0 ? 1 : 0;
    dfa += `${i} ${category} ${nextState} 0 ${isStart}\n`;
  }

  // 終了状態
  dfa += `${num + 1} -1 -1 1 0\n`;

  return dfa;
}

export default {
  hiraganaToPhonemes,
  generateDict,
  generateDfa,
  HIRAGANA_TO_PHONEMES,
};
