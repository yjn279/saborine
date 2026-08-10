// サボリーヌの見た目だけを扱う型。誰が・どれだけ記録したかは持たない。

// 5つの姿。だらしなは愛嬌として描き、涙・やつれ・暗さなど悲しみの表現は含まない(docs/mvp.md:144)。
export type SaborinePose = "normal" | "happy" | "eating" | "sleepy" | "sloppy";

// なつき度の累計5/20/50/100で、この順に解放される仕草(docs/mvp.md:143)。
export type SaborineGesture = "facesPartner" | "callsName" | "approaches" | "specialGesture";

// 進化の3系統。同点は調和系として扱う(docs/mvp.md:145)。
export type SaborineLineage = "harmony" | "blossom" | "steady";

export interface SaborineProps {
  // いまの姿
  pose: SaborinePose;
  // 解放済みの仕草。指定しなければ何も解放していない状態として描く
  unlockedGestures?: SaborineGesture[];
  // 進化の段階(0は未進化)。大きいほど育った姿にする
  evolutionStage?: number;
  // 進化の系統。未進化はnull
  evolutionLineage?: SaborineLineage | null;
  // 一辺の描画サイズ(論理ピクセル)
  size?: number;
}
