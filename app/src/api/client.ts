import type { Identity } from "../auth/identity";

// サーバーの入口。既定は空、つまりアプリ自身と同じ場所への相対パスであり、これが本番の姿である。
// 開発中だけアプリとサーバーが別のポートで動くため、app/.env.development で宛先を上書きする。
// 既定を本番の姿にしておくと、設定の読み込みに失敗しても本番が壊れず、開発側がその場で失敗する。
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

// このアプリの公開URL。ネイティブでは実行中のページのアドレスを取れないため、
// 招待リンクなど絶対URLが要る場面はここを使う。ローカル開発ではExpoのWebサーバーの
// 既定ポートに向ける。
export const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:8081";

// サーバーが失敗を返した、またはサーバーに届かなかったことを表す。
// メッセージはそのまま画面に出せる日本語にする。
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  identity?: Identity;
}

// 401(=このBearerトークンではもう認証できない。ペア解除やアカウント削除で、
// 相手側の身分証がその場で失効した場合など)を検知したときに呼ぶ。
// useIdentity.tsは画面の表示中はここに自分自身を登録し、はじめかた画面へ
// 送り返す。React Navigationのスタックでは複数の画面が同時にマウントされうるため、
// 単一のスロットではなく集合で持ち、登録されている全画面へ知らせる。
const unauthorizedHandlers = new Set<() => void>();

// 登録すると、解除するための関数を返す(useIdentity.tsのアンマウント時に呼ぶ)。
export function addUnauthorizedHandler(handler: () => void): () => void {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

function isErrorBody(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  );
}

// サーバーへの通信をまとめる部品。認証トークンの付与だけを担い、失敗は
// そのまま呼び出し側に投げる(代替値で処理を続けない)。
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.identity) {
    headers.Authorization = `Bearer ${options.identity.userId}:${options.identity.secret}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("サボリーヌに とどきませんでした。つうしんを たしかめてね", 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isErrorBody(payload) ? payload.error : "サーバーとの つうしんに しっぱいしました";
    if (response.status === 401 && options.identity) {
      unauthorizedHandlers.forEach((handler) => handler());
    }
    throw new ApiError(message, response.status);
  }
  return payload as T;
}
