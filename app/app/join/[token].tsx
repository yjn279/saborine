import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ApiError } from "../../src/api/client";
import { fetchHomeState, sendThanks, type HomeState } from "../../src/api/home";
import { acceptInvite, fetchInvitePreview, type InvitePreview } from "../../src/api/invite";
import { loadIdentity, type Identity } from "../../src/auth/identity";
import { registerIdentity, retrySaveIdentity, type IdentityRegistrationResult } from "../../src/auth/register";
import { decideTodayEventView, findPartnerEvent } from "../../src/home/todayEvents";
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
  // 受諾は成功したが端末保存だけ失敗したときの、保存待ちの身分証。残っている間は、
  // サーバーへ再度受諾リクエストを送らず(定員はすでに埋まっているため)保存だけを
  // やり直す。
  const [pendingIdentity, setPendingIdentity] = useState<Identity | null>(null);
  // 受諾が失敗した回の身分証。やり直しは同じものを使う。
  const [attemptedIdentity, setAttemptedIdentity] = useState<Identity | null>(null);

  const [joinedIdentity, setJoinedIdentity] = useState<Identity | null>(null);
  const [homeState, setHomeState] = useState<HomeState | null>(null);
  const [thanksSending, setThanksSending] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loaded = await loadIdentity();
        if (active) {
          setExistingIdentity(loaded);
        }
      } catch (error) {
        // 保存領域が壊れている・読めない等で身分証が読み込めなかった場合。この端末に
        // 身分証はないものとして扱い、受諾フォームへ進める(招待の受諾は紹介ページを
        // 経由しないため、ここでは送り返さない)。
        console.error("身分証の読み込みに失敗しました", error);
        if (active) {
          setExistingIdentity(null);
        }
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
  const canRetrySave = !!pendingIdentity && !submitting;

  const applyJoinResult = async (result: IdentityRegistrationResult) => {
    if (result.status === "api-error") {
      // やり直すときは同じ身分証で送り直す。作り直すと、実は成立していた受諾に
      // 戻れないまま、招待だけが使い切られてどこにも入れなくなる。
      setAttemptedIdentity(result.identity);
      setJoinError(result.error instanceof ApiError ? result.error.message : "なかまに なれませんでした");
      setSubmitting(false);
      return;
    }
    if (result.status === "save-error") {
      setPendingIdentity(result.identity);
      setJoinError("なかまには なれたけど、このたんまつに ほぞんできなかったよ");
      setSubmitting(false);
      return;
    }

    setPendingIdentity(null);
    setAttemptedIdentity(null);
    setJoinedIdentity(result.identity);
    try {
      const state = await fetchHomeState(result.identity);
      setHomeState(state);
    } catch {
      // ホームの状態が取れなくても、登録自体は成功しているので先へ進める。
    }
    setSubmitting(false);
  };

  const handleJoin = async () => {
    if (!token || !canSubmit) {
      return;
    }
    setSubmitting(true);
    setJoinError(null);
    const result = await registerIdentity(
      (identity) =>
        acceptInvite(token, {
          displayName: trimmedName,
          userId: identity.userId,
          secret: identity.secret,
        }),
      attemptedIdentity ?? undefined,
    );
    await applyJoinResult(result);
  };

  const handleRetrySave = async () => {
    if (!pendingIdentity || submitting) {
      return;
    }
    setSubmitting(true);
    setJoinError(null);
    await applyJoinResult(await retrySaveIdentity(pendingIdentity));
  };

  const partnerEvent = findPartnerEvent(homeState?.todayEvents ?? []);
  const partnerEventView = partnerEvent ? decideTodayEventView(partnerEvent) : null;

  const handleThanks = async () => {
    if (!joinedIdentity || !partnerEvent || partnerEventView?.thanked || thanksSending) {
      return;
    }
    setThanksSending(true);
    try {
      await sendThanks(joinedIdentity, partnerEvent.id);
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
      <View style={commonStyles.screenContainer}>
        <Saborine pose="happy" />
        <Text style={commonStyles.screenTitle}>ようこそ、{trimmedName}さん</Text>
        <Text style={commonStyles.screenSubtitle}>サボリーヌの もうひとりの さとおやに なったよ</Text>

        {partnerEvent && partnerEventView ? (
          <View style={styles.partnerCard}>
            <Text style={styles.partnerText}>{partnerEventView.text}</Text>
            <ThanksButton
              thanked={partnerEventView.thanked}
              sending={thanksSending}
              onPress={handleThanks}
            />
          </View>
        ) : null}

        {joinError ? <Text style={commonStyles.error}>{joinError}</Text> : null}

        <Pressable style={commonStyles.primaryButton} onPress={() => router.replace("/")}>
          <Text style={commonStyles.primaryButtonText}>ホームへ すすむ</Text>
        </Pressable>
      </View>
    );
  }

  // すでにこの端末で登録済みなら、身分証を上書きしないようフォームは出さない。
  if (existingIdentity) {
    return (
      <View style={commonStyles.screenContainer}>
        <Saborine pose="normal" />
        <Text style={commonStyles.screenTitle}>この たんまつは もう とうろくずみだよ</Text>
        <Pressable style={commonStyles.primaryButton} onPress={() => router.replace("/")}>
          <Text style={commonStyles.primaryButtonText}>ホームへ もどる</Text>
        </Pressable>
      </View>
    );
  }

  if (previewError) {
    return (
      <View style={commonStyles.screenContainer}>
        <Text style={commonStyles.error}>{previewError}</Text>
      </View>
    );
  }

  if (!preview || existingIdentity === undefined) {
    return (
      <View style={commonStyles.screenContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={commonStyles.screenContainer}>
      <Saborine pose="normal" />
      <LetterCard lines={preview.body} characterName={preview.characterName} />

      <Text style={commonStyles.screenSubtitle}>あなたの おなまえを おしえてね</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="おなまえ"
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        editable={!submitting && !pendingIdentity}
        autoFocus
      />
      {joinError ? <Text style={commonStyles.error}>{joinError}</Text> : null}
      <Pressable
        style={[
          commonStyles.primaryButton,
          !(pendingIdentity ? canRetrySave : canSubmit) && styles.buttonDisabled,
        ]}
        onPress={pendingIdentity ? handleRetrySave : handleJoin}
        disabled={!(pendingIdentity ? canRetrySave : canSubmit)}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={commonStyles.primaryButtonText}>
            {pendingIdentity ? "もういちど ほぞんする" : "さとおやに なる"}
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
  partnerCard: {
    alignItems: "center",
    gap: 10,
  },
  partnerText: {
    fontSize: 15,
    color: "#333",
  },
});
