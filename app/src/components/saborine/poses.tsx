import type { JSX } from "react";
import { Circle, Ellipse, G, Path, Text as SvgText } from "react-native-svg";
import type { SaborineGesture, SaborineLineage, SaborinePose } from "./types";

// 100x100の枠の中に、犬「サボリーヌ」を描く。姿の差分だけが感情を運ぶため、
// 5つの姿はすべて別関数として独立させ、混ざらないようにする。
// だらしな以外は座った姿勢、だらしなだけ横になった姿勢にする。

const BODY_FILL = "#F6E1BE";
const EAR_FILL = "#E3AE74";
const SHADE_FILL = "#EAD0A3";
const LINE_COLOR = "#6B5237";
const BLUSH_FILL = "#F3AFAE";

function legs() {
  return (
    <G>
      <Ellipse cx={38} cy={83} rx={5} ry={7} fill={BODY_FILL} />
      <Ellipse cx={62} cy={83} rx={5} ry={7} fill={BODY_FILL} />
    </G>
  );
}

function earsRelaxed() {
  return (
    <G>
      <Ellipse cx={35} cy={31} rx={7} ry={12} fill={EAR_FILL} transform="rotate(-18 35 31)" />
      <Ellipse cx={65} cy={31} rx={7} ry={12} fill={EAR_FILL} transform="rotate(18 65 31)" />
    </G>
  );
}

function blush() {
  return (
    <G>
      <Ellipse cx={38} cy={46} rx={3.5} ry={2.2} fill={BLUSH_FILL} />
      <Ellipse cx={62} cy={46} rx={3.5} ry={2.2} fill={BLUSH_FILL} />
    </G>
  );
}

function tailCurled() {
  return (
    <Path
      d="M71 62 C 82 58, 84 46, 76 40"
      stroke={EAR_FILL}
      strokeWidth={6}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function normalPose() {
  return (
    <G>
      {legs()}
      <Ellipse cx={50} cy={68} rx={22} ry={16} fill={BODY_FILL} />
      {tailCurled()}
      {earsRelaxed()}
      <Circle cx={50} cy={42} r={18} fill={BODY_FILL} />
      {blush()}
      <Circle cx={43} cy={40} r={2.2} fill={LINE_COLOR} />
      <Circle cx={57} cy={40} r={2.2} fill={LINE_COLOR} />
      <Ellipse cx={50} cy={47} rx={2.4} ry={1.8} fill={LINE_COLOR} />
      <Path d="M46 51 Q50 53 54 51" stroke={LINE_COLOR} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </G>
  );
}

function happyPose() {
  return (
    <G>
      {legs()}
      <Ellipse cx={50} cy={68} rx={22} ry={16} fill={BODY_FILL} />
      <Path
        d="M71 60 C 85 52, 88 40, 78 32"
        stroke={EAR_FILL}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={34} cy={28} rx={7} ry={12} fill={EAR_FILL} transform="rotate(-30 34 28)" />
      <Ellipse cx={66} cy={28} rx={7} ry={12} fill={EAR_FILL} transform="rotate(30 66 28)" />
      <Circle cx={50} cy={40} r={18} fill={BODY_FILL} />
      {blush()}
      <Path d="M40 38 Q43 34 46 38" stroke={LINE_COLOR} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M54 38 Q57 34 60 38" stroke={LINE_COLOR} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Ellipse cx={50} cy={45} rx={2.4} ry={1.8} fill={LINE_COLOR} />
      <Path d="M44 49 Q50 56 56 49" stroke={LINE_COLOR} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Ellipse cx={50} cy={54} rx={2.6} ry={3.4} fill="#E98787" />
    </G>
  );
}

function eatingPose() {
  return (
    <G>
      {legs()}
      <Ellipse cx={50} cy={68} rx={22} ry={16} fill={BODY_FILL} />
      {tailCurled()}
      <Ellipse cx={35} cy={38} rx={7} ry={12} fill={EAR_FILL} transform="rotate(-10 35 38)" />
      <Ellipse cx={65} cy={38} rx={7} ry={12} fill={EAR_FILL} transform="rotate(10 65 38)" />
      <Circle cx={50} cy={50} r={17} fill={BODY_FILL} />
      <Path d="M41 47 Q44 44 47 47" stroke={LINE_COLOR} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M53 47 Q56 44 59 47" stroke={LINE_COLOR} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Ellipse cx={50} cy={56} rx={2.4} ry={1.8} fill={LINE_COLOR} />
      <Ellipse cx={38} cy={86} rx={13} ry={5} fill="#D9915B" />
      <Ellipse cx={38} cy={84} rx={10} ry={3.4} fill="#F0B26B" />
    </G>
  );
}

function sleepyPose() {
  return (
    <G>
      {legs()}
      <Ellipse cx={50} cy={70} rx={22} ry={15} fill={BODY_FILL} />
      <Ellipse cx={36} cy={35} rx={7} ry={11} fill={EAR_FILL} transform="rotate(4 36 35)" />
      <Ellipse cx={64} cy={35} rx={7} ry={11} fill={EAR_FILL} transform="rotate(-4 64 35)" />
      <Circle cx={50} cy={44} r={18} fill={BODY_FILL} />
      <Path d="M39 44 L47 44" stroke={LINE_COLOR} strokeWidth={2} strokeLinecap="round" />
      <Path d="M53 44 L61 44" stroke={LINE_COLOR} strokeWidth={2} strokeLinecap="round" />
      <Ellipse cx={50} cy={49} rx={2.2} ry={1.6} fill={LINE_COLOR} />
      <Path d="M46 53 Q50 54 54 53" stroke={LINE_COLOR} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      <SvgText x={66} y={26} fontSize={9} fill={LINE_COLOR}>
        Z
      </SvgText>
      <SvgText x={74} y={18} fontSize={6} fill={LINE_COLOR}>
        z
      </SvgText>
    </G>
  );
}

// だらしな: ぐうたら寝転がる・寝ぐせ・おもちゃの散らかしとして愛嬌に描く。
// 涙・下がった眉・暗い色は使わず、閉じた口元と軽い笑みだけにとどめる(docs/mvp.md:144)。
function sloppyPose() {
  return (
    <G>
      <Ellipse cx={50} cy={78} rx={30} ry={13} fill={SHADE_FILL} opacity={0.6} />
      <Ellipse cx={52} cy={70} rx={26} ry={15} fill={BODY_FILL} />
      <Ellipse cx={30} cy={78} rx={6} ry={4} fill={BODY_FILL} />
      <Ellipse cx={74} cy={78} rx={6} ry={4} fill={BODY_FILL} />
      <Ellipse cx={29} cy={58} rx={7} ry={11} fill={EAR_FILL} transform="rotate(80 29 58)" />
      <Circle cx={38} cy={54} r={17} fill={BODY_FILL} />
      {/* 寝ぐせ */}
      <Path
        d="M34 40 Q31 33 36 30 Q33 25 38 23"
        stroke={EAR_FILL}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M30 52 Q33 49 36 52" stroke={LINE_COLOR} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Circle cx={44} cy={53} r={2} fill={LINE_COLOR} />
      <Ellipse cx={49} cy={58} rx={2.4} ry={1.6} fill={LINE_COLOR} />
      {/* ぺろっと出た舌、笑みとして描く */}
      <Path d="M46 61 Q49 66 52 61" stroke="#E98787" strokeWidth={3} strokeLinecap="round" fill="none" />
      {/* 散らかったおもちゃ(骨型) */}
      <Path
        d="M68 82 h10 M68 82 a2 2 0 1 0 0.01 0 M78 82 a2 2 0 1 0 0.01 0"
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
      {has("facesPartner") && <Circle cx={50} cy={12} r={1.6} fill="#F3AFAE" />}
      {has("callsName") && (
        <Path d="M20 26 q4 -4 8 0 q-2 4 -8 0" fill="#FFE3B0" stroke={LINE_COLOR} strokeWidth={0.6} />
      )}
      {has("approaches") && (
        <G opacity={0.6}>
          <Path d="M14 70 h6" stroke={LINE_COLOR} strokeWidth={1.4} strokeLinecap="round" />
          <Path d="M12 76 h6" stroke={LINE_COLOR} strokeWidth={1.4} strokeLinecap="round" />
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
