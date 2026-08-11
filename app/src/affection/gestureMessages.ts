// 仕草ごとの動作の説明。なつき度が育っていることを伝える文(growth.ts)と、解放された
// 直後の知らせ(gestureNotice.ts)の両方が、この同じ動作の説明を土台に文を組み立てる。
// docs/mvp.md の解放順(こちらを向く→名前を呼ぶ→近寄ってくる→特別な仕草)と揃える。

import type { SaborineGesture } from "../components/saborine/types";

export const GESTURE_ACTIONS: Record<SaborineGesture, string> = {
  facesPartner: "きみの ほうを むいてくれる",
  callsName: "なまえを よんでくれる",
  approaches: "ちかくに よってきてくれる",
  specialGesture: "とくべつな しぐさを みせてくれる",
};
