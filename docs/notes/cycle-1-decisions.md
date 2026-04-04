project: party-lottery
cycle: 1
updated: 2026-04-04

# Cycle 1 設計決定事項

## 画面ルート

| パス | 役割 |
|------|------|
| `/` | 主催者: ルーム作成 + 参加者一覧確認 |
| `/join/:joinCode` | 参加者: ニックネーム入力 |
| `/room/:roomId/participant` | 参加者: 参加完了後の待機画面 |
| `/room/:roomId/draw` | 主催者: 抽選画面（cycle 2 以降、ルートのみ用意） |

## API 最小セット

| メソッド | パス | 認証 | 概要 |
|---------|------|------|------|
| POST | `/rooms` | なし | ルーム作成 |
| GET | `/rooms/join/:joinCode` | なし | joinCode でルーム確認 |
| POST | `/rooms/:roomId/join` | なし | 参加者登録 |
| GET | `/rooms/:roomId/participants` | なし | 参加者一覧（ポーリング用） |
| POST | `/rooms/:roomId/close` | X-Host-Token | 参加締め切り |

## 型定義（暫定）

```typescript
type RoomStatus = 'waiting' | 'closed' | 'drawn';

interface LotterySettings {
  ranked: boolean;
  winner_count: number;
  roles: string[];
}

interface Room {
  id: string;
  join_code: string;
  status: RoomStatus;
  created_at: string;
}

interface CreateRoomResponse {
  roomId: string;
  joinCode: string;
  hostToken: string;
}

interface Participant {
  id: string;
  nickname: string;
  joined_at: string;
}

interface JoinRoomResponse {
  participantId: string;
  participantToken: string;
  roomId: string;
}
```

## nickname バリデーション

- trim 後 1〜20 文字
- 空白のみ不可
- 重複判定は DB ユニーク制約 `(room_id, nickname)` を真実の源とする

## API エラー ↔ UI メッセージ対応表

| HTTP コード | エラーコード | UI 表示メッセージ |
|------------|-------------|-----------------|
| 400 | VALIDATION_ERROR | 入力内容を確認してください |
| 404 | ROOM_NOT_FOUND | ルームが見つかりません |
| 409 | NICKNAME_TAKEN | そのニックネームはすでに使われています |
| 409 | ROOM_CLOSED | このルームの受付は終了しています |
| 403 | FORBIDDEN | 操作権限がありません |
| 500 | SERVER_ERROR | サーバーエラーが発生しました。しばらく後でお試しください |

## トークン管理

| トークン | 保存場所 | 用途 |
|---------|---------|------|
| `hostToken` | localStorage | 主催者操作の認証（X-Host-Token ヘッダー） |
| `participantToken` | localStorage | 参加者の自己識別（cycle 1 では待機画面の表示用途のみ） |

## ポーリング設計

- 主催者画面: 3 秒間隔で `GET /rooms/:roomId/participants` を呼ぶ
- 参加者待機画面: 将来のルームステータス監視用の骨組みのみ（cycle 1 では実際のポーリングは任意）

## CORS 設定

- 開発時: `http://localhost:5173` を許可
- 本番: Cloudflare Pages デプロイ先ドメインのみ許可（wrangler.toml の vars で設定）
