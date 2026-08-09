import Svg, { G } from "react-native-svg";
import { renderGestureDecorations, renderLineageAccent, renderPose } from "./poses";
import type { SaborineProps } from "./types";

const VIEW_BOX_SIZE = 100;
const DEFAULT_SIZE = 160;
// 進化の段階が上がるほど、犬本体をひとまわりずつ大きく描く。段階3以降は据え置く。
const MAX_SCALE_STAGE = 3;
const SCALE_STEP = 0.06;
const BASE_SCALE = 0.9;

// 犬「サボリーヌ」の姿を描く。何をどう描くかはposes.tsxに委ね、ここでは
// 姿(pose)・解放済みの仕草・進化の段階と系統を組み合わせるだけにする。
export function Saborine({
  pose,
  unlockedGestures = [],
  evolutionStage = 0,
  evolutionLineage = null,
  size = DEFAULT_SIZE,
}: SaborineProps) {
  const scale = BASE_SCALE + Math.min(evolutionStage, MAX_SCALE_STAGE) * SCALE_STEP;

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
