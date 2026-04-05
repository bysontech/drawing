project: party-lottery
cycle: 4
updated: 2026-04-05

# Cycle 4 アニメーション設計決定事項

## 演出フェーズ定義

```
DrawPhase =
  'idle'          // 待機（抽選ボタン表示）
  'intro'         // カウントダウン演出 (800ms)
  'shuffle'       // スロット高速回転 (2000ms ranked / 1500ms flat)
  'reveal_name'   // 名前確定表示 (600ms)
  'reveal_role'   // 役割遅延表示 (800ms delay + 500ms)
  'celebration'   // 祝福演出 (1500ms)
  'next'          // 次の当選者へ (300ms pause)
  'completed'     // 全演出完了
```

## ranked=true の進行

```
intro → [winner 1..N]:
  shuffle(2000) → reveal_name(600) → reveal_role(800+500) → celebration(1500) → next(300)
→ completed
```

## ranked=false の進行

```
intro → shuffle(1500) → reveal_name(all staggered, 150ms apart) → celebration(1000) → completed
```

## role 二段演出ルール

- `reveal_name` で名前・順位を先に表示
- role がある場合のみ `reveal_role` フェーズを追加
- role 表示は `reveal_name` 完了 800ms 後にフェードイン
- role がない場合は `reveal_name` → `celebration` に短縮

## 主催者演出 vs 参加者演出

| 要素 | 主催者 (HostDrawPage) | 参加者 (ParticipantWaitingPage) |
|------|-----------------------|--------------------------------|
| DrawStage | フルサイズ暗背景 | カード内コンパクト |
| BackgroundFxLayer | パルス+光 ON | パルスのみ ON |
| ShuffleReel | 大きなフォント | 中程度フォント |
| CelebrationFx | 全面紙吹雪+グロー | 自分当選時のみ |
| RevealCard | 中央大表示 | カード内表示 |
| 演出時間 | フル (1件最大5秒) | 短縮 (まとめ1.5秒) |

## リロード時のルール

- `drawn` 状態で訪問 → `animate=false` → 即全件表示
- 初回draw直後 → `animate=true` → フル演出
- 「再演出」ボタンで `animate=true` に切り替え可能

## reduced motion / skip ルール

- `prefers-reduced-motion: reduce` → シャッフル省略、フェードのみ
- スキップボタン押下 → 現在フェーズを `completed` に飛ばす
- どちらの場合も最終結果は完全に表示する

## タイマー管理

- `useRef` でタイマーIDを保持し `useEffect` cleanup で clearTimeout
- フェーズ遷移は全て `useReducer` で管理
- unmount 時に必ず全タイマーをクリア
- 演出 1 件あたりの上限: 10秒（超過時は自動スキップ）

## コンポーネント責務

```
DrawStage         — レイアウト・レイヤー重ね合わせ
BackgroundFxLayer — 背景グラデーション・パルス
ShuffleReel       — スロット高速回転
RevealCard        — 名前/順位/役割 確定表示
CelebrationFx     — 紙吹雪・グロー・フラッシュ
DrawOverlayControls — スキップ・再演出・completed後操作
```
