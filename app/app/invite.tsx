import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { ApiError } from "../src/api/client";
import { fetchInviteLetter, type InviteLetter } from "../src/api/invite";
import { loadIdentity, type Identity } from "../src/auth/identity";
import { LetterCard } from "../src/components/LetterCard";

// 招待カードの再提示は2回まで(初回記録の直後・3日後を想定)。それ以上はアプリから
// 促さない(docs/mvp.md:30)。この画面が開かれた回数をその代わりの目印として数え、
// 3回目以降は「送ってみない?」という誘いの文面を外し、淡々とした再送の道具にする。
const REMINDER_LIMIT = 2;
const REMINDER_COUNT_KEY = "saborine.inviteReminderCount";

async function readReminderCount(): Promise<number> {
  const raw =
    Platform.OS === "web"
      ? window.localStorage.getItem(REMINDER_COUNT_KEY)
      : await SecureStore.getItemAsync(REMINDER_COUNT_KEY);
  return raw ? Number(raw) : 0;
}

async function bumpReminderCount(current: number): Promise<void> {
  const next = String(current + 1);
  if (Platform.OS === "web") {
    window.localStorage.setItem(REMINDER_COUNT_KEY, next);
    return;
  }
  await SecureStore.setItemAsync(REMINDER_COUNT_KEY, next);
}

// 手紙を送る画面。プレビューを見せ、「これなら責めていると思われない」と本人が
// 確認してから、リンクの共有だけを提供する(docs/mvp.md:28)。相手が開いたか・
// 受諾したかの状態はサーバーが返さないため、この画面にも一切表示しない。
export default function Invite() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [letter, setLetter] = useState<InviteLetter | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [showReminder, setShowReminder] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const loadedIdentity = await loadIdentity();
      if (!active) {
        return;
      }
      if (!loadedIdentity) {
        router.replace("/onboarding");
        return;
      }
      setIdentity(loadedIdentity);

      const reminderCount = await readReminderCount();
      if (active) {
        setShowReminder(reminderCount < REMINDER_LIMIT);
      }
      await bumpReminderCount(reminderCount);

      try {
        const loadedLetter = await fetchInviteLetter(loadedIdentity);
        if (active) {
          setLetter(loadedLetter);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof ApiError ? error.message : "てがみが よみこめませんでした");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const absoluteLink = (link: string) =>
    Platform.OS === "web" ? `${window.location.origin}${link}` : link;

  const handleShare = async () => {
    if (!letter) {
      return;
    }
    const url = absoluteLink(letter.link);
    if (Platform.OS === "web") {
      const nav = window.navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ url }).catch(() => undefined);
        return;
      }
      await handleCopy();
      return;
    }
    await Share.share({ message: url });
  };

  const handleCopy = async () => {
    if (!letter) {
      return;
    }
    const url = absoluteLink(letter.link);
    if (Platform.OS === "web" && window.navigator.clipboard) {
      await window.navigator.clipboard.writeText(url);
      setCopied(true);
    }
  };

  if (!identity || (!letter && !loadError)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>サボリーヌの てがみ</Text>

      {loadError ? <Text style={styles.error}>{loadError}</Text> : null}

      {letter ? (
        <>
          <LetterCard lines={letter.body} />

          {!confirmed ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>これなら せめている かんじが しない、とおもったら</Text>
              <Pressable style={styles.confirmButton} onPress={() => setConfirmed(true)}>
                <Text style={styles.confirmButtonText}>そう おもう</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.shareBox}>
              {showReminder ? (
                <Text style={styles.hint}>いっしょに いるときに がめんを みせて さそうのも おすすめだよ</Text>
              ) : null}
              <Pressable style={styles.shareButton} onPress={handleShare}>
                <Text style={styles.shareButtonText}>リンクを おくる</Text>
              </Pressable>
              <Pressable style={styles.copyButton} onPress={handleCopy}>
                <Text style={styles.copyButtonText}>{copied ? "コピーしたよ" : "リンクを コピーする"}</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : null}

      <Pressable style={styles.closeButton} onPress={() => router.back()}>
        <Text style={styles.closeButtonText}>とじる</Text>
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
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  error: {
    color: "#c0392b",
    fontSize: 14,
    textAlign: "center",
  },
  confirmBox: {
    alignItems: "center",
    gap: 10,
  },
  confirmText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  confirmButton: {
    backgroundColor: "#f4a261",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  shareBox: {
    alignItems: "center",
    gap: 12,
    width: "100%",
    maxWidth: 320,
  },
  hint: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
  },
  shareButton: {
    backgroundColor: "#e76f51",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    minWidth: 200,
    alignItems: "center",
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  copyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  copyButtonText: {
    color: "#a08860",
    fontSize: 14,
  },
  closeButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: "#999",
    fontSize: 14,
  },
});
