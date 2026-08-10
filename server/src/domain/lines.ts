// サボリーヌのアプリ内セリフ。促しの主語と場所はキャラクターとアプリ内だけに限る(docs/mvp.md:51)。
// 命令・催促・期限・「〜して」に類する言い回しは使わず、ひとりごとのつぶやきとしてだけ表示する。

import { jstDayNumber } from "./week.js";

export interface LineContext {
  // ふたりとも記録が3日途切れている(だらしなモード中)か
  isSloppy: boolean;
  // 相手の直近の記録に、自分がまだありがとうを送っていないか
  hasUnthankedPartnerChore: boolean;
  // 自分がこの24時間のうちに記録したか
  hasRecordedRecently: boolean;
  // 促しのセリフを日替わりで選ぶための、ペアの識別子と現在時刻
  pairId: string;
  now: Date;
}

export type LineKind = "sloppy" | "thanksWaiting" | "nudge" | "default";

export interface Line {
  kind: LineKind;
  text: string;
}

const SLOPPY_LINE = "きょうは のんびり きぶんなんだ。ねぐせも なおしてないや。";
const THANKS_WAITING_LINE = "なんだか うれしいことが あったみたい。";
const DEFAULT_LINE = "きょうも いっしょに いられて うれしいな。";

// 促しの5案。ベータの聞き取りでそのまま提示できるよう一覧として公開する(docs/beta.md:168)。
export const NUDGE_LINES = [
  "ゴミ出しでも ごはんになるんだって。",
  "きみの 1かいは、いま いちばん えいようが あるんだって。",
  "コップ ひとつ あらうのも、りっぱな ごはんに なるらしいよ。",
  "きょうは なにして あそぼっか。あ、そうじも たのしいって きいたよ。",
  "ふたりぶん そろうと、ごはんが 3ばい おいしいんだって。",
];

// ペアの識別子から定まる固定値。全ペアが同じ日に同じ促しを見ないよう選ぶ添え字をずらす。
function pairOffset(pairId: string): number {
  let sum = 0;
  for (let i = 0; i < pairId.length; i += 1) {
    sum += pairId.charCodeAt(i);
  }
  return sum;
}

// 促しは、日本時間の日付とペアだけから決まる(乱数は使わない)。同じ日は同じ文面、日をまたぐと次の文面になる。
function pickNudgeLine(pairId: string, now: Date): string {
  const index = (jstDayNumber(now) + pairOffset(pairId)) % NUDGE_LINES.length;
  const line = NUDGE_LINES[index];
  if (line === undefined) {
    throw new Error(`促しのセリフの添え字が範囲外です: ${index}`);
  }
  return line;
}

export function pickLine(context: LineContext): Line {
  if (context.isSloppy) {
    return { kind: "sloppy", text: SLOPPY_LINE };
  }
  if (context.hasUnthankedPartnerChore) {
    return { kind: "thanksWaiting", text: THANKS_WAITING_LINE };
  }
  if (!context.hasRecordedRecently) {
    return { kind: "nudge", text: pickNudgeLine(context.pairId, context.now) };
  }
  return { kind: "default", text: DEFAULT_LINE };
}
