import { StyleSheet, View } from "react-native";
import { clamp01 } from "../ratio";

interface BalanceGaugeProps {
  // 0〜1の割合。回数や差の数値は一切表示しない(docs/mvp.md:142)。
  value: number;
}

// 息ぴったりゲージ。ふたりの記録の釣り合いを1本の帯の満ち具合だけで見せる。
// 数字・回数・順位は描かない。
export function BalanceGauge({ value }: BalanceGaugeProps) {
  const ratio = clamp01(value);

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel="ふたりの息ぴったりゲージ"
    >
      <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    maxWidth: 320,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#f0e4d0",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#f4a261",
  },
});
