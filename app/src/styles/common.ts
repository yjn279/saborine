import { StyleSheet } from "react-native";
import { colors, fontSize, radius, space, surfaceShadow } from "./theme";

// どの画面も同じ地の上に立つようにするための共通の見た目。
// 色・余白・文字の大きさは theme.ts の値だけを使い、ここで新しい数値を作らない。
export const commonStyles = StyleSheet.create({
  error: {
    color: colors.error,
    fontSize: fontSize.caption,
    textAlign: "center",
  },
  screenContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    padding: space.xl,
    backgroundColor: colors.background,
    // スマホの片手で使う画面である。広い画面では列を絞らないと、
    // 中央揃えの本文が1行ごとに折り返し位置を変えて読みにくくなる。
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  screenTitle: {
    fontSize: fontSize.title,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    lineHeight: fontSize.title * 1.5,
  },
  screenSubtitle: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: fontSize.body * 1.6,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
    minWidth: 200,
    alignItems: "center",
    ...surfaceShadow,
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontSize: fontSize.body,
    fontWeight: "600",
  },
  title: {
    fontSize: fontSize.body + 2,
    fontWeight: "600",
    color: colors.text,
  },
  shareButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl + space.xs,
    paddingVertical: space.md,
    alignItems: "center",
    ...surfaceShadow,
  },
  shareButtonText: {
    color: colors.accentText,
    fontSize: fontSize.serif,
    fontWeight: "600",
  },
  // 背景から浮かせた面。相手のできごとや案内を置く。
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    alignItems: "center",
    gap: space.md,
    ...surfaceShadow,
  },
});
