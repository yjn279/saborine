import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiError, WEB_BASE_URL } from "../src/api/client";
import { fetchInviteLetter, type InviteLetter } from "../src/api/invite";
import { useIdentity } from "../src/auth/useIdentity";
import { CloseButton } from "../src/components/CloseButton";
import { LetterCard } from "../src/components/LetterCard";
import { bumpReminderCount, getReminderCount } from "../src/invite/promptStorage";
import { copyToClipboard, shareOrCopy } from "../src/share";
import { commonStyles } from "../src/styles/common";

// 招待カードの再提示は2回まで(初回記録の直後・3日後を想定)。それ以上はアプリから
// 促さない(docs/mvp.md:30)。この画面が開かれた回数をその代わりの目印として数え、
// 3回目以降は「送ってみない?」という誘いの文面を外し、淡々とした再送の道具にする。
const REMINDER_LIMIT = 2;

// 手紙を送る画面。プレビューを見せ、「これなら責めていると思われない」と本人が
// 確認してから、リンクの共有だけを提供する(docs/mvp.md:28)。相手が開いたか・
// 受諾したかの状態はサーバーが返さないため、この画面にも一切表示しない。
export default function Invite() {
  const router = useRouter();
  const identity = useIdentity();
  const [letter, setLetter] = useState<InviteLetter | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showReminder, setShowReminder] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!identity) {
      return;
    }
    let active = true;
    (async () => {
      const reminderCount = await getReminderCount();
      if (active) {
        setShowReminder(reminderCount < REMINDER_LIMIT);
      }
      await bumpReminderCount(reminderCount);

      try {
        const loadedLetter = await fetchInviteLetter(identity);
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
  }, [identity]);

  const absoluteLink = (link: string) =>
    Platform.OS === "web" ? `${window.location.origin}${link}` : `${WEB_BASE_URL}${link}`;

  const handleShare = async () => {
    if (!letter) {
      return;
    }
    const url = absoluteLink(letter.link);
    if (await shareOrCopy({ web: { url }, message: url })) {
      setCopied(true);
    }
  };

  const handleCopy = async () => {
    if (!letter) {
      return;
    }
    if (await copyToClipboard(absoluteLink(letter.link))) {
      setCopied(true);
    }
  };

  if (!identity || (!letter && !loadError)) {
    return (
      <View style={commonStyles.screenContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={commonStyles.screenContainer}>
      <Text style={commonStyles.title}>サボリーヌの てがみ</Text>

      {loadError ? <Text style={commonStyles.error}>{loadError}</Text> : null}

      {letter ? (
        <>
          <LetterCard lines={letter.body} />

          <View style={styles.shareBox}>
            {showReminder ? (
              <Text style={styles.hint}>いっしょに いるときに がめんを みせて さそうのも おすすめだよ</Text>
            ) : null}
            <Pressable style={[commonStyles.shareButton, styles.shareButton]} onPress={handleShare}>
              <Text style={commonStyles.shareButtonText}>リンクを おくる</Text>
            </Pressable>
            <Pressable style={styles.copyButton} onPress={handleCopy}>
              <Text style={styles.copyButtonText}>{copied ? "コピーしたよ" : "リンクを コピーする"}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <CloseButton onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
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
    minWidth: 200,
  },
  copyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  copyButtonText: {
    color: "#a08860",
    fontSize: 14,
  },
});
