import { clamp01 } from "../ratio";

// サボリーヌの描画の大きさを、進化の段階といまの育ち具合(0〜1)から決める。
// react-native・react-native-svgのいずれも読み込まない。

// 進化の段階が上がるほど、犬本体をひとまわりずつ大きく描く。段階3以降は据え置く。
const MAX_SCALE_STAGE = 3;
const SCALE_STEP = 0.06;
const BASE_SCALE = 0.9;

// 育ち具合(0〜1)を段階の小数部として足し、段階の位置をなめらかに進める。
// 育ち具合が範囲外の入力(防御)は0〜1に丸め、最大の段階(3)は超えない。
export function calcScale(evolutionStage: number, growthProgress: number = 0): number {
  const stage = Math.min(evolutionStage + clamp01(growthProgress), MAX_SCALE_STAGE);
  return BASE_SCALE + stage * SCALE_STEP;
}
