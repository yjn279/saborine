import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ApiError } from "../src/api/client";
import {
  deleteAccount,
  fetchSettings,
  unpair,
  updateSettings,
  type SettingsState,
} from "../src/api/settings";
import { clearIdentity } from "../src/auth/identity";
import { useIdentity } from "../src/auth/useIdentity";
import { CloseButton } from "../src/components/CloseButton";
import { subscribeToPush, unsubscribeFromPush } from "../src/push/subscribe";
import { commonStyles } from "../src/styles/common";

const CHARACTER_NAME_MAX_LENGTH = 20;

// 設定画面。4項目だけを置く: お知らせのオン・オフ、サボリーヌの名前変更、
// ペア解除、アカウント削除。通知・催促・タスク割当に類する項目は持たない
// (server/src/routes/settings.ts, server/src/routes/pair.ts)。管理の道具に
// 見せないよう、最小限の見た目にとどめる。
export default function Settings() {
  const router = useRouter();
  const identity = useIdentity();
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [characterName, setCharacterName] = useState("");
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [confirmingUnpair, setConfirmingUnpair] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!identity) {
      return;
    }
    let active = true;
    fetchSettings(identity)
      .then((loadedSettings) => {
        if (active) {
          setSettings(loadedSettings);
          setCharacterName(loadedSettings.characterName);
        }
      })
      .catch((error) => {
        if (active) {
          setLoadError(error instanceof ApiError ? error.message : "せっていが よみこめませんでした");
        }
      });
    return () => {
      active = false;
    };
  }, [identity]);

  const handleToggleNotifications = async (next: boolean) => {
    if (!identity || !settings || savingNotifications) {
      return;
    }
    setSavingNotifications(true);
    setActionError(null);
    const previous = settings.notificationsEnabled;
    setSettings({ ...settings, notificationsEnabled: next });
    try {
      const updated = await updateSettings(identity, { notificationsEnabled: next });
      setSettings(updated);
    } catch (error) {
      setSettings({ ...settings, notificationsEnabled: previous });
      setActionError(error instanceof ApiError ? error.message : "へんこうに しっぱいしました");
      setSavingNotifications(false);
      return;
    }
    setSavingNotifications(false);

    // お知らせの設定に合わせて、この端末の購読も切り替える。購読側の失敗(未対応環境・
    // 許可なし等)は、すでに保存済みの設定を巻き戻す理由にはしない。
    if (next) {
      await subscribeToPush(identity);
    } else {
      await unsubscribeFromPush(identity).catch(() => undefined);
    }
  };

  const trimmedName = characterName.trim();
  const canSaveName = !!identity && !!settings && !!trimmedName && trimmedName !== settings.characterName;

  const handleSaveName = async () => {
    if (!identity || !canSaveName || savingName) {
      return;
    }
    setSavingName(true);
    setActionError(null);
    try {
      const updated = await updateSettings(identity, { characterName: trimmedName });
      setSettings(updated);
      setCharacterName(updated.characterName);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "なまえの へんこうに しっぱいしました");
    } finally {
      setSavingName(false);
    }
  };

  const handleUnpair = async () => {
    if (!identity || processing) {
      return;
    }
    setProcessing(true);
    setActionError(null);
    try {
      await unpair(identity);
      await clearIdentity();
      router.replace("/onboarding");
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "ペアかいじょに しっぱいしました");
      setProcessing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!identity || processing) {
      return;
    }
    setProcessing(true);
    setActionError(null);
    try {
      await deleteAccount(identity);
      await clearIdentity();
      router.replace("/onboarding");
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "さくじょに しっぱいしました");
      setProcessing(false);
    }
  };

  if (!identity || (!settings && !loadError)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>せってい</Text>

      {loadError ? <Text style={commonStyles.error}>{loadError}</Text> : null}

      {settings ? (
        <>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>おしらせ</Text>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={handleToggleNotifications}
              disabled={savingNotifications}
            />
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.rowLabel}>サボリーヌの なまえ</Text>
            <View style={styles.nameInputRow}>
              <TextInput
                style={styles.nameInput}
                value={characterName}
                onChangeText={setCharacterName}
                maxLength={CHARACTER_NAME_MAX_LENGTH}
                editable={!savingName}
              />
              <Pressable
                style={[styles.saveButton, !canSaveName && styles.disabled]}
                onPress={handleSaveName}
                disabled={!canSaveName}
              >
                {savingName ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>へんこう</Text>
                )}
              </Pressable>
            </View>
          </View>

          {actionError ? <Text style={commonStyles.error}>{actionError}</Text> : null}

          <View style={styles.dangerZone}>
            {confirmingUnpair ? (
              <View style={styles.confirmRow}>
                <Text style={styles.confirmText}>ほんとうに ペアを かいじょする?</Text>
                <Pressable style={styles.dangerButton} onPress={handleUnpair} disabled={processing}>
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.dangerButtonText}>かいじょする</Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setConfirmingUnpair(false)} disabled={processing}>
                  <Text style={styles.cancelText}>やめる</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.linkButton} onPress={() => setConfirmingUnpair(true)}>
                <Text style={styles.linkButtonText}>ペアを かいじょする</Text>
              </Pressable>
            )}

            {confirmingDelete ? (
              <View style={styles.confirmRow}>
                <Text style={styles.confirmText}>ほんとうに アカウントを さくじょする?</Text>
                <Pressable style={styles.dangerButton} onPress={handleDeleteAccount} disabled={processing}>
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.dangerButtonText}>さくじょする</Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setConfirmingDelete(false)} disabled={processing}>
                  <Text style={styles.cancelText}>やめる</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.linkButton} onPress={() => setConfirmingDelete(true)}>
                <Text style={styles.linkButtonText}>アカウントを さくじょする</Text>
              </Pressable>
            )}
          </View>
        </>
      ) : null}

      <CloseButton onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 320,
  },
  nameRow: {
    width: "100%",
    maxWidth: 320,
    gap: 8,
  },
  rowLabel: {
    fontSize: 15,
    color: "#5c4a30",
  },
  nameInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: "#f4a261",
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  dangerZone: {
    width: "100%",
    maxWidth: 320,
    gap: 16,
    marginTop: 8,
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  linkButtonText: {
    color: "#a0522d",
    fontSize: 14,
  },
  confirmRow: {
    alignItems: "center",
    gap: 8,
  },
  confirmText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
  dangerButton: {
    backgroundColor: "#c0392b",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 160,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelText: {
    color: "#999",
    fontSize: 13,
  },
});
