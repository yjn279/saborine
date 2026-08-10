import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { setUnauthorizedHandler } from "../api/client";
import { clearIdentity, loadIdentity, type Identity } from "./identity";

// 保存済みの身分証を読み込む。まだ登録していなければ、はじめかた画面へ送り返す。
// どの画面も、この結果が届いてから初めてサーバーへ問い合わせる。
export function useIdentity(): Identity | null {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    let active = true;
    loadIdentity()
      .then((loaded) => {
        if (!active) {
          return;
        }
        if (!loaded) {
          router.replace("/onboarding");
          return;
        }
        setIdentity(loaded);
      })
      .catch((error: unknown) => {
        // 保存領域が壊れている・読めない等で身分証が読み込めなかった場合。無反応のまま
        // 固まらせず、はじめかた画面へ送り返して復帰できるようにする。
        console.error("身分証の読み込みに失敗しました", error);
        if (active) {
          router.replace("/onboarding");
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  // この画面が生きている間、通信が401(=もうこの身分証では認証できない)を受けたら
  // ここで受け止める。ペア解除は実行した本人の意思だけで完結し、相手には通知しない
  // ため、相手側はポーリング等の通信が401になって初めてそれを知る。端末の身分証を
  // 消し、穏やかな文言とともにはじめかた画面へ送り返して復帰できるようにする。
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearIdentity().finally(() => router.replace("/onboarding?reason=unpaired"));
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  return identity;
}
