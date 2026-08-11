// 画面の見た目を決める値を、ここ1か所にまとめる。
// 各画面が独自に色や余白を決めると、少しずつずれた値が増えて全体が散らかる。
//
// 色の考え方: 背景はサボリーヌのいる部屋であり、白ではなく温かいクリームにする。
// 面は背景よりわずかに明るくして浮かせ、線は使わずに影で段差を作る。
// 文字色は3段(主・副・控えめ)だけにし、それ以上の濃さを増やさない。

export const colors = {
  // 部屋の地
  background: "#FDF6EA",
  // 背景の上に置く面(相手のできごと、案内など)
  surface: "#FFFCF6",
  surfaceShadow: "#E4D3B4",
  // 文字
  text: "#4A3826",
  textMuted: "#8A7660",
  textFaint: "#B0A08C",
  // サボリーヌのひとこと
  serif: "#6B5237",
  // 主たる行き先(記録する・はじめる)
  primary: "#E8944A",
  primaryText: "#FFFFFF",
  // ありがとうを送る
  accent: "#E4694A",
  accentText: "#FFFFFF",
  // 解放の知らせなど、目を引かせたい一言
  highlight: "#D9713F",
  // うまくいかなかったことを伝える
  error: "#C0392B",
  // なつき度・息ぴったりのゲージ
  gaugeTrack: "#EFE0C6",
  gaugeFill: "#F0B26B",
} as const;

// 余白は4の倍数だけを使う。中途半端な値を混ぜない。
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// 文字の大きさは4段だけ。見出し・本文・ひとこと・注記。
export const fontSize = {
  title: 20,
  body: 16,
  serif: 15,
  caption: 13,
} as const;

export const radius = {
  card: 20,
  pill: 999,
} as const;

// 面を背景から浮かせる影。線で囲むより柔らかく、部屋の雰囲気を壊さない。
export const surfaceShadow = {
  shadowColor: colors.surfaceShadow,
  shadowOpacity: 0.5,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
