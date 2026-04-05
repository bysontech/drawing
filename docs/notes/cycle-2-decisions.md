project: party-lottery
cycle: 2
updated: 2026-04-05

# Cycle 2 設計決定事項

## 状態遷移

```
waiting  →  closed  →  drawn
```

| 遷移 | トリガー | API |
|------|---------|-----|
| waiting → closed | 主催者が締め切りボタン押下 | POST /rooms/:roomId/close |
| closed → drawn | 主催者が抽選実行 | POST /rooms/:roomId/draw |

### ガード条件

| 状態 | 参加(join) | 締め切り(close) | 抽選(draw) |
|------|-----------|----------------|-----------|
| waiting | ✅ 可 | ✅ 可（1名以上） | ❌ 不可 |
| closed | ❌ 不可 (409 ROOM_CLOSED) | ❌ 不可 (400) | ✅ 可 |
| drawn | ❌ 不可 (409 ROOM_CLOSED) | ❌ 不可 (400) | ❌ 不可 (409 ALREADY_DRAWN) |

## draw API 事前条件

1. X-Host-Token が rooms.host_token と一致すること
2. rooms.status === 'closed'
3. lottery_results に同一 room_id のレコードがないこと（二重防止）

## 抽選アルゴリズム

```
1. room_id に紐づく participants を全取得（joined_at ASC）
2. Fisher-Yates シャッフル
3. 先頭から winner_count 件を winners とする
4. ranked = true のとき、rank: 1..n を付与
5. ranked = false のとき、rank: null
6. roles[i] を winners[i] に割り当て。roles が足りなければ null、余れば無視
```

## results JSON スキーマ

```json
[
  { "rank": 1, "participant_id": "uuid", "nickname": "たろう", "role": "司会" },
  { "rank": 2, "participant_id": "uuid", "nickname": "はなこ", "role": null }
]
```

- `rank` は `ranked = false` のとき `null`
- `role` は roles 未設定または不足のとき `null`

## 主催者結果取得 vs 参加者結果取得

| 取得方法 | 条件 |
|---------|-----|
| X-Host-Token ヘッダー付き GET /result | 常に取得可 |
| トークンなし GET /result | show_result_to_participants = 1 のときのみ |
| drawn 前 | 404 を返す |

## 設定保存方針

- `PATCH /rooms/:roomId/settings` で `lottery_settings` と `show_result_to_participants` を更新
- バリデーション
  - `winner_count >= 1`
  - `winner_count <= 参加者数`（締め切り前は緩め、締め切り後は厳密）
  - `roles` 最大20件
- 抽選前であれば何度でも更新可能

## エラーコード方針

| コード | HTTP | 意味 |
|--------|------|------|
| VALIDATION_ERROR | 400 | 形式不正・バリデーション失敗 |
| FORBIDDEN | 403 | hostToken不一致 |
| ROOM_NOT_FOUND | 404 | ルームが存在しない |
| RESULT_NOT_FOUND | 404 | 抽選結果がまだない |
| RESULT_PRIVATE | 403 | 結果非公開 |
| NICKNAME_TAKEN | 409 | ニックネーム重複 |
| ROOM_CLOSED | 409 | 受付終了済み |
| ALREADY_DRAWN | 409 | 抽選済み |
| DRAW_NOT_ALLOWED | 422 | 未締め切りでの抽選試行 |
