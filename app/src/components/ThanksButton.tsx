import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

interface ThanksButtonProps {
  // すでにありがとうを送っている(2回目は送れない)か
  thanked: boolean;
  sending: boolean;
  onPress: () => void;
}

// 相手の記録に「ありがとう」を送るボタン。相手を指す催促の文言は持たず、
// 自分の気持ちを届けるためだけのボタンにする。
export function ThanksButton({ thanked, sending, onPress }: ThanksButtonProps) {
  return (
    <Pressable
      style={[styles.button, thanked && styles.buttonDone]}
      onPress={onPress}
      disabled={thanked || sending}
      accessibilityRole="button"
    >
      {sending ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.text}>{thanked ? "ありがとう、おくったよ" : "ありがとうを おくる"}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#e76f51",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 180,
  },
  buttonDone: {
    backgroundColor: "#c9c2b6",
  },
  text: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
