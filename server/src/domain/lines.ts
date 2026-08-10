// サボリーヌのアプリ内セリフ。促しの主語と場所はキャラクターとアプリ内だけに限る(docs/mvp.md:51)。
// 命令・催促・期限・「〜して」に類する言い回しは使わず、ひとりごとのつぶやきとしてだけ表示する。

export interface LineContext {
  // ふたりとも記録が3日途切れている(だらしなモード中)か
  isSloppy: boolean;
  // 相手の直近の記録に、自分がまだありがとうを送っていないか
  hasUnthankedPartnerChore: boolean;
  // 自分がこの24時間のうちに記録したか
  hasRecordedRecently: boolean;
}

const SLOPPY_LINE = "きょうは のんびり きぶんなんだ。ねぐせも なおしてないや。";
const THANKS_WAITING_LINE = "なんだか うれしいことが あったみたい。";
const NUDGE_LINE = "ゴミ出しでも ごはんになるんだって。";
const DEFAULT_LINE = "きょうも いっしょに いられて うれしいな。";

export function pickLine(context: LineContext): string {
  if (context.isSloppy) {
    return SLOPPY_LINE;
  }
  if (context.hasUnthankedPartnerChore) {
    return THANKS_WAITING_LINE;
  }
  if (!context.hasRecordedRecently) {
    return NUDGE_LINE;
  }
  return DEFAULT_LINE;
}
