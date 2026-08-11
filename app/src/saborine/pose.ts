// ホームで出すサボリーヌの姿を決める。react-native・expo・端末保存のいずれも読み込まない。
// サーバーが返すセリフの種類(serifKind)とだけ揃え、画面側に独自の条件を持たせない。

import type { HomeState } from "../api/home";
import type { SaborinePose } from "../components/saborine/types";

export interface DecidePoseInput {
  serifKind: HomeState["saborine"]["serifKind"];
  // ありがとうを送った直後かどうか
  isEating: boolean;
}

export function decidePose(input: DecidePoseInput): SaborinePose {
  if (input.isEating) {
    return "eating";
  }
  switch (input.serifKind) {
    case "sloppy":
      return "sloppy";
    case "thanksWaiting":
      return "happy";
    // 促しているあいだは、跳ねる動きで目を向けてもらう(app/app/index.tsx)。
    // 寝ている姿だと動きと矛盾し、見てほしいときに見てもらえない。
    case "nudge":
      return "normal";
    default:
      return "normal";
  }
}
