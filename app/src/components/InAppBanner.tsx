import { StyleSheet, Text, View } from "react-native";

// お知らせを購読できない環境向けの案内。サボリーヌは催促せず、アプリを開いたときに
// きろく・ありがとう・せいちょうを見せてくれるだけであることを、やさしく伝える。
export function InAppBanner() {
  return (
    <View style={styles.container} accessibilityRole="text">
      <Text style={styles.text}>
        このかんきょうでは おしらせを おとどけできないみたい。ひらいたときに、サボリーヌが
        あたらしい できごとを おしえてくれるよ。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fef3e2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 320,
  },
  text: {
    color: "#7a5230",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
