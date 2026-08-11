import { StyleSheet, Text } from "react-native";
import type { SaborineGesture } from "./saborine/types";
import { buildAffectionGrowthNote } from "../affection/growth";

interface AffectionNoteProps {
  // 自分の解放済みの仕草(homeState.myAffection.gestures)。数字は渡さない。
  gestures: readonly SaborineGesture[];
}

// なつき度が育っていることを1行だけ見せる。数字・累計値・相手のなつき度は扱わない。
export function AffectionNote({ gestures }: AffectionNoteProps) {
  return <Text style={styles.note}>{buildAffectionGrowthNote(gestures)}</Text>;
}

const styles = StyleSheet.create({
  note: {
    fontSize: 13,
    color: "#a08860",
    textAlign: "center",
  },
});
