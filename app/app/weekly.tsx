import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ApiError } from "../src/api/client";
import { fetchWeeklyCard, type WeeklyCard } from "../src/api/weekly";
import { loadIdentity, type Identity } from "../src/auth/identity";
import { Saborine } from "../src/components/saborine/Saborine";

// 週次カード画面。絵が主役、本文は5行以内(server/src/domain/weekly-card.ts)。
// 過去カードの一覧は作らない。いま直前の週のカード1枚だけを見せ、
// 保存または共有の導線を添える(docs/mvp.md:45)。個人別の集計はサーバーが
// 一切返さないため、この画面にも表示のしようがない。
export default function Weekly() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [card, setCard] = useState<WeeklyCard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const loaded = await loadIdentity();
      if (!active) {
        return;
      }
      if (!loaded) {
        router.replace("/onboarding");
        return;
      }
      setIdentity(loaded);
      try {
        const loadedCard = await fetchWeeklyCard(loaded);
        if (active) {
          setCard(loadedCard);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof ApiError ? error.message : "カードが よみこめませんでした");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const storyLines = card ? card.storyText.split("\n") : [];
  const shareText = storyLines.length > 0 ? `サボリーヌの週次カード\n${storyLines.join("\n")}` : "";

  const handleShare = async () => {
    if (!shareText) {
      return;
    }
    if (Platform.OS === "web") {
      const nav = window.navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: "サボリーヌの週次カード", text: shareText }).catch(() => undefined);
        return;
      }
      if (window.navigator.clipboard) {
        await window.navigator.clipboard.writeText(shareText);
        setShared(true);
      }
      return;
    }
    await Share.share({ message: shareText });
  };

  if (!identity || (!card && !errorMessage)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>こんしゅうの おはなし</Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

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
          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>
              {shared ? "コピーしたよ" : "ほぞん・きょうゆうする"}
            </Text>
          </Pressable>
        </View>
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
  error: {
    color: "#c0392b",
    fontSize: 14,
    textAlign: "center",
  },
  actions: {
    alignItems: "center",
  },
  shareButton: {
    backgroundColor: "#e76f51",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    minWidth: 220,
    alignItems: "center",
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
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
