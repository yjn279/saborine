import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { CloseButton } from "../src/components/CloseButton";
import { LegalDocument } from "../src/components/LegalDocument";
import { privacyDocument } from "../src/legal/privacy";

// プライバシーポリシーの画面。文面は表示せず、app/src/legal/privacy.tsのデータをLegalDocumentへ渡すだけ。
export default function Privacy() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <LegalDocument document={privacyDocument} />
      <CloseButton onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
});
