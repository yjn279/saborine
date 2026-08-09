# saborine

同棲カップル・夫婦向けの、家事とありがとうでふたりの犬「サボリーヌ」を育てるアプリ。

## 構成

npm workspaces のモノレポ。

| 場所 | 中身 |
| :-- | :-- |
| `app/` | Expo（React Native）+ TypeScript + Expo Router。iOSとWebに対応し、Webを優先する |
| `server/` | Cloudflare Workers + Hono + TypeScript。データベースは Turso（libSQL） |

## はじめかた

```sh
npm install
```

## 開発

```sh
# サーバー（Cloudflare Workers）をローカルで起動する
npm run dev -w server

# アプリ（Expo）をWebで起動する
npm run web -w app
```

## 確認コマンド

```sh
npm run lint       # ESLint（ルート・app・server まとめて）
npm run typecheck  # 型チェック（app・server それぞれ）
```

## Webの書き出し

```sh
cd app && npx expo export --platform web
```
