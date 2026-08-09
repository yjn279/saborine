import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ApiError } from "../../src/api/client";
import { fetchHomeState, sendThanks, type HomeState } from "../../src/api/home";
import { acceptInvite, fetchInvitePreview, type InvitePreview } from "../../src/api/invite";
import { createIdentity, loadIdentity, saveIdentity, type Identity } from "../../src/auth/identity";
import { LetterCard } from "../../src/components/LetterCard";
import { Saborine } from "../../src/components/saborine/Saborine";
import { ThanksButton } from "../../src/components/ThanksButton";
import { commonStyles } from "../../src/styles/common";

const DISPLAY_NAME_MAX_LENGTH = 30;

// 手紙のリンクを開いた側の画面。認証なしでプレビューを見せ、名前入力だけで
// ペアに加わり、その場で最初のありがとうを1タップで送れるところまでを1本で通す
// (docs/mvp.md:38)。すでにこの端末に別の身分証があるときは、上書きしないよう
// 登録フォームを出さない。
export default function Join() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [existingIdentity, setExistingIdentity] = useState<Identity | null | undefined>(undefined);

  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [joinedIdentity, setJoinedIdentity] = useState<Identity | null>(null);
  const [homeState, setHomeState] = useState<HomeState | null>(null);
  const [thanksSending, setThanksSending] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const loaded = await loadIdentity();
      if (active) {
        setExistingIdentity(loaded);
      }
      if (!token) {
        return;
      }
      try {
        const loadedPreview = await fetchInvitePreview(token);
        if (active) {
          setPreview(loadedPreview);
        }
      } catch (error) {
        if (active) {
          setPreviewError(
            error instanceof ApiError ? error.message : "てがみが みつかりませんでした",
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const trimmedName = displayName.trim();
  const canSubmit = trimmedName.length > 0 && !submitting && !!token;

  const handleJoin = async () => {
    if (!token || !canSubmit) {
      return;
    }
    setSubmitting(true);
    setJoinError(null);
    try {
      const identity = createIdentity();
      await acceptInvite(token, {
        displayName: trimmedName,
        userId: identity.userId,
        secret: identity.secret,
      });
      await saveIdentity(identity);
      setJoinedIdentity(identity);
      try {
        const state = await fetchHomeState(identity);
        setHomeState(state);
      } catch {
        // ホームの状態が取れなくても、登録自体は成功しているので先へ進める。
      }
    } catch (error) {
      setJoinError(error instanceof ApiError ? error.message : "なかまに なれませんでした");
    } finally {
      setSubmitting(false);
    }
  };

  const handleThanks = async () => {
    const chore = homeState?.partnerLatestChore;
    if (!joinedIdentity || !chore || chore.thanked || thanksSending) {
      return;
    }
    setThanksSending(true);
    try {
      await sendThanks(joinedIdentity, chore.id);
      const state = await fetchHomeState(joinedIdentity);
      setHomeState(state);
    } catch (error) {
      setJoinError(error instanceof ApiError ? error.message : "ありがとうを おくれませんでした");
    } finally {
      setThanksSending(false);
    }
  };

  // 出迎え後: 相手の直近の記録があれば、その場で最初のありがとうを送れるようにする。
  if (joinedIdentity) {
    return (
      <View style={styles.container}>
        <Saborine pose="happy" />
        <Text style={styles.title}>ようこそ、{trimmedName}さん</Text>
        <Text style={styles.subtitle}>サボリーヌの もうひとりの さとおやに なったよ</Text>

        {homeState?.partnerLatestChore ? (
          <View style={styles.partnerCard}>
            <Text style={styles.partnerText}>
              {homeState.partnerLatestChore.choreType}を してくれたよ
            </Text>
            <ThanksButton
              thanked={homeState.partnerLatestChore.thanked}
              sending={thanksSending}
              onPress={handleThanks}
            />
          </View>
        ) : null}

        {joinError ? <Text style={commonStyles.error}>{joinError}</Text> : null}

        <Pressable style={styles.button} onPress={() => router.replace("/")}>
          <Text style={styles.buttonText}>ホームへ すすむ</Text>
        </Pressable>
      </View>
    );
  }

  // すでにこの端末で登録済みなら、身分証を上書きしないようフォームは出さない。
  if (existingIdentity) {
    return (
      <View style={styles.container}>
        <Saborine pose="normal" />
        <Text style={styles.title}>この たんまつは もう とうろくずみだよ</Text>
        <Pressable style={styles.button} onPress={() => router.replace("/")}>
          <Text style={styles.buttonText}>ホームへ もどる</Text>
        </Pressable>
      </View>
    );
  }

  if (previewError) {
    return (
      <View style={styles.container}>
        <Text style={commonStyles.error}>{previewError}</Text>
      </View>
    );
  }

  if (!preview || existingIdentity === undefined) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Saborine pose="normal" />
      <LetterCard lines={preview.body} characterName={preview.characterName} />

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
      {joinError ? <Text style={commonStyles.error}>{joinError}</Text> : null}
      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleJoin}
        disabled={!canSubmit}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>さとおやに なる</Text>}
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
  partnerCard: {
    alignItems: "center",
    gap: 10,
  },
  partnerText: {
    fontSize: 15,
    color: "#333",
  },
});
