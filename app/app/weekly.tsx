import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiError } from "../src/api/client";
import { fetchWeeklyCard, type WeeklyCard } from "../src/api/weekly";
import { useIdentity } from "../src/auth/useIdentity";
import { CloseButton } from "../src/components/CloseButton";
import { Saborine } from "../src/components/saborine/Saborine";
import { shareOrCopy } from "../src/share";
import { commonStyles } from "../src/styles/common";

// 週次カード画面。絵が主役、本文は5行以内(server/src/domain/weekly-card.ts)。
// 過去カードの一覧は作らない。いま直前の週のカード1枚だけを見せ、
// 保存または共有の導線を添える(docs/mvp.md:45)。個人別の集計はサーバーが
// 一切返さないため、この画面にも表示のしようがない。
export default function Weekly() {
  const router = useRouter();
  const identity = useIdentity();
  const [card, setCard] = useState<WeeklyCard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!identity) {
      return;
    }
    let active = true;
    fetchWeeklyCard(identity)
      .then((loadedCard) => {
        if (active) {
          setCard(loadedCard);
        }
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(error instanceof ApiError ? error.message : "カードが よみこめませんでした");
        }
      });
    return () => {
      active = false;
    };
  }, [identity]);

  const storyLines = card ? card.storyText.split("\n") : [];
  const shareText = storyLines.length > 0 ? `サボリーヌの週次カード\n${storyLines.join("\n")}` : "";

  const handleShare = async () => {
    if (!shareText) {
      return;
    }
    const copied = await shareOrCopy({
      web: { title: "サボリーヌの週次カード", text: shareText },
      message: shareText,
    });
    if (copied) {
      setShared(true);
    }
  };

  if (!identity || (!card && !errorMessage)) {
    return (
      <View style={commonStyles.screenContainer}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={commonStyles.screenContainer}>
      <Text style={commonStyles.title}>こんしゅうの おはなし</Text>

      {errorMessage ? <Text style={commonStyles.error}>{errorMessage}</Text> : null}

      {card ? (
        <View style={styles.card}>
          <Saborine pose="happy" size={140} />
          <View style={styles.textBlock}>
            {storyLines.map((line, index) => (
              <Text key={index} style={styles.line}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {card ? (
        <View style={styles.actions}>
          <Pressable style={[commonStyles.shareButton, styles.shareButton]} onPress={handleShare}>
            <Text style={commonStyles.shareButtonText}>
              {shared ? "コピーしたよ" : "ほぞん・きょうゆうする"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <CloseButton onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#fffaf0",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0e0c0",
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  textBlock: {
    gap: 6,
  },
  line: {
    fontSize: 15,
    lineHeight: 24,
    color: "#5c4a30",
    textAlign: "center",
  },
  actions: {
    alignItems: "center",
  },
  shareButton: {
    minWidth: 220,
  },
});
