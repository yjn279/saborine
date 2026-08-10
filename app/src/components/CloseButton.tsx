import { Pressable, StyleSheet, Text } from "react-native";

interface CloseButtonProps {
  onPress: () => void;
}

// 本文の下に置く「とじる」。record/invite/weekly/settingsの各画面で見た目・挙動が共通。
export function CloseButton({ onPress }: CloseButtonProps) {
  return (
    <Pressable style={styles.closeButton} onPress={onPress}>
      <Text style={styles.closeButtonText}>とじる</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
