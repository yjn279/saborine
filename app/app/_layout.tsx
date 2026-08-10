import { useEffect, useState } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { loadIdentity } from "../src/auth/identity";
import { isGuestOnlyPath, isPublicPath, JOIN_PATH_PREFIX, WELCOME_PATH } from "../src/auth/routes";

// 起動のたびに登録済みかどうかを確かめる。身分証がなければ、身分証なしで開ける道
// (app/src/auth/routes.ts の一覧)以外はすべて紹介ページ(/welcome)へ差し替える。
// 身分証があるのに紹介ページ・はじめかた画面を開いたときは、ホームへ呼び戻す。
// 手紙のリンク(/join/:token)は、受け取った側がまだ未登録のまま開くため、
// この確認から除外する(app/app/join/[token].tsx)。
export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    if (pathname.startsWith(JOIN_PATH_PREFIX)) {
      setChecked(true);
      return;
    }
    loadIdentity()
      .then((identity) => {
        if (!active) {
          return;
        }
        if (!identity && !isPublicPath(pathname)) {
          router.replace(WELCOME_PATH);
        } else if (identity && isGuestOnlyPath(pathname)) {
          router.replace("/");
        }
        setChecked(true);
      })
      .catch((error: unknown) => {
        // 保存領域が読めない場合も、無反応のまま固まらせず、紹介ページへ送り返す。
        console.error("身分証の読み込みに失敗しました", error);
        if (!active) {
          return;
        }
        if (!isPublicPath(pathname)) {
          router.replace(WELCOME_PATH);
        }
        setChecked(true);
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (!checked) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
