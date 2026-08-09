import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { loadIdentity, type Identity } from "./identity";

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

  return identity;
}
