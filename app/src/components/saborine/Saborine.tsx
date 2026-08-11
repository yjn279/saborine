import Svg, { G } from "react-native-svg";
import { renderGestureDecorations, renderLineageAccent, renderPose } from "./poses";
import type { SaborineProps } from "./types";
import { calcScale } from "../../saborine/scale";

const VIEW_BOX_SIZE = 100;
const DEFAULT_SIZE = 160;

// 犬「サボリーヌ」の姿を描く。何をどう描くかはposes.tsxに委ね、ここでは
// 姿(pose)・解放済みの仕草・進化の段階と系統・育ち具合を組み合わせるだけにする。
export function Saborine({
  pose,
  unlockedGestures = [],
  evolutionStage = 0,
  evolutionLineage = null,
  growthProgress = 0,
  size = DEFAULT_SIZE,
}: SaborineProps) {
  const scale = calcScale(evolutionStage, growthProgress);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
      accessibilityLabel="サボリーヌ"
    >
      {renderLineageAccent(evolutionLineage)}
      <G
        transform={`translate(${VIEW_BOX_SIZE / 2} ${VIEW_BOX_SIZE / 2}) scale(${scale}) translate(${-VIEW_BOX_SIZE / 2} ${-VIEW_BOX_SIZE / 2})`}
      >
        {renderPose(pose)}
      </G>
      {renderGestureDecorations(unlockedGestures)}
    </Svg>
  );
}
