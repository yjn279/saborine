import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { CloseButton } from "../src/components/CloseButton";
import { LegalDocument } from "../src/components/LegalDocument";
import { termsDocument } from "../src/legal/terms";

// 利用規約の画面。文面は表示せず、app/src/legal/terms.tsのデータをLegalDocumentへ渡すだけ。
export default function Terms() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <LegalDocument document={termsDocument} />
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
