// 新しく解放された仕草を、その直後だけ知らせるための判断。react-native・expo・
// 端末保存のいずれも読み込まない。前に端末で見た解放済み仕草の一覧(app/src/affection/gestureStorage.ts)
// と、いまの一覧を比べるだけで、どの仕草を知らせるかを決める。

import type { SaborineGesture } from "../components/saborine/types";

export interface GestureNoticeInput {
  // /api/home がいま返している、解放済みの仕草の一覧(古い順)
  current: readonly SaborineGesture[];
  // 前に端末で見た解放済みの仕草の一覧。まだ一度も記録が無いときはnull
  previouslySeen: readonly SaborineGesture[] | null;
}

// 前に見た記録が端末に無いときは、これまでの解放をいまさら知らせない。
// 増えていないときも知らせない。2つ以上まとめて増えていたときは、最も新しい
// (現在の一覧でいちばん後ろの)ものだけを1つ知らせる。
export function decideGestureNotice(input: GestureNoticeInput): SaborineGesture | null {
  if (input.previouslySeen === null) {
    return null;
  }
  const previouslySeen = input.previouslySeen;
  const newlyUnlocked = input.current.filter((gesture) => !previouslySeen.includes(gesture));
  if (newlyUnlocked.length === 0) {
    return null;
  }
  return newlyUnlocked[newlyUnlocked.length - 1];
}

// 仕草ごとの知らせの文面。回数・残り・順位は扱わず、いま何が起きたかだけを短く伝える。
const GESTURE_NOTICE_MESSAGES: Record<SaborineGesture, string> = {
  facesPartner: "サボリーヌが、きみの ほうを むいてくれるようになったよ",
  callsName: "サボリーヌが、なまえを よんでくれるようになったよ",
  approaches: "サボリーヌが、ちかくに よってきてくれるようになったよ",
  specialGesture: "サボリーヌが、とくべつな しぐさを みせてくれるようになったよ",
};

export function buildGestureNoticeMessage(gesture: SaborineGesture): string {
  return GESTURE_NOTICE_MESSAGES[gesture];
}
