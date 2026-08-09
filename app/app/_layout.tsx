import { useEffect, useState } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { loadIdentity } from "../src/auth/identity";

const ONBOARDING_PATH = "/onboarding";
const JOIN_PATH_PREFIX = "/join/";

// 起動のたびに登録済みかどうかを確かめる。未登録ならはじめかた画面へ、
// 登録済みならはじめかた画面から呼び戻す。登録し直しにはならない。
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
    loadIdentity().then((identity) => {
      if (!active) {
        return;
      }
      if (!identity && pathname !== ONBOARDING_PATH) {
        router.replace(ONBOARDING_PATH);
      } else if (identity && pathname === ONBOARDING_PATH) {
        router.replace("/");
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
