// きょうのできごと1件を、画面にどう見せるかを決める。react-native・expo・端末保存のいずれも読み込まない。
// サーバーが返す4項目(id・choreType・mine・thanked)だけを見て判断し、件数・時刻・順位は持ち込まない。

import type { TodayEvent } from "../api/home";

export interface TodayEventView {
  // 画面に出す一文。数字・時刻・順位、相手を責める言い回しは含まない。
  text: string;
  // ありがとうのボタンを出すかどうか(自分の記録には出さない)。
  showThanksButton: boolean;
  // 送り済みかどうか(showThanksButtonがtrueのときだけ意味を持つ)。
  thanked: boolean;
}

export function decideTodayEventView(event: TodayEvent): TodayEventView {
  if (event.mine) {
    return {
      text: `${event.choreType}を したよ`,
      showThanksButton: false,
      thanked: event.thanked,
    };
  }
  return {
    text: `${event.choreType}を してくれたよ`,
    showThanksButton: true,
    thanked: event.thanked,
  };
}
