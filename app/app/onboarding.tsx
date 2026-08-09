import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { apiRequest, ApiError } from "../src/api/client";
import type { RegisterAccountRequest, RegisterAccountResponse } from "../src/api/types";
import { createIdentity, saveIdentity, type Identity } from "../src/auth/identity";
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
  const [step, setStep] = useState<Step>("form");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const trimmedName = displayName.trim();
  const canSubmit = trimmedName.length > 0 && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const newIdentity = createIdentity();
      const request: RegisterAccountRequest = {
        displayName: trimmedName,
        userId: newIdentity.userId,
        secret: newIdentity.secret,
      };
      await apiRequest<RegisterAccountResponse>("/api/account", {
        method: "POST",
        body: request,
      });
      await saveIdentity(newIdentity);
      setIdentity(newIdentity);
      setStep("welcome");
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "とうろくに しっぱいしました");
    } finally {
      setSubmitting(false);
    }
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
      <View style={styles.container}>
        <Saborine pose="happy" />
        <Text style={styles.title}>サボリーヌのおうちを{"\n"}ホームがめんに つくろう</Text>
        <Text style={styles.subtitle}>
          ブラウザのメニューから「ホーム画面に追加」を えらぶと、アイコンから すぐに あそびに
          いけるよ
        </Text>
        {showBanner ? <InAppBanner /> : null}
        <Pressable style={styles.button} onPress={() => router.replace("/")}>
          <Text style={styles.buttonText}>ホームへ すすむ</Text>
        </Pressable>
      </View>
    );
  }

  if (step === "welcome") {
    return (
      <View style={styles.container}>
        <Saborine pose="happy" />
        <Text style={styles.title}>ようこそ、{trimmedName}さん</Text>
        <Text style={styles.subtitle}>サボリーヌが なかまに なりました</Text>
        <Pressable style={styles.button} onPress={() => setStep("install")}>
          <Text style={styles.buttonText}>つぎへ</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Saborine pose="normal" />
      <Text style={styles.title}>サボリーヌが まっているよ</Text>
      <Text style={styles.subtitle}>あなたの おなまえを おしえてね</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="おなまえ"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        editable={!submitting}
        autoFocus
      />
      {errorMessage ? <Text style={commonStyles.error}>{errorMessage}</Text> : null}
      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>はじめる</Text>}
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
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
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
  button: {
    backgroundColor: "#f4a261",
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    minWidth: 160,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
