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

## 本番へ出す

アプリとAPIは1つの Cloudflare Worker（名前は `saborine`）から同じ場所（オリジン）で配る。アプリを書き出してから Worker を出す、という2手を1つのコマンドにまとめてある。

```sh
npm run deploy
```

公開先は `https://saborine.<アカウントのサブドメイン>.workers.dev` になる。

### 初回だけ必要な準備

1. Cloudflare と Turso にログインする。

   ```sh
   npx wrangler login
   turso auth login
   ```

2. 本番のデータベースを作り、テーブルを用意する。

   ```sh
   turso db create saborine --group default
   node server/scripts/migrate.mjs "$(turso db show saborine --url)?authToken=$(turso db tokens create saborine)"
   ```

3. 通知の署名に使う鍵（VAPID鍵）を作る。公開鍵は `app/.env.production` に書いてある値と一致させる。作り直した場合は両方を差し替える。

   ```sh
   npx web-push generate-vapid-keys
   ```

4. 秘密の設定を Worker に登録する。それぞれ対話で値を貼り付ける。

   ```sh
   cd server
   npx wrangler secret put DB_URL            # turso db show saborine --url の値
   npx wrangler secret put DB_AUTH_TOKEN     # turso db tokens create saborine の値
   npx wrangler secret put VAPID_PUBLIC_KEY
   npx wrangler secret put VAPID_PRIVATE_KEY
   npx wrangler secret put VAPID_SUBJECT     # mailto: から始まる連絡先
   ```

`app/.env.production` に秘密は入れない。ここに書く値はブラウザに配られるため、公開してよいものだけを置く。
