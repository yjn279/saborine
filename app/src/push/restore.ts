// ホームを開いたときに、お知らせの購読を作り直すべきかを決め、必要なら作る。
// react-native・expo・expo-routerのいずれも読み込まない。対応の判定・購読の有無・
// 設定の取得・購読の実行は、呼び出し側(app/app/index.tsx)から渡してもらう。
// これにより、画面を動かさずに判断だけを試験できる。

export type RestorePushResult =
  // unsupported: この環境はお知らせに対応していない。skipped: 対応してはいるが、
  // すでに購読済み・設定がオフ・2回目以降の呼び出しのいずれかで、何もしなかった。
  // subscribed: 3つの条件がそろい、購読を実行した。
  "unsupported" | "skipped" | "subscribed";

export interface RestorePushDeps {
  isSupported: () => boolean;
  hasSubscription: () => Promise<boolean>;
  isNotificationsEnabled: () => Promise<boolean>;
  subscribe: () => Promise<void>;
}

export type RestorePush = () => Promise<RestorePushResult>;

// 対応 → 購読の有無 → 設定 の順に調べ、前段で止まれば後段は呼ばない。1回の起動につき
// 1回だけ判断し、2回目以降の呼び出しは調べ直さずskippedを返す。
export function createPushRestorer(deps: RestorePushDeps): RestorePush {
  let attempted = false;

  return async () => {
    if (attempted) {
      return "skipped";
    }
    attempted = true;

    if (!deps.isSupported()) {
      return "unsupported";
    }
    if (await deps.hasSubscription()) {
      return "skipped";
    }
    if (!(await deps.isNotificationsEnabled())) {
      return "skipped";
    }
    await deps.subscribe();
    return "subscribed";
  };
}
