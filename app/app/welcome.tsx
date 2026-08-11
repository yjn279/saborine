import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Saborine } from "../src/components/saborine/Saborine";
import { commonStyles } from "../src/styles/common";
import { colors, fontSize, space } from "../src/styles/theme";

// まだ登録していない人が最初に着く紹介画面。SNSから来た人がここを見て、
// 何のアプリかを「サボリーヌ → ふたりの物語 → 家事」の順に知る。
// 「里親に なる」を押すとはじめかた画面(/onboarding)へ進む。
export default function Welcome() {
  const router = useRouter();

  return (
    <View style={commonStyles.screenContainer}>
      <Saborine pose="happy" size={220} />
      <Text style={commonStyles.screenTitle}>ふたりで、いっぴきの犬を そだてよう</Text>
      <View style={styles.sections}>
        <Text style={styles.paragraph}>
          サボリーヌは、ふたりでひとつのいのちを いっしょに そだてる犬です。ひとりでは かえません。
        </Text>
        <Text style={styles.paragraph}>
          家事をすると、相手からの「ありがとう」がごはんになって、サボリーヌが そだちます。
        </Text>
        <Text style={styles.paragraph}>
          ふたりがサボると、サボリーヌは とたんに だらしなくなります。それも、あいきょうのうち。
        </Text>
      </View>
      <Pressable style={commonStyles.primaryButton} onPress={() => router.push("/onboarding")}>
        <Text style={commonStyles.primaryButtonText}>里親に なる</Text>
      </Pressable>
      <View style={styles.legalLinks}>
        <Pressable onPress={() => router.push("/terms")}>
          <Text style={styles.legalLinkText}>りようきやく</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/privacy")}>
          <Text style={styles.legalLinkText}>プライバシーポリシー</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: space.md,
    maxWidth: 360,
  },
  // 本文は左揃えにする。日本語を中央揃えで3行に折り返すと、行ごとに
  // 開始位置がずれて読みにくく、作りが粗く見える。
  paragraph: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    lineHeight: fontSize.body * 1.7,
  },
  legalLinks: {
    flexDirection: "row",
    gap: space.lg,
  },
  legalLinkText: {
    color: colors.textFaint,
    fontSize: fontSize.caption,
  },
});
