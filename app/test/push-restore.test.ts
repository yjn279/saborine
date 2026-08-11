import { describe, expect, it } from "vitest";
import { createPushRestorer, shouldShowPushBanner, type RestorePushDeps } from "../src/push/restore";

function createDeps(overrides: Partial<RestorePushDeps> = {}): RestorePushDeps & {
  subscribeCalls: number;
} {
  const deps = {
    isSupported: () => true,
    hasSubscription: async () => false,
    isNotificationsEnabled: async () => true,
    subscribeCalls: 0,
    subscribe: async () => {
      deps.subscribeCalls += 1;
      return true;
    },
    ...overrides,
  };
  return deps;
}

describe("購読を作り直すかどうかの判断(createPushRestorer)", () => {
  it("対応・購読なし・設定オンがそろうと、購読を実行しsubscribedを返す", async () => {
    const deps = createDeps();
    const restore = createPushRestorer(deps);

    await expect(restore()).resolves.toBe("subscribed");
    expect(deps.subscribeCalls).toBe(1);
  });

  it("対応していない環境では、unsupportedを返し購読を実行しない", async () => {
    const deps = createDeps({ isSupported: () => false });
    const restore = createPushRestorer(deps);

    await expect(restore()).resolves.toBe("unsupported");
    expect(deps.subscribeCalls).toBe(0);
  });

  it("すでに購読があるときは、skippedを返し購読を実行しない", async () => {
    const deps = createDeps({ hasSubscription: async () => true });
    const restore = createPushRestorer(deps);

    await expect(restore()).resolves.toBe("skipped");
    expect(deps.subscribeCalls).toBe(0);
  });

  it("設定のお知らせがオフのときは、skippedを返し購読を実行しない", async () => {
    const deps = createDeps({ isNotificationsEnabled: async () => false });
    const restore = createPushRestorer(deps);

    await expect(restore()).resolves.toBe("skipped");
    expect(deps.subscribeCalls).toBe(0);
  });

  it("対応していないときは、購読の有無や設定を調べない", async () => {
    let hasSubscriptionCalled = false;
    let isNotificationsEnabledCalled = false;
    const deps = createDeps({
      isSupported: () => false,
      hasSubscription: async () => {
        hasSubscriptionCalled = true;
        return false;
      },
      isNotificationsEnabled: async () => {
        isNotificationsEnabledCalled = true;
        return true;
      },
    });
    const restore = createPushRestorer(deps);

    await restore();
    expect(hasSubscriptionCalled).toBe(false);
    expect(isNotificationsEnabledCalled).toBe(false);
  });

  it("すでに購読があるときは、設定を調べない", async () => {
    let isNotificationsEnabledCalled = false;
    const deps = createDeps({
      hasSubscription: async () => true,
      isNotificationsEnabled: async () => {
        isNotificationsEnabledCalled = true;
        return true;
      },
    });
    const restore = createPushRestorer(deps);

    await restore();
    expect(isNotificationsEnabledCalled).toBe(false);
  });

  it("2回目の呼び出しでは、条件を調べ直さずskippedを返す", async () => {
    let isSupportedCalls = 0;
    const deps = createDeps({
      isSupported: () => {
        isSupportedCalls += 1;
        return true;
      },
    });
    const restore = createPushRestorer(deps);

    await expect(restore()).resolves.toBe("subscribed");
    await expect(restore()).resolves.toBe("skipped");
    expect(isSupportedCalls).toBe(1);
    expect(deps.subscribeCalls).toBe(1);
  });

  it("購読の実行に失敗したときは、failedを返す", async () => {
    const deps = createDeps({ subscribe: async () => false });
    const restore = createPushRestorer(deps);

    await expect(restore()).resolves.toBe("failed");
  });

  it("設定の取得が失敗したときは、その失敗をそのまま伝え、購読したことにしない", async () => {
    const deps = createDeps({
      isNotificationsEnabled: async () => {
        throw new Error("設定の取得に失敗しました");
      },
    });
    const restore = createPushRestorer(deps);

    await expect(restore()).rejects.toThrow("設定の取得に失敗しました");
    expect(deps.subscribeCalls).toBe(0);
  });
});

describe("案内バナーを出すかどうかの判断(shouldShowPushBanner)", () => {
  it("対応していない結果では、バナーを出す", () => {
    expect(shouldShowPushBanner("unsupported")).toBe(true);
  });

  it("購読できなかった結果では、バナーを出さない", () => {
    expect(shouldShowPushBanner("failed")).toBe(false);
  });

  it("何もしなかった結果、購読した結果では、バナーを出さない", () => {
    expect(shouldShowPushBanner("skipped")).toBe(false);
    expect(shouldShowPushBanner("subscribed")).toBe(false);
  });
});
