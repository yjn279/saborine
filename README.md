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

サーバーはローカルのデータベース（Tursoの `turso dev`）を先に起動してからマイグレーションを当て、そのあとで `wrangler dev` を起動する。

```sh
# 1. ローカルのデータベースを起動する（ポート8080でHTTP入口が開く）
turso dev -f server/.dev.db -p 8080

# 2. 別のターミナルで、そのデータベースにテーブルを作る
node server/scripts/migrate.mjs http://127.0.0.1:8080

# 3. server/.dev.vars.example を server/.dev.vars にコピーする（1回だけ）
cp server/.dev.vars.example server/.dev.vars

# 4. サーバー（Cloudflare Workers）をローカルで起動する（既定でポート8787）
npm run dev -w server

# 5. 別のターミナルで、アプリ（Expo）をWebで起動する
npm run web -w app
```

## 通しの動作確認

招待からゲージ・なつき度の変動までがひと続きで動くことを、2つのブラウザセッション（2ユーザー）で確かめる手順。

1. 上記の「開発」の手順で、データベース・サーバー・アプリを起動する
2. ブラウザAでアプリ（既定で `http://localhost:8081`）を開き、表示名を入れて登録する（1人目）
3. 「はじめかた」の直後、または設定画面から手紙（招待リンク）を取得し、リンクをコピーする
4. 別のブラウザ（シークレットウィンドウなど、Aとは保存領域が分かれるセッション）でそのリンクを開き、表示名を入れて受諾する（2人目）
5. Bの画面で、Aの直近の記録にありがとうを送る（Aがまだ何も記録していなければ、先にAで1件記録してから行う）
6. Aの画面で「きろくする」からもう1件記録し、Bの画面でありがとうを送る
7. 双方の画面で、サボリーヌがごはんを食べて喜ぶ反応・息ぴったりゲージ・なつき度の仕草解放が変化することを確かめる

## 確認コマンド

```sh
npm run lint       # ESLint（ルート・app・server まとめて）
npm run typecheck  # 型チェック（app・server それぞれ）
npm test           # 自動テスト（いまはserverのみ）
```

## Webの書き出し

```sh
cd app && npx expo export --platform web
```
