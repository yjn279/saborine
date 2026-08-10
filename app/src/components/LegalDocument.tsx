import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { LegalDocument as LegalDocumentData } from "../legal/types";

interface LegalDocumentProps {
  document: LegalDocumentData;
}

// 利用規約・プライバシーポリシーの表示部品。見出しと段落が並ぶだけの文書データを
// 縦にスクロールできる形で描く。文面はここに持たず、渡されたデータをそのまま表示する。
export function LegalDocument({ document }: LegalDocumentProps) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{document.title}</Text>
      {document.sections.map((section, index) => (
        <View key={index} style={styles.section}>
          {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <Text key={paragraphIndex} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: "100%",
  },
  content: {
    alignItems: "stretch",
    gap: 20,
    padding: 24,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  section: {
    gap: 8,
  },
  heading: {
    fontSize: 16,
    fontWeight: "600",
  },
  paragraph: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
  },
});
