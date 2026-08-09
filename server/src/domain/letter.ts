// サボリーヌからの手紙。招待の主語を人からキャラクターへ移し替える(docs/mvp.md:26)。
// 文面は3行以内、家事・分担・不満に類する言葉を一切含まない定型文とする。
export const LETTER_LINES: readonly string[] = [
  "ぼく、サボリーヌ。",
  "いま、里親が ひとりだけなんだ。",
  "もうひとりの里親に、なってくれる?",
];

// 責めに読める語。将来ここに文言を足す場合の安全弁として公開する。
// カタカナの犬の名前「サボリーヌ」を誤検出しないよう、ひらがなの「サボり/サボっ」だけに絞る。
const BLAME_WORD_PATTERN = /(家事|分担|手伝|サボ[りっ])/;

export function containsBlameWords(text: string): boolean {
  return BLAME_WORD_PATTERN.test(text);
}
