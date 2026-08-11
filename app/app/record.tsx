import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ApiError } from "../src/api/client";
import { fetchChorePresets, recordChore } from "../src/api/home";
import { useIdentity } from "../src/auth/useIdentity";
import { CloseButton } from "../src/components/CloseButton";
import { Saborine } from "../src/components/saborine/Saborine";
import { useTimeoutRef } from "../src/hooks/useTimeoutRef";
import { REACTION_DURATION_MS } from "../src/reactionDuration";
import { buildRecordReactionMessage } from "../src/record/reaction";
import { commonStyles } from "../src/styles/common";

const FREE_TEXT_MAX_LENGTH = 30;

// 記録シート。ホームの記録ボタンと、サボリーヌ自身をタップしたときの両方から開く
// (docs/mvp.md:53)。プリセット6種は最近使った順に並び、1タップで記録が完了する。
// 写真・詳細・相手の承認は求めない。記録が成立すると、閉じる前によろこぶ姿とひとことを
// 短く見せる。
export default function Record() {
  const router = useRouter();
  const identity = useIdentity();
  const { isSloppy } = useLocalSearchParams<{ isSloppy?: string }>();
  const wasSloppy = isSloppy === "1";
  const [presets, setPresets] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [recordingChoreType, setRecordingChoreType] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);
  const closeTimer = useTimeoutRef();
  const closedRef = useRef(false);

  useEffect(() => {
    if (!identity) {
      return;
    }
    let active = true;
    fetchChorePresets(identity)
      .then((response) => {
        if (active) {
          setPresets(response.presets);
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(error instanceof ApiError ? error.message : "よみこみに しっぱいしました");
        }
      });
    return () => {
      active = false;
    };
  }, [identity]);

  const handleRecord = async (choreType: string) => {
    const trimmed = choreType.trim();
    if (!trimmed || !identity || recordingChoreType) {
      return;
    }
    setRecordingChoreType(trimmed);
    setErrorMessage(null);
    try {
      await recordChore(identity, trimmed);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "きろくに しっぱいしました");
      setRecordingChoreType(null);
      return;
    }
    setReactionMessage(buildRecordReactionMessage({ choreType: trimmed, wasSloppy }));
    closeTimer.arm(() => {
      closedRef.current = true;
      router.back();
    }, REACTION_DURATION_MS);
  };

  // 自動で閉じるタイマーとタップの両方から呼ばれうるが、router.back()は一度しか
  // 実行してはいけない(二重に呼ぶと余分に一つ前の画面まで戻ってしまう)。
  const closeNow = () => {
    if (closedRef.current) {
      return;
    }
    closedRef.current = true;
    closeTimer.clear();
    router.back();
  };

  const trimmedFreeText = freeText.trim();

  if (reactionMessage) {
    return (
      <Pressable style={commonStyles.screenContainer} onPress={closeNow}>
        <Saborine pose="happy" size={110} />
        <Text style={styles.reactionText}>{reactionMessage}</Text>
      </Pressable>
    );
  }

  return (
    <View style={commonStyles.screenContainer}>
      <Saborine pose="normal" size={110} />
      <Text style={commonStyles.title}>なにか してくれた?</Text>

      {loadError ? <Text style={commonStyles.error}>{loadError}</Text> : null}
      {!loadError && !presets ? <ActivityIndicator /> : null}

      {presets ? (
        <View style={styles.presetGrid}>
          {presets.map((preset) => (
            <Pressable
              key={preset}
              style={[styles.presetButton, recordingChoreType !== null && styles.disabled]}
              onPress={() => handleRecord(preset)}
              disabled={recordingChoreType !== null}
            >
              {recordingChoreType === preset ? (
                <ActivityIndicator color="#6b5237" />
              ) : (
                <Text style={styles.presetText}>{preset}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.freeTextRow}>
        <TextInput
          style={styles.freeTextInput}
          value={freeText}
          onChangeText={setFreeText}
          placeholder="ほかに したこと"
          maxLength={FREE_TEXT_MAX_LENGTH}
          editable={recordingChoreType === null}
        />
        <Pressable
          style={[
            styles.freeTextButton,
            (!trimmedFreeText || recordingChoreType !== null) && styles.disabled,
          ]}
          onPress={() => handleRecord(freeText)}
          disabled={!trimmedFreeText || recordingChoreType !== null}
        >
          {recordingChoreType === trimmedFreeText && trimmedFreeText ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.freeTextButtonText}>きろく</Text>
          )}
        </Pressable>
      </View>

      {errorMessage ? <Text style={commonStyles.error}>{errorMessage}</Text> : null}

      <CloseButton onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  reactionText: {
    fontSize: 16,
    color: "#6b5237",
    textAlign: "center",
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    maxWidth: 360,
  },
  presetButton: {
    backgroundColor: "#fdf1de",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 96,
    alignItems: "center",
  },
  presetText: {
    color: "#6b5237",
    fontSize: 15,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  freeTextRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    maxWidth: 360,
  },
  freeTextInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  freeTextButton: {
    backgroundColor: "#f4a261",
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  freeTextButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
