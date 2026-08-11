// 新しく解放された仕草を、その直後だけ知らせるための判断。react-native・expo・
// 端末保存のいずれも読み込まない。前に端末で見た解放済み仕草の一覧(app/src/affection/gestureStorage.ts)
// と、いまの一覧を比べるだけで、どの仕草を知らせるかを決める。

import type { SaborineGesture } from "../components/saborine/types";
import { GESTURE_ACTIONS } from "./gestureMessages";

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

// 知らせの文面。回数・残り・順位は扱わず、いま何が起きたかだけを短く伝える。
export function buildGestureNoticeMessage(gesture: SaborineGesture): string {
  return `サボリーヌが、${GESTURE_ACTIONS[gesture]}ようになったよ`;
}
