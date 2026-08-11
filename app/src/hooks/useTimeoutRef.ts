import { useEffect, useRef } from "react";

// setTimeoutの予約・差し替え・アンマウント時の後始末をまとめる。ホームのありがとう
// 演出・新しい仕草の知らせ・記録シートの自動で閉じる演出など、短い遅延を1つだけ
// 持ちたい画面が共通して使う。
export function useTimeoutRef() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  // 前の予約があれば差し替えて、callbackをms後に呼ぶ。
  function arm(callback: () => void, ms: number) {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(callback, ms);
  }

  // 予約があれば取り消す。
  function clear() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  return { arm, clear };
}
