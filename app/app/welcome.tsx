import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Saborine } from "../src/components/saborine/Saborine";

// まだ登録していない人が最初に着く紹介画面。SNSから来た人がここを見て、
// 何のアプリかを「サボリーヌ → ふたりの物語 → 家事」の順に知る。
// 「里親に なる」を押すとはじめかた画面(/onboarding)へ進む。
export default function Welcome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Saborine pose="happy" />
      <Text style={styles.title}>ふたりで、いっぴきの犬を そだてよう</Text>
      <View style={styles.sections}>
        <Text style={styles.section}>
          サボリーヌは、ふたりでひとつのいのちを いっしょに そだてる犬です。ひとりでは かえません。
        </Text>
        <Text style={styles.section}>
          家事をすると、相手からの「ありがとう」がごはんになって、サボリーヌが そだちます。
        </Text>
        <Text style={styles.section}>
          ふたりがサボると、サボリーヌは とたんに だらしなくなります。それも、あいきょうのうち。
        </Text>
      </View>
      <Pressable style={styles.button} onPress={() => router.push("/onboarding")}>
        <Text style={styles.buttonText}>里親に なる</Text>
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
  sections: {
    gap: 8,
    maxWidth: 320,
  },
  section: {
    fontSize: 16,
    color: "#666",
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
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
