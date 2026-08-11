import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

interface ThanksButtonProps {
  // すでにありがとうを送っている(2回目は送れない)か
  thanked: boolean;
  sending: boolean;
  onPress: () => void;
  // 出迎え画面の1枚カードでは主役として大きく置き、ホームの一覧では
  // 1行に収まる小ささにする。大小の違いはこの部品の中だけで決める。
  size?: "default" | "compact";
}

const LABEL = {
  send: "ありがとうを おくる",
  thanked: "ありがとう、おくったよ",
};

const COMPACT_LABEL = {
  send: "ありがとう",
  thanked: "おくったよ",
};

// 相手の記録に「ありがとう」を送るボタン。相手を指す催促の文言は持たず、
// 自分の気持ちを届けるためだけのボタンにする。
export function ThanksButton({ thanked, sending, onPress, size = "default" }: ThanksButtonProps) {
  const compact = size === "compact";
  const label = compact ? COMPACT_LABEL : LABEL;
  return (
    <Pressable
      style={[styles.button, compact && styles.buttonCompact, thanked && styles.buttonDone]}
      onPress={onPress}
      disabled={thanked || sending}
      accessibilityRole="button"
      accessibilityLabel={thanked ? LABEL.thanked : LABEL.send}
      hitSlop={compact ? 8 : undefined}
    >
      {sending ? (
        <ActivityIndicator color="#fff" size={compact ? "small" : undefined} />
      ) : (
        <Text style={[styles.text, compact && styles.textCompact]}>{thanked ? label.thanked : label.send}</Text>
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
  buttonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 0,
  },
  buttonDone: {
    backgroundColor: "#c9c2b6",
  },
  text: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  textCompact: {
    fontSize: 13,
  },
});
