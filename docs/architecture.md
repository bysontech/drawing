# 基本設計 — パーティーくじ引きアプリ

---

## テンプレート判定

| 判定項目 | 結果 |
|---------|------|
| 複数端末でデータ共有が必要か | ✅ 主催者と参加者が同一ルームを参照 |
| 昇格トリガー該当 | ✅「データ共有」に完全一致 |
| 採用テンプレ | **B + C 併用**（フロントはB、API/DBはC） |

**スタック決定:**
- フロントエンド: Cloudflare Pages + Vite + React + TypeScript + PWA
- API: Cloudflare Workers（Hono）
- DB: Cloudflare D1（SQLite）
- リアルタイム: クライアント側ポーリング（3 秒間隔）※Durable Objects は不使用（コスト最小化）
- QRコード生成: クライアント側ライブラリ（`qrcode.react`）

---

## 画面・機能一覧

### 主催者ルーム作成画面 `/`
- ルーム作成ボタン
- 作成後、主催者トークン（UUID）をローカルストレージに保存
- 参加用URL表示 + ワンクリックコピーボタン
- QRコード表示（参加URL埋め込み）
- 抽選設定フォーム
  - 順位あり／なし（トグル）
  - 当選人数（数値入力）
  - 役割割り当て（テキスト入力、カンマ区切り。例: 司会, 幹事）
- 参加締め切りボタン（参加者1名以上のとき活性化）
- 参加者一覧エリア（3秒ポーリングで自動更新）
  - 参加者名 + 参加時刻
  - 現在の参加人数バッジ
- 締め切り済み状態の明示バナー（ステータスに応じて色変化）
- くじ引き開始ボタン（締め切り後のみ活性化）

### 主催者くじ引き画面 `/room/:roomId/draw`（主催者トークン保持時のみアクセス可）
- 開始ボタン（抽選実行APIを呼ぶ）
- くじ引きアニメーション（シャッフルエフェクト + 順次発表）
- 結果表示（必須・常時表示）
  - 順位ありの場合: 1位 → 2位 → … の順に演出表示
  - 役割割り当てありの場合: 名前 + 役割名を表示
- 参加者への結果共有トグル（ON にするとポーリング経由で参加者画面に結果が流れる）

### 参加者ニックネーム入力画面 `/join/:joinCode`
- ルーム名 + 現在の参加人数を表示
- ニックネーム入力フィールド
- バリデーション: 空白不可、同一ルーム内重複不可
- 重複エラー時のインラインメッセージ（「そのニックネームはすでに使われています」）
- 参加ボタン
- 参加締め切り済みルームへのアクセス時は「受付終了」画面を表示

### 参加者待機・結果表示画面 `/room/:roomId/participant`
- 参加完了メッセージ + 自分のニックネーム表示
- 待機中インジケーター（「主催者がくじ引きを開始するまでお待ちください」）
- 3秒ポーリングでルームステータスを監視
- 結果公開設定がONの場合: 抽選完了後に結果を表示
  - 自分が当選していれば強調表示（ハイライト）
- 結果公開設定がOFFの場合: 「結果は主催者にお聞きください」を表示

---

## データモデル

### rooms テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT (UUID) | ルームID（主キー） |
| `join_code` | TEXT | 参加用短縮コード（6文字英数字、ユニーク） |
| `host_token` | TEXT | 主催者識別トークン（UUID）。クライアントのローカルストレージに保存 |
| `status` | TEXT | `waiting` / `closed` / `drawn` |
| `lottery_settings` | TEXT (JSON) | 抽選設定（後述） |
| `show_result_to_participants` | INTEGER | 0: 非公開 / 1: 公開 |
| `created_at` | TEXT (ISO8601) | 作成日時 |

**lottery_settings JSONスキーマ:**
```json
{
  "ranked": true,
  "winner_count": 3,
  "roles": ["司会", "幹事", "会計"]
}
```

### participants テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT (UUID) | 参加者ID（主キー） |
| `room_id` | TEXT | 外部キー → rooms.id |
| `nickname` | TEXT | ニックネーム（room_id + nickname でユニーク制約） |
| `participant_token` | TEXT | 参加者識別トークン（UUID）。クライアントに保存 |
| `joined_at` | TEXT (ISO8601) | 参加日時 |

**複合ユニーク制約:** `(room_id, nickname)`

### lottery_results テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| `id` | TEXT (UUID) | 結果ID（主キー） |
| `room_id` | TEXT | 外部キー → rooms.id（ユニーク: ルームにつき1件） |
| `results` | TEXT (JSON) | 抽選結果（後述） |
| `drawn_at` | TEXT (ISO8601) | 抽選実行日時 |

**results JSONスキーマ（順位あり＋役割あり例）:**
```json
[
  { "rank": 1, "participant_id": "xxx", "nickname": "たろう", "role": "司会" },
  { "rank": 2, "participant_id": "yyy", "nickname": "はなこ", "role": "幹事" }
]
```

---

## API一覧（Cloudflare Workers / Hono）

ベースURL: `https://api.<your-domain>.workers.dev`

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| `POST` | `/rooms` | なし | ルーム作成。レスポンスに `host_token` を含む |
| `GET` | `/rooms/join/:joinCode` | なし | join_code からルーム情報を取得（ステータス確認用） |
| `POST` | `/rooms/:roomId/join` | なし | ニックネームを送信して参加。重複時は 409 を返す |
| `GET` | `/rooms/:roomId/participants` | なし | 参加者一覧取得（ポーリング用） |
| `PATCH` | `/rooms/:roomId/settings` | host_token ヘッダー | 抽選設定・結果公開設定を更新 |
| `POST` | `/rooms/:roomId/close` | host_token ヘッダー | 参加締め切り（status → closed） |
| `POST` | `/rooms/:roomId/draw` | host_token ヘッダー | 抽選実行。結果をDBに保存し返却。status → drawn |
| `GET` | `/rooms/:roomId/result` | なし | 結果取得。show_result_to_participants = 0 の場合は 403 |

### 主催者認証方式
- `X-Host-Token: <host_token>` ヘッダーで認証
- トークンはルーム作成時に発行し、クライアントの `localStorage` に保存
- JWTは使用しない（単純UUIDトークン照合のみ）

### レスポンス共通エラーコード
| コード | 意味 |
|--------|------|
| 400 | リクエスト不正（バリデーション失敗） |
| 403 | 主催者トークン不一致 / 結果非公開 |
| 404 | ルーム・参加者が存在しない |
| 409 | ニックネーム重複 |
| 422 | 抽選実行不可（未締め切り など） |

---

## 非機能

### コスト上限
- **目標: $0/月**（無料枠内で完結）
- Cloudflare Pages: 無料（ビルド 500回/月、リクエスト無制限）
- Cloudflare Workers: 無料枠 10万リクエスト/日
- Cloudflare D1: 無料枠 500MB / 読み取り 2500万行/日
- 想定スループット: パーティー1回あたり数十リクエスト → 無料枠に収まる

### ログ方針
- Cloudflare Workers の組み込みログ（`console.log`）のみ使用
- エラー発生時のリクエストパス・ステータスコードをログ出力
- 個人情報（ニックネームなど）はログに含めない
- 外部ログサービス（Datadog等）は使用しない

### 監視最低限
- Cloudflare Dashboard の「Workers Analytics」でエラー率を目視確認
- アラート設定なし（個人利用規模のため）
- SLAなし

### データ保持方針
- ルームデータは作成から **72時間後に削除**（D1 の定期バッチまたはWorkers Cron Triggers）
- 削除はソフトデリートではなく物理削除
- バックアップなし（一時利用データのため）
- 個人情報に該当するデータはニックネームのみ（本名・連絡先は収集しない）

---

## セキュリティ最低限

- **秘密情報は環境変数管理**
  - `HOST_TOKEN` の照合ロジックはWorkers内にのみ存在
  - D1バインディング名など設定値は `wrangler.toml` の `[vars]` に定義
  - API Keyなど外部サービス連携はないため、`.dev.vars` は最小限

- **権限境界を明確にする**
  - 主催者操作（締め切り・抽選・設定変更）は `X-Host-Token` ヘッダー必須
  - 参加者操作（参加・結果閲覧）はトークン不要だが、ルームIDと参加者トークンで自己確認
  - 他の参加者の詳細情報（トークン等）は一切返却しない

- **外部公開範囲を最小化**
  - 参加者一覧API（`GET /rooms/:roomId/participants`）は全体公開だが、返却するのは `nickname` と `joined_at` のみ
  - `host_token` と `participant_token` はレスポンスに含まない（作成・参加時の初回のみ返却）
  - CORS: `Access-Control-Allow-Origin` は Pagesのデプロイ先ドメインのみ許可

- **入力バリデーション**
  - ニックネーム: 1〜20文字、空白のみ不可
  - 当選人数: 1 以上、参加者数以下
  - 役割配列: 最大20件

---

## Repository Interface（B->C 移行対応）

将来のスタック変更に備え、データアクセスはインターフェース経由で抽象化する。

```typescript
// 現在の実装: ApiRoomRepository（Workers + D1）
interface RoomRepository {
  createRoom(settings: LotterySettings): Promise<Room>;
  getRoomByJoinCode(joinCode: string): Promise<Room | null>;
  closeRoom(roomId: string, hostToken: string): Promise<void>;
  updateSettings(roomId: string, hostToken: string, settings: Partial<LotterySettings>): Promise<void>;
}

interface ParticipantRepository {
  join(roomId: string, nickname: string): Promise<Participant>;
  listByRoom(roomId: string): Promise<Participant[]>;
}

interface LotteryRepository {
  draw(roomId: string, hostToken: string): Promise<LotteryResult>;
  getResult(roomId: string): Promise<LotteryResult | null>;
}
```
