project: party-lottery
cycle: 3
updated: 2026-04-05

# Cycle 3 設計決定事項

## 役割割り当て仕様

- フロントの入力: カンマ区切りテキスト → 配列として送信
- 保存前に: `trim()` → 空文字除外 → 最大20件にスライス
- 抽選時: `winners[i].role = roles[i] ?? null`
- roles が winner_count より少ない → 余りは `null`
- roles が winner_count より多い → 超過分は無視
- `ranked = false` でも role は付与可能

## 結果表示ViewModel

```typescript
interface ResultViewItem {
  participantId: string;
  nickname: string;
  rank: number | null;      // ranked=false のとき null
  role: string | null;      // roles未設定のとき null
  isMe: boolean;            // participantToken または nickname で照合
  isWinner: boolean;        // 常に true（winners のみ渡す）
}

type ResultPresentationMode =
  | 'ranked'          // 順位あり
  | 'flat';           // 順位なし
```

## 結果整形ルール

| 条件 | 表示 |
|------|------|
| ranked=true | 1位〜N位の順に表示 |
| ranked=false | 順位表示なし、番号のみ |
| role あり | 名前の横に役割バッジ |
| role なし | バッジ非表示 |
| isMe=true | 背景ハイライト |

## 演出方針

- `ranked=true`: 1件ずつ revealInterval ms 間隔で順次表示（デフォルト700ms）
- `ranked=false`: ローディング1.2秒後に一括表示
- 演出は「初回draw直後のみ」フラグで制御
- 再読込 / 既存結果取得時は演出スキップ → 即全件表示

## 参加者表示4状態

| 状態 | 表示 |
|------|------|
| waiting | 「参加受付中」スピナー |
| closed | 「受付終了 / 抽選待ち」スピナー |
| drawn + public | 全結果 + 自分ハイライト |
| drawn + private | 「結果は主催者にお聞きください」のみ |

## 主催者状態バッジ文言統一

| status | バッジ文言 |
|--------|-----------|
| waiting | 参加受付中 |
| closed | 受付終了・抽選待ち |
| drawn | 抽選完了 |

## エラーメッセージ統一

| コード | UI文言 |
|--------|-------|
| NICKNAME_TAKEN | そのニックネームはすでに使われています |
| ROOM_CLOSED | このルームの受付は終了しています |
| ALREADY_DRAWN | 抽選は既に完了しています |
| DRAW_NOT_ALLOWED | 参加を締め切ってから抽選してください |
| FORBIDDEN | 操作権限がありません |
| VALIDATION_ERROR | 入力内容を確認してください |
| SERVER_ERROR | サーバーエラーが発生しました |
