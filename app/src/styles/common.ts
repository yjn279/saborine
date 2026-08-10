import { StyleSheet } from "react-native";

// 縦積みの案内画面(はじめかた・紹介・手紙の出迎え)が共通で使う見た目。
export const commonStyles = StyleSheet.create({
  error: {
    color: "#c0392b",
    fontSize: 14,
    textAlign: "center",
  },
  screenContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  screenSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#f4a261",
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    minWidth: 160,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
