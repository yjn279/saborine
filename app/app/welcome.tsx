import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Saborine } from "../src/components/saborine/Saborine";
import { commonStyles } from "../src/styles/common";

// まだ登録していない人が最初に着く紹介画面。SNSから来た人がここを見て、
// 何のアプリかを「サボリーヌ → ふたりの物語 → 家事」の順に知る。
// 「里親に なる」を押すとはじめかた画面(/onboarding)へ進む。
export default function Welcome() {
  const router = useRouter();

  return (
    <View style={commonStyles.screenContainer}>
      <Saborine pose="happy" />
      <Text style={commonStyles.screenTitle}>ふたりで、いっぴきの犬を そだてよう</Text>
      <View style={styles.sections}>
        <Text style={commonStyles.screenSubtitle}>
          サボリーヌは、ふたりでひとつのいのちを いっしょに そだてる犬です。ひとりでは かえません。
        </Text>
        <Text style={commonStyles.screenSubtitle}>
          家事をすると、相手からの「ありがとう」がごはんになって、サボリーヌが そだちます。
        </Text>
        <Text style={commonStyles.screenSubtitle}>
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
    gap: 8,
    maxWidth: 320,
  },
  legalLinks: {
    flexDirection: "row",
    gap: 16,
  },
  legalLinkText: {
    color: "#a0522d",
    fontSize: 14,
  },
});
