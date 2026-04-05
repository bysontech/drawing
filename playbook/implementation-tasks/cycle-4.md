project: party-lottery
cycle: 4
owner: claude-code
priority: Must first

## 0. Branch
- branch: `feature/cycle-4-premium-draw-animation`

---

## 1. 詳細設計の固定化（演出state machine / レイヤー分離）
### Goal
豪華演出で最も壊れやすい「演出進行」と「結果データ」の責務を先に分離する。

### Create / Update
- [ ] `docs/notes/cycle-4-animation-decisions.md` または既存メモ置き場
  - 以下を明文化
    - 演出フェーズ一覧
    - ranked=true / false の進行差分
    - role の二段表示ルール
    - 主催者向け演出と参加者向け演出の差分
    - リロード時の即表示ルール
    - reduced motion / skip の扱い
- [ ] 表示/演出用型定義（例: `src/types/drawAnimation.ts`）
  - `DrawPhase`
  - `DrawSequenceStep`
  - `AnimationPreferences`
  - `AnimatedResultViewItem`
- [ ] 演出シーケンス生成ユーティリティ（例: `src/utils/buildDrawSequence.ts`）
  - resultViewModel から演出ステップ配列を作る
- [ ] 既存の結果ViewModelとの接続整理
  - API結果 → ViewModel → AnimationSequence → UI

### Acceptance
- データと演出進行が分離されている
- UIコンポーネントに巨大な条件分岐が集中しない

---

## 2. 共通: アニメーション基盤の作成
### Goal
主催者/参加者画面で使い回せる演出コンポーネント群を作る。

### Create / Update
- [ ] `src/components/draw/DrawStage.tsx`
  - 全体のステージレイアウト
  - レイヤーの重ね合わせ管理
- [ ] `src/components/draw/BackgroundFxLayer.tsx`
  - グラデーション
  - パルス
  - 光の移動
- [ ] `src/components/draw/ShuffleReel.tsx`
  - スロット風またはルーレット風の候補表示
  - 高速切替アニメーション
- [ ] `src/components/draw/RevealCard.tsx`
  - 名前 / 順位 / 役割の確定表示
- [ ] `src/components/draw/CelebrationFx.tsx`
  - 紙吹雪
  - フラッシュ
  - グロー
- [ ] `src/components/draw/DrawOverlayControls.tsx`
  - スキップ
  - 再演出
  - reduced motion 時の表示制御

### Acceptance
- レイヤーごとに責務分離された演出コンポーネントが揃う
- 主催者/参加者で再利用しやすい

---

## 3. 依存追加とフォールバック設計
### Update
- [ ] `package.json`
  - 必要なら `framer-motion`
  - 必要なら軽量 confetti ライブラリ
- [ ] reduced motion 対応
  - `prefers-reduced-motion` を検知
  - 演出時間短縮 or 一部エフェクト停止
- [ ] フォールバック方針
  - 依存失敗や端末負荷時でも最低限結果表示は成立させる

### Acceptance
- 豪華演出を追加しても通常結果表示が壊れない
- reduced motion 時に過剰演出を避けられる

---

## 4. 主催者画面: 豪華抽選演出の実装
### Update
- [ ] `src/pages/HostDrawPage.tsx`
  - 既存の draw 実行フローを維持
  - draw成功後に AnimationSequence を生成
  - intro → shuffle → reveal → celebration を進行
  - ranked=true のとき順位ごとに順次演出
  - ranked=false のときまとめ演出または簡略進行
  - draw済み再訪時は即結果表示をデフォルト
  - 任意で「再演出」ボタン
- [ ] 画面レイアウト
  - 会場向けに中央大表示
  - 背景演出を含めた見た目調整
- [ ] 操作導線
  - 演出中のスキップ
  - 完了後の結果一覧確認

### Acceptance
- 主催者画面でかなり豪華な抽選演出が成立する
- 再訪時に結果閲覧も問題ない

---

## 5. 役割の二段演出
### Goal
「名前が出る → 少し遅れて役割が出る」ことで見せ場を強くする。

### Create / Update
- [ ] `src/components/draw/RevealCard.tsx`
  - 名前表示アニメーション
  - role がある場合の遅延表示
  - ranked=true なら順位を強調
- [ ] 演出ステップ生成
  - `reveal_name`
  - `reveal_role`
  - `celebration`
  の順になるよう制御

### Acceptance
- role あり結果が一段深い見せ方になる
- role なしでも表示崩れしない

---

## 6. 参加者画面: 簡易豪華演出 + 自己強調
### Update
- [ ] `src/pages/ParticipantWaitingPage.tsx`
  - public結果取得後、簡易版アニメーションを再生
  - 自分が当選している場合は特別な強調表示
  - 非当選でも結果一覧または終了演出を表示
  - private時は結果本文を出さず、終了メッセージのみ
- [ ] `src/components/draw/ParticipantResultHighlight.tsx`（任意）
  - 自己結果の拡大
  - 発光
  - バッジ表示

### Acceptance
- 参加者も体験として置いていかれない
- 当選者本人は一目で分かる

---

## 7. シーケンス制御とタイマー管理
### Goal
豪華演出を実現しつつ、メモリリークや多重タイマーを避ける。

### Create / Update
- [ ] `src/hooks/useDrawAnimationController.ts`
  - 現在フェーズ
  - 現在表示中winner index
  - skip
  - replay
  - cleanup
- [ ] タイマー/アニメーション管理
  - unmount 時 cleanup
  - re-render で多重起動しないよう制御
- [ ] 必要なら `useReducer` 採用

### Acceptance
- 演出が途中で壊れにくい
- 画面離脱や再描画で不安定にならない

---

## 8. 結果再訪・再演出・スキップ導線
### Update
- [ ] `src/pages/HostDrawPage.tsx`
  - draw済みルーム再訪時は即結果表示
  - 「演出をもう一度見る」導線を任意追加
- [ ] `src/components/draw/DrawOverlayControls.tsx`
  - スキップボタン
  - 再演出ボタン
- [ ] 参加者画面
  - 初回表示のみ演出
  - 再訪時は即結果でも可

### Acceptance
- 初回の見せ場と再訪時の実用性を両立できる

---

## 9. 文言・テーマ・見た目の仕上げ
### Update
- [ ] 見出し文言
  - カウントダウン
  - 抽選中
  - 結果発表
- [ ] 背景/カード/グローのトーン調整
  - お祝い感はあるが読みにくくしない
- [ ] ranked / unranked / role / no-role の表示一貫性確認

### Acceptance
- 豪華でも読みづらくない
- 表示パターンごとの差が整理されている

---

## 10. Final check
- [ ] `npm run build` OK
- [ ] 主催者豪華演出が動く
- [ ] ranked on/off 両方で成立する
- [ ] role 二段演出が動く
- [ ] 参加者画面でも簡易豪華演出が動く
- [ ] 当選者自己強調が分かる
- [ ] skip / reduced motion / 再訪時即表示が成立する
- [ ] cycle 1〜3 の基本導線を壊していない
