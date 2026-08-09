import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { apiRequest, ApiError } from "../src/api/client";
import type { RegisterAccountRequest, RegisterAccountResponse } from "../src/api/types";
import { createIdentity, saveIdentity } from "../src/auth/identity";
import { Saborine } from "../src/components/saborine/Saborine";

const DISPLAY_NAME_MAX_LENGTH = 30;

// はじめかた画面。入力は表示名だけ。登録に成功したらサボリーヌとの出会いを見せ、
// ホームへ進む。失敗したら代替値で進まず、その場でメッセージを見せる。
export default function Onboarding() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [metSaborine, setMetSaborine] = useState(false);

  const trimmedName = displayName.trim();
  const canSubmit = trimmedName.length > 0 && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const identity = createIdentity();
      const request: RegisterAccountRequest = {
        displayName: trimmedName,
        userId: identity.userId,
        secret: identity.secret,
      };
      await apiRequest<RegisterAccountResponse>("/api/account", {
        method: "POST",
        body: request,
      });
      await saveIdentity(identity);
      setMetSaborine(true);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "とうろくに しっぱいしました");
    } finally {
      setSubmitting(false);
    }
  };

  if (metSaborine) {
    return (
      <View style={styles.container}>
        <Saborine pose="happy" />
        <Text style={styles.title}>ようこそ、{trimmedName}さん</Text>
        <Text style={styles.subtitle}>サボリーヌが なかまに なりました</Text>
        <Pressable style={styles.button} onPress={() => router.replace("/")}>
          <Text style={styles.buttonText}>ホームへ すすむ</Text>
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
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
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
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
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
  error: {
    color: "#c0392b",
    fontSize: 14,
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
