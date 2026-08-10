import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { setUnauthorizedHandler } from "../api/client";
import { clearIdentity, loadIdentity, type Identity } from "./identity";
import { ONBOARDING_PATH, WELCOME_PATH } from "./routes";

// 保存済みの身分証を読み込む。まだ登録していなければ、紹介ページへ送り返す。
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
          router.replace(WELCOME_PATH);
          return;
        }
        setIdentity(loaded);
      })
      .catch((error: unknown) => {
        // 保存領域が壊れている・読めない等で身分証が読み込めなかった場合。無反応のまま
        // 固まらせず、紹介ページへ送り返して復帰できるようにする。
        console.error("身分証の読み込みに失敗しました", error);
        if (active) {
          router.replace(WELCOME_PATH);
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
  // 一度登録した人なので、紹介ページ(/welcome)ではなく、はじめかた画面へ送る。
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearIdentity().finally(() => router.replace(`${ONBOARDING_PATH}?reason=unpaired`));
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  return identity;
}
