import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ApiError } from "../src/api/client";
import { registerAccount } from "../src/api/account";
import { registerIdentity, retrySaveIdentity, type IdentityRegistrationResult } from "../src/auth/register";
import type { Identity } from "../src/auth/identity";
import { Saborine } from "../src/components/saborine/Saborine";
import { InAppBanner } from "../src/components/InAppBanner";
import { subscribeToPush } from "../src/push/subscribe";
import { commonStyles } from "../src/styles/common";

const DISPLAY_NAME_MAX_LENGTH = 30;

type Step = "form" | "welcome" | "install";

// はじめかた画面。入力は表示名だけ。登録に成功したらサボリーヌとの出会いを見せ、
// 「ホーム画面に追加」の案内(必須ステップ)を経てホームへ進む。失敗したら代替値で
// 進まず、その場でメッセージを見せる。
export default function Onboarding() {
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [step, setStep] = useState<Step>("form");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  // サーバーへの登録は成功したが端末保存だけ失敗したときの、保存待ちの身分証。
  // 残っている間は、サーバーへ再度リクエストを送らず保存だけをやり直す。
  const [pendingIdentity, setPendingIdentity] = useState<Identity | null>(null);

  const trimmedName = displayName.trim();
  const canSubmit = trimmedName.length > 0 && !submitting;
  const canRetrySave = !!pendingIdentity && !submitting;

  const applyResult = (result: IdentityRegistrationResult) => {
    if (result.status === "api-error") {
      setErrorMessage(result.error instanceof ApiError ? result.error.message : "とうろくに しっぱいしました");
      setSubmitting(false);
      return;
    }
    if (result.status === "save-error") {
      setPendingIdentity(result.identity);
      setErrorMessage("とうろくは できたけど、このたんまつに ほぞんできなかったよ");
      setSubmitting(false);
      return;
    }
    setPendingIdentity(null);
    setIdentity(result.identity);
    setStep("welcome");
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    const result = await registerIdentity((newIdentity) =>
      registerAccount({
        displayName: trimmedName,
        userId: newIdentity.userId,
        secret: newIdentity.secret,
      }),
    );
    applyResult(result);
  };

  const handleRetrySave = async () => {
    if (!pendingIdentity || submitting) {
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    applyResult(await retrySaveIdentity(pendingIdentity));
  };

  useEffect(() => {
    if (step !== "install" || !identity) {
      return;
    }
    let active = true;
    subscribeToPush(identity).then((result) => {
      if (active && !result.subscribed) {
        setShowBanner(true);
      }
    });
    return () => {
      active = false;
    };
  }, [step, identity]);

  if (step === "install") {
    return (
      <View style={commonStyles.screenContainer}>
        <Saborine pose="happy" />
        <Text style={commonStyles.screenTitle}>サボリーヌのおうちを{"\n"}ホームがめんに つくろう</Text>
        <Text style={commonStyles.screenSubtitle}>
          ブラウザのメニューから「ホーム画面に追加」を えらぶと、アイコンから すぐに あそびに
          いけるよ
        </Text>
        {showBanner ? <InAppBanner /> : null}
        <Pressable style={commonStyles.primaryButton} onPress={() => router.replace("/")}>
          <Text style={commonStyles.primaryButtonText}>ホームへ すすむ</Text>
        </Pressable>
      </View>
    );
  }

  if (step === "welcome") {
    return (
      <View style={commonStyles.screenContainer}>
        <Saborine pose="happy" />
        <Text style={commonStyles.screenTitle}>ようこそ、{trimmedName}さん</Text>
        <Text style={commonStyles.screenSubtitle}>サボリーヌが なかまに なりました</Text>
        <Pressable style={commonStyles.primaryButton} onPress={() => setStep("install")}>
          <Text style={commonStyles.primaryButtonText}>つぎへ</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={commonStyles.screenContainer}>
      <Saborine pose="normal" />
      <Text style={commonStyles.screenTitle}>サボリーヌが まっているよ</Text>
      <Text style={commonStyles.screenSubtitle}>あなたの おなまえを おしえてね</Text>
      {reason === "unpaired" ? (
        <Text style={commonStyles.error}>
          なかまが いなくなってしまったみたい。もういちど、はじめから とうろくしてね
        </Text>
      ) : null}
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="おなまえ"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        editable={!submitting && !pendingIdentity}
        autoFocus
      />
      {errorMessage ? <Text style={commonStyles.error}>{errorMessage}</Text> : null}
      <Pressable
        style={[
          commonStyles.primaryButton,
          !(pendingIdentity ? canRetrySave : canSubmit) && styles.buttonDisabled,
        ]}
        onPress={pendingIdentity ? handleRetrySave : handleSubmit}
        disabled={!(pendingIdentity ? canRetrySave : canSubmit)}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={commonStyles.primaryButtonText}>
            {pendingIdentity ? "もういちど ほぞんする" : "はじめる"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    width: "100%",
    maxWidth: 280,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    textAlign: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
