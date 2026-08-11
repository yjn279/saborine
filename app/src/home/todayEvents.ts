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

// きょうの相手の記録のうち、いちばん新しい1件(新しい順に並ぶtodayEventsの先頭)。
export function findPartnerEvent(events: TodayEvent[]): TodayEvent | null {
  return events.find((event) => !event.mine) ?? null;
}

// 指定した記録に、すでにありがとうが届いているか。
export function isEventThanked(events: TodayEvent[], eventId: string): boolean {
  return events.find((event) => event.id === eventId)?.thanked ?? false;
}
