import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ApiError } from "../src/api/client";
import { fetchHomeState, sendThanks, type HomeState } from "../src/api/home";
import { fetchSettings } from "../src/api/settings";
import { useIdentity } from "../src/auth/useIdentity";
import type { Identity } from "../src/auth/identity";
import { buildGestureNoticeMessage, decideGestureNotice } from "../src/affection/gestureNotice";
import { getSeenGestures, setSeenGestures } from "../src/affection/gestureStorage";
import { buildGrowthNoticeMessage, decideGrowthNotice } from "../src/saborine/growthNotice";
import { getSeenGrowthProgress, setSeenGrowthProgress } from "../src/saborine/growthStorage";
import { AffectionNote } from "../src/components/AffectionNote";
import { BalanceGauge } from "../src/components/BalanceGauge";
import { CloseButton } from "../src/components/CloseButton";
import { InAppBanner } from "../src/components/InAppBanner";
import { ThanksButton } from "../src/components/ThanksButton";
import { NudgeBounce } from "../src/components/saborine/NudgeBounce";
import { Saborine } from "../src/components/saborine/Saborine";
import type { SaborineGesture } from "../src/components/saborine/types";
import { useTimeoutRef } from "../src/hooks/useTimeoutRef";
import { decideInvitePrompt, parseFirstRecordedAt } from "../src/invite/prompt";
import { getInvitePromptStage, setInvitePromptStage } from "../src/invite/promptStorage";
import { decideTodayEventView, isEventThanked } from "../src/home/todayEvents";
import { createPushRestorer, shouldShowPushBanner } from "../src/push/restore";
import { hasPushSubscription, isPushSupported, subscribeToPush } from "../src/push/subscribe";
import { REACTION_DURATION_MS } from "../src/reactionDuration";
import { decidePose } from "../src/saborine/pose";
import { commonStyles } from "../src/styles/common";
import { colors, fontSize, space } from "../src/styles/theme";

const POLL_INTERVAL_MS = 20_000;

// 生活の中心となるホーム画面。サボリーヌ・息ぴったりゲージ・記録ボタン・
// きょうふたりに起きたこととありがとうボタンだけを置き、数値・回数・順位は一切出さない。
export default function Home() {
  const router = useRouter();
  const identity = useIdentity();
  const [homeState, setHomeState] = useState<HomeState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // ありがとうを送信中の記録IDの一覧。押した行だけを送信中の見た目にし、
  // 他の行は巻き添えにしない(複数の行を同時に送っても構わない)。
  const [sendingIds, setSendingIds] = useState<string[]>([]);
  const [eating, setEating] = useState(false);
  const [pushBannerVisible, setPushBannerVisible] = useState(false);
  // サボリーヌまわりの知らせは、仕草の解放と育ちの2種類あるが、同時に2つ並べない
  // ため状態変数は1つだけに絞る。
  const [notice, setNotice] = useState<string | null>(null);
  const eatingTimer = useTimeoutRef();
  const noticeTimer = useTimeoutRef();
  const pushRestoreStarted = useRef(false);
  const autoInvitePromptShown = useRef(false);
  const isFocusedRef = useRef(false);
  // 前回確認した解放済み仕草の一覧・育ち具合を端末に読みに行くのは起動後の最初の1回
  // だけにし、以後は取り直しのたびにこのメモリ上の値と比べる。20秒ごとの取り直しや
  // ありがとう送信のたびに保存領域を読みに行かない(効率)ため、また読み出しと書き戻し
  // の間に別の取り直しが割り込んで判断が競合しない(整合性)ようにするため。
  const seenGesturesRef = useRef<readonly SaborineGesture[] | null | undefined>(undefined);
  const seenGrowthProgressRef = useRef<number | null | undefined>(undefined);

  // 身分証が読めた時点で、お知らせの購読を作り直すべきか1回だけ判断する。ホームに
  // 戻るたびや20秒ごとの取り直しでは呼ばない。対応していない環境と分かったときだけ
  // 案内バナーを出す。失敗してもホームの表示・きろく・ありがとうは今までどおり動く。
  useEffect(() => {
    if (!identity || pushRestoreStarted.current) {
      return;
    }
    pushRestoreStarted.current = true;
    createPushRestorer({
      isSupported: isPushSupported,
      hasSubscription: hasPushSubscription,
      isNotificationsEnabled: () => fetchSettings(identity).then((settings) => settings.notificationsEnabled),
      subscribe: () => subscribeToPush(identity).then((result) => result.subscribed),
    })()
      .then((result) => {
        if (shouldShowPushBanner(result)) {
          setPushBannerVisible(true);
        } else if (result === "failed") {
          console.error("お知らせの購読を作れませんでした");
        }
      })
      .catch((error: unknown) => {
        console.error("お知らせの購読を作り直せませんでした", error);
      });
  }, [identity]);

  // 状態を取り直すたびに、新しい仕草の解放と育ちの前進のどちらを知らせるべきかを判断する。
  // 両方成立していても仕草の解放を優先し、育ちの知らせと2つ並べない。知らせを出したとき、
  // 前回確認した値がまだ端末に無いとき、および育ち具合が前回確認した値と変わっている
  // (進化して周期が測り直されたときを含む)ときは、いまの値を端末に残して次回に備える
  // (仕草の解放を知らせたときも、育ちの知らせが後から遅れて出ないよう育ち具合は残す)。
  const checkNotices = useCallback(
    async (gestures: HomeState["myAffection"]["gestures"], growthProgress: number) => {
      const [seenGestures, seenGrowthProgress] = await Promise.all([
        seenGesturesRef.current === undefined ? getSeenGestures() : seenGesturesRef.current,
        seenGrowthProgressRef.current === undefined ? getSeenGrowthProgress() : seenGrowthProgressRef.current,
      ]);
      seenGesturesRef.current = seenGestures;
      seenGrowthProgressRef.current = seenGrowthProgress;

      const gestureDecision = decideGestureNotice({ current: gestures, previouslySeen: seenGestures });
      const growthDecision =
        !gestureDecision && decideGrowthNotice({ current: growthProgress, previouslySeen: seenGrowthProgress });

      const message = gestureDecision
        ? buildGestureNoticeMessage(gestureDecision)
        : growthDecision
          ? buildGrowthNoticeMessage()
          : null;
      if (message) {
        setNotice(message);
        noticeTimer.arm(() => setNotice(null), REACTION_DURATION_MS);
      }

      if (seenGestures === null || gestureDecision) {
        seenGesturesRef.current = gestures;
        setSeenGestures(gestures).catch((error: unknown) => {
          console.error("解放済みの仕草を残せませんでした", error);
        });
      }
      if (seenGrowthProgress === null || gestureDecision || growthProgress !== seenGrowthProgress) {
        seenGrowthProgressRef.current = growthProgress;
        setSeenGrowthProgress(growthProgress).catch((error: unknown) => {
          console.error("育ち具合を残せませんでした", error);
        });
      }
    },
    [],
  );

  const refresh = useCallback(
    async (currentIdentity: Identity): Promise<HomeState | null> => {
      try {
        const state = await fetchHomeState(currentIdentity);
        setHomeState(state);
        setErrorMessage(null);
        await checkNotices(state.myAffection.gestures, state.saborine.growthProgress);
        return state;
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : "サボリーヌの ようすが とれませんでした");
        return null;
      }
    },
    [checkNotices],
  );

  // 手紙の自動提示を判断する。1回のアプリ起動につき最大1回だけ判断し、出すと決まった
  // 段階を端末に残してから手紙へ進む。状態がまだ取れていない・取得に失敗したとき、
  // および判断の途中で画面から離れたときは何もしない。
  const promptInviteIfNeeded = useCallback(
    async (state: HomeState | null) => {
      if (!state || autoInvitePromptShown.current) {
        return;
      }
      const stage = await getInvitePromptStage();
      if (autoInvitePromptShown.current || !isFocusedRef.current) {
        return;
      }
      const decision = decideInvitePrompt({
        isPaired: state.isPaired,
        firstRecordedAt: parseFirstRecordedAt(state.firstRecordedAt),
        stage,
        now: new Date(),
      });
      if (decision === "none") {
        return;
      }
      autoInvitePromptShown.current = true;
      await setInvitePromptStage(decision);
      if (!isFocusedRef.current) {
        return;
      }
      router.push("/invite");
    },
    [router],
  );

  // 画面に戻ったときと20秒ごとに状態を取り直す。手紙の自動提示は、画面に戻った
  // ときの取り直し後に判断する。
  useFocusEffect(
    useCallback(() => {
      if (!identity) {
        return;
      }
      isFocusedRef.current = true;
      refresh(identity)
        .then((state) => promptInviteIfNeeded(state))
        .catch((error: unknown) => {
          console.error("手紙の自動提示の判断に失敗しました", error);
        });
      const interval = setInterval(() => refresh(identity), POLL_INTERVAL_MS);
      return () => {
        isFocusedRef.current = false;
        clearInterval(interval);
      };
    }, [identity, refresh, promptInviteIfNeeded]),
  );

  const handleThanks = async (choreLogId: string) => {
    const alreadyThanked = isEventThanked(homeState?.todayEvents ?? [], choreLogId);
    if (!identity || sendingIds.includes(choreLogId) || alreadyThanked) {
      return;
    }
    setSendingIds((ids) => [...ids, choreLogId]);
    setErrorMessage(null);
    try {
      await sendThanks(identity, choreLogId);
      setEating(true);
      eatingTimer.arm(() => setEating(false), REACTION_DURATION_MS);
      await refresh(identity);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "ありがとうを おくれませんでした");
    } finally {
      setSendingIds((ids) => ids.filter((id) => id !== choreLogId));
    }
  };

  if (!identity || !homeState) {
    return (
      <View style={commonStyles.screenContainer}>
        {errorMessage ? <Text style={commonStyles.error}>{errorMessage}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const pose = decidePose({ serifKind: homeState.saborine.serifKind, isEating: eating });
  const recordHref = `/record?isSloppy=${homeState.saborine.isSloppy ? "1" : "0"}`;

  return (
    <ScrollView style={commonStyles.scrollScreen} contentContainerStyle={commonStyles.scrollScreenContent}>
      <Pressable
        onPress={() => router.push(recordHref)}
        accessibilityRole="button"
        accessibilityLabel="サボリーヌになにかしてくれた?ときく"
      >
        <NudgeBounce active={homeState.saborine.serifKind === "nudge"}>
          <Saborine
            pose={pose}
            size={220}
            unlockedGestures={homeState.myAffection.gestures}
            evolutionStage={homeState.saborine.evolutionStage}
            evolutionLineage={homeState.saborine.evolutionLineage}
            growthProgress={homeState.saborine.growthProgress}
          />
        </NudgeBounce>
      </Pressable>
      <Text style={styles.serif}>{homeState.saborine.serif}</Text>

      {/* サボリーヌの様子(ひとこと・なつき度・息ぴったり)をひとまとまりにして、
          相手のできごとや操作と混ざらないようにする。 */}
      <View style={styles.saborineState}>
        <AffectionNote gestures={homeState.myAffection.gestures} />
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {/* 息ぴったりはふたりの間に生まれるもの。相手がいないうちは出さない。
            空の帯を置いても、埋める相手がいないため意味を持たない。 */}
        {homeState.isPaired ? <BalanceGauge value={homeState.balanceGauge} /> : null}
      </View>

      {homeState.todayEvents.length > 0 ? (
        <View style={commonStyles.card}>
          {homeState.todayEvents.map((event) => {
            const view = decideTodayEventView(event);
            return (
              <View key={event.id} style={styles.eventRow}>
                <Text style={styles.eventText} numberOfLines={1}>
                  {view.text}
                </Text>
                {view.showThanksButton ? (
                  <ThanksButton
                    size="compact"
                    thanked={view.thanked}
                    sending={sendingIds.includes(event.id)}
                    onPress={() => handleThanks(event.id)}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.todayEmpty}>まだ とどいてないみたい</Text>
      )}

      {errorMessage ? <Text style={commonStyles.error}>{errorMessage}</Text> : null}

      <Pressable style={commonStyles.primaryButton} onPress={() => router.push(recordHref)}>
        <Text style={commonStyles.primaryButtonText}>きろくする</Text>
      </Pressable>

      {!homeState.isPaired ? (
        <Pressable
          style={styles.inviteLink}
          onPress={() => router.push("/invite")}
          accessibilityRole="button"
          accessibilityLabel="サボリーヌの てがみを ひらく"
        >
          <Text style={styles.inviteLinkText}>サボリーヌの てがみ</Text>
        </Pressable>
      ) : null}

      {pushBannerVisible ? (
        <View style={styles.pushBanner}>
          <InAppBanner />
          <CloseButton onPress={() => setPushBannerVisible(false)} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  serif: {
    fontSize: fontSize.serif,
    color: colors.serif,
    textAlign: "center",
    lineHeight: fontSize.serif * 1.6,
    // 幅いっぱいに伸ばすと、最後の1〜2文字だけが次の行に落ちる。
    maxWidth: 300,
  },
  // サボリーヌの様子をひとまとまりにする。個々の間隔は狭く、外との間隔は広く。
  saborineState: {
    alignItems: "center",
    gap: space.sm,
  },
  notice: {
    fontSize: fontSize.caption,
    color: colors.highlight,
    textAlign: "center",
  },
  eventText: {
    fontSize: fontSize.serif,
    color: colors.text,
    // ありがとうの操作のぶんを差し引いた残り幅いっぱいに収め、1行に保つ。
    flexGrow: 1,
    flexShrink: 1,
  },
  // きょうのできごと1件ぶんの行。文とありがとうの操作を横に並べ、
  // 6件並んでも縦に伸びすぎないようにする。
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    width: "100%",
  },
  todayEmpty: {
    fontSize: fontSize.caption,
    color: colors.textFaint,
  },
  pushBanner: {
    alignItems: "center",
  },
  inviteLink: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  inviteLinkText: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
  },
});
