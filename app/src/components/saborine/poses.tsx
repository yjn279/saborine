import type { JSX } from "react";
import { Circle, Ellipse, G, Path, Text as SvgText } from "react-native-svg";
import type { SaborineGesture, SaborineLineage, SaborinePose } from "./types";

// 100x100の枠の中に、犬「サボリーヌ」を描く。姿の差分だけが感情を運ぶため、
// 5つの姿はすべて別関数として独立させ、混ざらないようにする。
// だらしな以外は座った姿勢、だらしなだけ横になった姿勢にする。
//
// 描き方の決めごと:
// - 体は必ず地面の影の上に置く。影が無いと宙に浮いて見える
// - 輪郭線を1本入れる。塗りだけだと形が溶けて、作りかけに見える
// - 頭と体の境目に陰を入れる。同じ色の丸を2つ重ねただけでは雪だるまになる
// - 手足と尻尾は体に重ねて描く。離すと切り離された部品に見える
// - 目にはハイライトを入れる。これがかわいさにいちばん効く

const BODY_FILL = "#F7E3C3";
const BODY_SHADE = "#EBD0A6";
const EAR_FILL = "#DFA269";
const EAR_INNER = "#C98A57";
const OUTLINE = "#C9A87C";
const LINE_COLOR = "#5C4630";
const BLUSH_FILL = "#F4A9A6";
const TONGUE_FILL = "#E98787";
const SHADOW_FILL = "#D8C4A4";

const OUTLINE_WIDTH = 1.2;

// 地面の影。座っている姿と寝ている姿で広さを変える。
function groundShadow(cx: number, cy: number, rx: number) {
  return <Ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.22} fill={SHADOW_FILL} opacity={0.45} />;
}

// 座った姿勢の胴。前足を胴に重ね、胴の下側に陰を入れて丸みを出す。
function sittingBody(cy: number) {
  return (
    <G>
      <Ellipse
        cx={50}
        cy={cy}
        rx={23}
        ry={17}
        fill={BODY_FILL}
        stroke={OUTLINE}
        strokeWidth={OUTLINE_WIDTH}
      />
      <Path
        d={`M30 ${cy + 6} Q50 ${cy + 20} 70 ${cy + 6} Q50 ${cy + 14} 30 ${cy + 6} z`}
        fill={BODY_SHADE}
        opacity={0.7}
      />
      <Ellipse
        cx={39}
        cy={cy + 13}
        rx={6}
        ry={5}
        fill={BODY_FILL}
        stroke={OUTLINE}
        strokeWidth={OUTLINE_WIDTH}
      />
      <Ellipse
        cx={61}
        cy={cy + 13}
        rx={6}
        ry={5}
        fill={BODY_FILL}
        stroke={OUTLINE}
        strokeWidth={OUTLINE_WIDTH}
      />
    </G>
  );
}

// 頭。首もとに陰を落として、胴と地続きに見えないようにする。
function head(cy: number, r = 18.5) {
  return (
    <G>
      <Ellipse cx={50} cy={cy + r - 1} rx={r * 0.78} ry={4.2} fill={BODY_SHADE} opacity={0.85} />
      <Circle cx={50} cy={cy} r={r} fill={BODY_FILL} stroke={OUTLINE} strokeWidth={OUTLINE_WIDTH} />
    </G>
  );
}

function ear(cx: number, cy: number, rotate: number) {
  return (
    <G transform={`rotate(${rotate} ${cx} ${cy})`}>
      <Ellipse
        cx={cx}
        cy={cy}
        rx={7.5}
        ry={12.5}
        fill={EAR_FILL}
        stroke={OUTLINE}
        strokeWidth={OUTLINE_WIDTH}
      />
      <Ellipse cx={cx} cy={cy + 1} rx={3.6} ry={7.5} fill={EAR_INNER} />
    </G>
  );
}

// 開いた目。白目は描かず、黒目とハイライトだけで丸い瞳にする。
function openEye(cx: number, cy: number) {
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx={3.8} ry={4.3} fill={LINE_COLOR} />
      <Circle cx={cx - 1.2} cy={cy - 1.6} r={1.4} fill="#FFFFFF" />
      <Circle cx={cx + 1.3} cy={cy + 1.5} r={0.6} fill="#FFFFFF" opacity={0.7} />
    </G>
  );
}

// 閉じた目(よろこび・食事)。上向きの弧にする。
function happyEye(cx: number, cy: number) {
  return (
    <Path
      d={`M${cx - 3.4} ${cy + 1} Q${cx} ${cy - 3.6} ${cx + 3.4} ${cy + 1}`}
      stroke={LINE_COLOR}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function muzzle(cy: number) {
  return (
    <G>
      <Ellipse cx={50} cy={cy + 1.5} rx={8} ry={5.8} fill="#FCEFD8" />
      <Ellipse cx={50} cy={cy} rx={2.9} ry={2.1} fill={LINE_COLOR} />
      <Path
        d={`M50 ${cy + 2} L50 ${cy + 3.6}`}
        stroke={LINE_COLOR}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </G>
  );
}

function blush(cy: number) {
  return (
    <G opacity={0.75}>
      <Ellipse cx={36} cy={cy} rx={4} ry={2.4} fill={BLUSH_FILL} />
      <Ellipse cx={64} cy={cy} rx={4} ry={2.4} fill={BLUSH_FILL} />
    </G>
  );
}

// 尻尾。胴の右側から生えるように、付け根を胴に食い込ませる。
function tail(d: string) {
  return (
    <Path d={d} stroke={EAR_FILL} strokeWidth={6.5} strokeLinecap="round" fill="none" />
  );
}

function normalPose() {
  return (
    <G>
      {groundShadow(50, 88, 26)}
      {tail("M64 66 C 79 63, 81 50, 73 43")}
      {sittingBody(68)}
      {ear(34, 32, -18)}
      {ear(66, 32, 18)}
      {head(42)}
      {blush(47)}
      {openEye(43.5, 40)}
      {openEye(56.5, 40)}
      {muzzle(47)}
      <Path
        d="M45.5 51.5 Q50 54.5 54.5 51.5"
        stroke={LINE_COLOR}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

function happyPose() {
  return (
    <G>
      {groundShadow(50, 88, 26)}
      {tail("M64 64 C 82 57, 85 42, 75 33")}
      {sittingBody(68)}
      {ear(33, 29, -32)}
      {ear(67, 29, 32)}
      {head(40)}
      {blush(45)}
      {happyEye(43.5, 38)}
      {happyEye(56.5, 38)}
      {muzzle(45)}
      <Path
        d="M44 49 Q50 56.5 56 49"
        stroke={LINE_COLOR}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={50} cy={53.5} rx={2.6} ry={3.2} fill={TONGUE_FILL} />
    </G>
  );
}

function eatingPose() {
  return (
    <G>
      {groundShadow(50, 88, 26)}
      {tail("M64 66 C 79 63, 81 50, 73 43")}
      {sittingBody(68)}
      {ear(34, 39, -10)}
      {ear(66, 39, 10)}
      {head(50, 17.5)}
      {happyEye(43.5, 47)}
      {happyEye(56.5, 47)}
      {muzzle(56)}
      {/* ごはんのおさら。犬より手前に置く */}
      <Ellipse cx={36} cy={87} rx={13} ry={4.6} fill="#C97F4A" />
      <Ellipse cx={36} cy={85} rx={10.5} ry={3.6} fill="#F0B26B" />
      <Ellipse cx={34} cy={84} rx={3} ry={1.6} fill="#FFD9A6" opacity={0.8} />
    </G>
  );
}

function sleepyPose() {
  return (
    <G>
      {groundShadow(50, 89, 26)}
      {sittingBody(70)}
      {ear(35, 36, 6)}
      {ear(65, 36, -6)}
      {head(44)}
      {blush(49)}
      <Path
        d="M39 43.5 Q42.5 46.5 46 43.5"
        stroke={LINE_COLOR}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M54 43.5 Q57.5 46.5 61 43.5"
        stroke={LINE_COLOR}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      {muzzle(49)}
      <Path
        d="M46.5 53.5 Q50 55 53.5 53.5"
        stroke={LINE_COLOR}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      />
      <SvgText x={70} y={26} fontSize={10} fill={LINE_COLOR} opacity={0.7}>
        Z
      </SvgText>
      <SvgText x={79} y={17} fontSize={6.5} fill={LINE_COLOR} opacity={0.55}>
        z
      </SvgText>
    </G>
  );
}

// だらしな: ぐうたら寝転がる・寝ぐせ・おもちゃの散らかしとして愛嬌に描く。
// 涙・下がった眉・暗い色は使わず、閉じた口元と軽い笑みだけにとどめる(docs/mvp.md)。
function sloppyPose() {
  return (
    <G>
      {groundShadow(52, 84, 32)}
      {/* 横になった胴。後ろ足を先に置いて胴で隠す */}
      <Ellipse cx={72} cy={76} rx={7} ry={4.5} fill={BODY_FILL} stroke={OUTLINE} strokeWidth={OUTLINE_WIDTH} />
      <Ellipse
        cx={53}
        cy={70}
        rx={27}
        ry={15}
        fill={BODY_FILL}
        stroke={OUTLINE}
        strokeWidth={OUTLINE_WIDTH}
      />
      <Path d="M28 74 Q53 86 78 74 Q53 80 28 74 z" fill={BODY_SHADE} opacity={0.7} />
      {/* 投げ出した前足 */}
      <Ellipse cx={30} cy={79} rx={7} ry={4.5} fill={BODY_FILL} stroke={OUTLINE} strokeWidth={OUTLINE_WIDTH} />
      {/* 垂れた耳 */}
      <G transform="rotate(66 24 62)">
        <Ellipse cx={24} cy={62} rx={7} ry={12} fill={EAR_FILL} stroke={OUTLINE} strokeWidth={OUTLINE_WIDTH} />
        <Ellipse cx={24} cy={63} rx={3.4} ry={7} fill={EAR_INNER} />
      </G>
      <Ellipse cx={38} cy={68} rx={12} ry={3} fill={BODY_SHADE} opacity={0.5} />
      <Circle cx={38} cy={54} r={17.5} fill={BODY_FILL} stroke={OUTLINE} strokeWidth={OUTLINE_WIDTH} />
      {/* 寝ぐせ */}
      <Path
        d="M34 38 Q30 31 36 28 Q32 23 38 21"
        stroke={EAR_FILL}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      {/* 片目はつむり、片目だけ開けた、ぐうたらの顔 */}
      <Path d="M27 52 Q30.5 55 34 52" stroke={LINE_COLOR} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      {openEye(41.5, 52.5)}
      <Ellipse cx={48} cy={60} rx={6.5} ry={4.8} fill="#FCEFD8" />
      <Ellipse cx={48} cy={58.6} rx={2.6} ry={1.9} fill={LINE_COLOR} />
      {/* ぺろっと出た舌、笑みとして描く */}
      <Path d="M45 62.5 Q48 67.5 51 62.5" stroke={TONGUE_FILL} strokeWidth={3} strokeLinecap="round" fill="none" />
      {/* 散らかったおもちゃ(骨型) */}
      <Path
        d="M70 88 h9 M70 88 a2.2 2.2 0 1 0 0.01 0 M79 88 a2.2 2.2 0 1 0 0.01 0"
        stroke="#CFCFCF"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}

const POSE_RENDERERS: Record<SaborinePose, () => JSX.Element> = {
  normal: normalPose,
  happy: happyPose,
  eating: eatingPose,
  sleepy: sleepyPose,
  sloppy: sloppyPose,
};

export function renderPose(pose: SaborinePose): JSX.Element {
  const render = POSE_RENDERERS[pose];
  return render();
}

// なつき度で解放される仕草を、控えめな装飾として重ねる。名前や相手を指す文字は出さない。
export function renderGestureDecorations(gestures: readonly SaborineGesture[]): JSX.Element | null {
  if (gestures.length === 0) {
    return null;
  }
  const has = (gesture: SaborineGesture) => gestures.includes(gesture);
  return (
    <G>
      {has("facesPartner") && <Circle cx={50} cy={12} r={1.8} fill={BLUSH_FILL} />}
      {has("callsName") && (
        <Path d="M20 26 q4 -4 8 0 q-2 4 -8 0" fill="#FFE3B0" stroke={OUTLINE} strokeWidth={0.6} />
      )}
      {has("approaches") && (
        <G opacity={0.6}>
          <Path d="M14 70 h6" stroke={OUTLINE} strokeWidth={1.4} strokeLinecap="round" />
          <Path d="M12 76 h6" stroke={OUTLINE} strokeWidth={1.4} strokeLinecap="round" />
        </G>
      )}
      {has("specialGesture") && (
        <G>
          <Path d="M84 20 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6 z" fill="#FFD873" />
        </G>
      )}
    </G>
  );
}

// 進化の系統を、犬本体を覆わない小さなアクセントとして足す。系統が無ければ何も描かない。
export function renderLineageAccent(lineage: SaborineLineage | null): JSX.Element | null {
  if (lineage === null) {
    return null;
  }
  if (lineage === "harmony") {
    return <Circle cx={50} cy={50} r={44} fill="none" stroke="#9FD8D3" strokeWidth={1.4} opacity={0.5} />;
  }
  if (lineage === "blossom") {
    return (
      <G>
        <Circle cx={70} cy={30} r={3} fill="#F5A9C6" />
        <Circle cx={74} cy={27} r={2.4} fill="#F7C1D8" />
        <Circle cx={74} cy={34} r={2.4} fill="#F7C1D8" />
      </G>
    );
  }
  return (
    <G opacity={0.7}>
      <Circle cx={16} cy={86} r={2.2} fill="#C9A579" />
      <Circle cx={22} cy={90} r={1.6} fill="#C9A579" />
    </G>
  );
}
