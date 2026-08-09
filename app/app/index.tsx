import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ApiError } from "../src/api/client";
import { fetchHomeState, sendThanks, type HomeState } from "../src/api/home";
import { useIdentity } from "../src/auth/useIdentity";
import type { Identity } from "../src/auth/identity";
import { BalanceGauge } from "../src/components/BalanceGauge";
import { ThanksButton } from "../src/components/ThanksButton";
import { Saborine } from "../src/components/saborine/Saborine";
import type { SaborinePose } from "../src/components/saborine/types";
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
  const eatingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (eatingTimer.current) {
        clearTimeout(eatingTimer.current);
      }
    };
  }, []);

  const refresh = useCallback(async (currentIdentity: Identity) => {
    try {
      const state = await fetchHomeState(currentIdentity);
      setHomeState(state);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "サボリーヌの ようすが とれませんでした");
    }
  }, []);

  // 20秒ごと、および画面に戻ったときに状態を取り直す。
  useFocusEffect(
    useCallback(() => {
      if (!identity) {
        return;
      }
      refresh(identity);
      const interval = setInterval(() => refresh(identity), POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [identity, refresh]),
  );

  const handleThanks = async () => {
    const chore = homeState?.partnerLatestChore;
    if (!identity || !chore || chore.thanked || thanksSending) {
      return;
    }
    setThanksSending(true);
    setErrorMessage(null);
    setEating(true);
    try {
      await sendThanks(identity, chore.id);
      await refresh(identity);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "ありがとうを おくれませんでした");
    } finally {
      setThanksSending(false);
      eatingTimer.current = setTimeout(() => setEating(false), EATING_REACTION_MS);
    }
  };

  const pose: SaborinePose = eating ? "eating" : homeState?.saborine.isSloppy ? "sloppy" : "normal";

  if (!identity || !homeState) {
    return (
      <View style={styles.container}>
        {errorMessage ? <Text style={commonStyles.error}>{errorMessage}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => router.push("/record")}
        accessibilityRole="button"
        accessibilityLabel="サボリーヌになにかしてくれた?ときく"
      >
        <Saborine
          pose={pose}
          unlockedGestures={homeState.myAffection.gestures}
          evolutionStage={homeState.saborine.evolutionStage}
          evolutionLineage={homeState.saborine.evolutionLineage}
        />
      </Pressable>
      <Text style={styles.serif}>{homeState.saborine.serif}</Text>

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

      <Pressable style={styles.recordButton} onPress={() => router.push("/record")}>
        <Text style={styles.recordButtonText}>きろくする</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  serif: {
    fontSize: 15,
    color: "#6b5237",
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
});
