import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

interface LetterCardProps {
  // 手紙の本文。3行以内、家事・分担・不満に類する言葉を含まない(server/src/domain/letter.ts)。
  lines: readonly string[];
  // サボリーヌの署名に添える名前。未指定なら「サボリーヌ」を使う。
  characterName?: string | null;
  // カードの下に添える内容(確認ボタンや共有ボタンなど)。カード自体は表示専用にとどめる。
  children?: ReactNode;
}

// サボリーヌからの手紙を、便箋のカードとして見せる。招待の主語を人からキャラクターへ
// 移し替える表現の要(docs/mvp.md:25)。本文の検証はサーバー側(server/src/domain/letter.ts)が担い、
// ここでは受け取った本文をそのまま表示するだけにする。
export function LetterCard({ lines, characterName, children }: LetterCardProps) {
  return (
    <View style={styles.card}>
      {lines.map((line, index) => (
        <Text key={index} style={styles.line}>
          {line}
        </Text>
      ))}
      <Text style={styles.signature}>{characterName ?? "サボリーヌ"} より</Text>
      {children ? <View style={styles.footer}>{children}</View> : null}
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
    gap: 8,
  },
  line: {
    fontSize: 16,
    lineHeight: 26,
    color: "#5c4a30",
    textAlign: "center",
  },
  signature: {
    marginTop: 12,
    fontSize: 13,
    color: "#a08860",
    textAlign: "right",
  },
  footer: {
    marginTop: 16,
    gap: 12,
    alignItems: "center",
  },
});
