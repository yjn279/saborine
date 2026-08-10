import { createIdentity, saveIdentity, type Identity } from "./identity";

// 新規登録(onboarding.tsx)と招待受諾(join/[token].tsx)の両方が使う、身分証の
// 作成からサーバーへの登録・端末保存までの手順。サーバー側の登録・受諾は1回だけ
// 行う。その呼び出しが成功したあとに端末保存だけが失敗した場合、サーバー側の状態は
// 既に確定しているため、サーバーへ再度リクエストを送らずに保存だけをやり直せる
// ようにする(retrySaveIdentity)。
export type IdentityRegistrationResult =
  | { status: "success"; identity: Identity }
  | { status: "api-error"; error: unknown }
  | { status: "save-error"; identity: Identity };

// サーバー側の登録・受諾を1回行い、成功したら端末への保存を試みる。
export async function registerIdentity(
  register: (identity: Identity) => Promise<unknown>,
): Promise<IdentityRegistrationResult> {
  const identity = createIdentity();
  try {
    await register(identity);
  } catch (error) {
    return { status: "api-error", error };
  }
  return retrySaveIdentity(identity);
}

// サーバー呼び出しをやり直さず、既に確定した身分証の端末保存だけを再試行する。
export async function retrySaveIdentity(identity: Identity): Promise<IdentityRegistrationResult> {
  try {
    await saveIdentity(identity);
  } catch {
    return { status: "save-error", identity };
  }
  return { status: "success", identity };
}
