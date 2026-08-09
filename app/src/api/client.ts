import type { Identity } from "../auth/identity";

// サーバーの入口。ローカル開発では `wrangler dev` の既定ポートに向ける。
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

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
    throw new ApiError(message, response.status);
  }
  return payload as T;
}
