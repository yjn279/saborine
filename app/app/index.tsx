import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ApiError } from "../src/api/client";
import { fetchHomeState, sendThanks, type HomeState } from "../src/api/home";
import { fetchSettings } from "../src/api/settings";
import { useIdentity } from "../src/auth/useIdentity";
import type { Identity } from "../src/auth/identity";
import { buildGestureNoticeMessage, decideGestureNotice } from "../src/affection/gestureNotice";
import { getSeenGestures, setSeenGestures } from "../src/affection/gestureStorage";
import { AffectionNote } from "../src/components/AffectionNote";
import { BalanceGauge } from "../src/components/BalanceGauge";
import { CloseButton } from "../src/components/CloseButton";
import { InAppBanner } from "../src/components/InAppBanner";
import { ThanksButton } from "../src/components/ThanksButton";
import { NudgeBounce } from "../src/components/saborine/NudgeBounce";
import { Saborine } from "../src/components/saborine/Saborine";
import { decideInvitePrompt } from "../src/invite/prompt";
import { getFirstRecordedAt, getInvitePromptStage, setInvitePromptStage } from "../src/invite/promptStorage";
import { createPushRestorer, shouldShowPushBanner } from "../src/push/restore";
import { hasPushSubscription, isPushSupported, subscribeToPush } from "../src/push/subscribe";
import { decidePose } from "../src/saborine/pose";
import { commonStyles } from "../src/styles/common";

const POLL_INTERVAL_MS = 20_000;
const EATING_REACTION_MS = 1_400;

// 生活の中心となるホーム画面。サボリーヌ・息ぴったりゲージ・記録ボタン・
// 相手の直近の記録とありがとうボタンだけを置き、数値・回数・順位は一切出さない。
export default function Home() {
  const router = useRouter();
  const identity = useIdentity();
  const [homeState, setHomeState] = useState<HomeState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [thanksSending, setThanksSending] = useState(false);
  const [eating, setEating] = useState(false);
  const [pushBannerVisible, setPushBannerVisible] = useState(false);
  const [gestureNotice, setGestureNotice] = useState<string | null>(null);
  const eatingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestureNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushRestoreStarted = useRef(false);
  const autoInvitePromptShown = useRef(false);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (eatingTimer.current) {
        clearTimeout(eatingTimer.current);
      }
      if (gestureNoticeTimer.current) {
        clearTimeout(gestureNoticeTimer.current);
      }
    };
  }, []);

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

  // 状態を取り直すたびに、新しい仕草が解放されていないかを判断する。知らせを出したとき、
  // および前回確認した一覧がまだ端末に無いときは、いまの一覧を端末に残して次回に備える。
  const checkGestureNotice = useCallback(async (gestures: HomeState["myAffection"]["gestures"]) => {
    const seen = await getSeenGestures();
    const decision = decideGestureNotice({ current: gestures, previouslySeen: seen });
    if (decision) {
      setGestureNotice(buildGestureNoticeMessage(decision));
      if (gestureNoticeTimer.current) {
        clearTimeout(gestureNoticeTimer.current);
      }
      gestureNoticeTimer.current = setTimeout(() => setGestureNotice(null), EATING_REACTION_MS);
    }
    if (seen === null || decision) {
      await setSeenGestures(gestures);
    }
  }, []);

  const refresh = useCallback(
    async (currentIdentity: Identity): Promise<HomeState | null> => {
      try {
        const state = await fetchHomeState(currentIdentity);
        setHomeState(state);
        setErrorMessage(null);
        await checkGestureNotice(state.myAffection.gestures);
        return state;
      } catch (error) {
        setErrorMessage(error instanceof ApiError ? error.message : "サボリーヌの ようすが とれませんでした");
        return null;
      }
    },
    [checkGestureNotice],
  );

  // 手紙の自動提示を判断する。1回のアプリ起動につき最大1回だけ判断し、出すと決まった
  // 段階を端末に残してから手紙へ進む。状態がまだ取れていない・取得に失敗したとき、
  // および判断の途中で画面から離れたときは何もしない。
  const promptInviteIfNeeded = useCallback(
    async (state: HomeState | null) => {
      if (!state || autoInvitePromptShown.current) {
        return;
      }
      const [firstRecordedAt, stage] = await Promise.all([getFirstRecordedAt(), getInvitePromptStage()]);
      if (autoInvitePromptShown.current || !isFocusedRef.current) {
        return;
      }
      const decision = decideInvitePrompt({ isPaired: state.isPaired, firstRecordedAt, stage, now: new Date() });
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

  const handleThanks = async () => {
    const chore = homeState?.partnerLatestChore;
    if (!identity || !chore || chore.thanked || thanksSending) {
      return;
    }
    setThanksSending(true);
    setErrorMessage(null);
    try {
      await sendThanks(identity, chore.id);
      setEating(true);
      eatingTimer.current = setTimeout(() => setEating(false), EATING_REACTION_MS);
      await refresh(identity);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "ありがとうを おくれませんでした");
    } finally {
      setThanksSending(false);
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

  return (
    <View style={commonStyles.screenContainer}>
      <Pressable
        onPress={() => router.push(`/record?isSloppy=${homeState.saborine.isSloppy ? "1" : "0"}`)}
        accessibilityRole="button"
        accessibilityLabel="サボリーヌになにかしてくれた?ときく"
      >
        <NudgeBounce active={homeState.saborine.serifKind === "nudge"}>
          <Saborine
            pose={pose}
            unlockedGestures={homeState.myAffection.gestures}
            evolutionStage={homeState.saborine.evolutionStage}
            evolutionLineage={homeState.saborine.evolutionLineage}
          />
        </NudgeBounce>
      </Pressable>
      <Text style={styles.serif}>{homeState.saborine.serif}</Text>

      <AffectionNote gestures={homeState.myAffection.gestures} />
      {gestureNotice ? <Text style={styles.gestureNotice}>{gestureNotice}</Text> : null}

      <BalanceGauge value={homeState.balanceGauge} />

      {homeState.partnerLatestChore ? (
        <View style={styles.partnerCard}>
          <Text style={styles.partnerText}>{homeState.partnerLatestChore.choreType}を してくれたよ</Text>
          <ThanksButton
            thanked={homeState.partnerLatestChore.thanked}
            sending={thanksSending}
            onPress={handleThanks}
          />
        </View>
      ) : (
        <Text style={styles.partnerEmpty}>まだ とどいてないみたい</Text>
      )}

      {errorMessage ? <Text style={commonStyles.error}>{errorMessage}</Text> : null}

      <Pressable
        style={styles.recordButton}
        onPress={() => router.push(`/record?isSloppy=${homeState.saborine.isSloppy ? "1" : "0"}`)}
      >
        <Text style={styles.recordButtonText}>きろくする</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  serif: {
    fontSize: 15,
    color: "#6b5237",
    textAlign: "center",
  },
  gestureNotice: {
    fontSize: 13,
    color: "#e07a5f",
    textAlign: "center",
  },
  partnerCard: {
    alignItems: "center",
    gap: 10,
  },
  partnerText: {
    fontSize: 15,
    color: "#333",
  },
  partnerEmpty: {
    fontSize: 14,
    color: "#999",
  },
  recordButton: {
    backgroundColor: "#f4a261",
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    minWidth: 200,
    alignItems: "center",
  },
  recordButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  pushBanner: {
    alignItems: "center",
  },
  inviteLink: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inviteLinkText: {
    color: "#a08860",
    fontSize: 13,
  },
});
