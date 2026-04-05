project: party-lottery
cycle: 3
owner: claude-code
priority: Must first

## 0. Branch
- branch: `feature/cycle-3-roles-result-ux`

---

## 1. 詳細設計の固定化（役割割り当て・表示分岐）
### Goal
cycle 3 で増える表示分岐を先に整理し、UI側の条件分岐地獄を防ぐ。

### Create / Update
- [ ] `docs/notes/cycle-3-decisions.md` または既存メモ置き場
  - 以下を明文化
    - roles 入力仕様（trim / 空文字除外 / 最大件数）
    - role 割り当てルール
    - ranked on/off の結果表示差分
    - public/private の結果表示差分
    - participant の自己強調ルール
    - 演出中と演出後の表示ルール
- [ ] 表示用型定義（例: `src/types/resultView.ts`）
  - `ResultViewItem`
  - `ResultPresentationMode`
- [ ] 結果整形ユーティリティ（例: `src/utils/resultViewModel.ts`）
  - API results -> UI表示モデル

### Acceptance
- 主催者/参加者の結果表示ロジックを共通化できる
- 分岐条件がドキュメントとコードで一致している

---

## 2. Workers / Domain: 役割割り当ての完成
### Goal
抽選結果に role を安定して反映できるようにする。

### Create / Update
- [ ] 抽選ユーティリティ（例: `workers/src/domain/drawLottery.ts`）
  - roles を settings から受け取る
  - trim済み role 配列で処理
  - winner ごとに順次 role を付与
- [ ] settings parse / validate
  - roles 最大20件
  - 空要素除外
- [ ] 必要なら保存直前に results JSON を正規化

### Acceptance
- role が結果JSONに正しく入る
- role 数不足/超過でも破綻しない

---

## 3. Workers API: 設定更新の仕上げ
### Update
- [ ] `PATCH /rooms/:roomId/settings`
  - roles 入力の保存を正式対応
  - 空入力時は `[]`
  - カンマ区切りをフロントから配列または文字列で受けるなら形式を統一
- [ ] `GET /rooms/join/:joinCode` または必要な room 取得API
  - 参加者側UIに必要な status / showResultToParticipants を返す範囲を見直す
- [ ] エラーメッセージを UI が使いやすい形に統一

### Acceptance
- 主催者設定で role を扱える
- フロントが room 状態を無理なく表示できる

---

## 4. フロント: 主催者設定UIの完成
### Update
- [ ] `src/pages/HostRoomPage.tsx`
  - roles 入力欄（カンマ区切り）
  - ranked / winner_count / show_result_to_participants と並べて整理
  - 現在保存されている設定値の再表示
  - `waiting / closed / drawn` の状態表示
- [ ] バリデーション表示
  - winner_count 不正
  - roles 多すぎ
  - 保存失敗
- [ ] 余力があれば QRコード表示
  - 参加用URLから生成

### Acceptance
- 主催者が役割含む設定を迷わず編集できる
- 保存済み設定が画面に残る

---

## 5. フロント: 主催者結果画面の見やすさ改善
### Update
- [ ] `src/pages/HostDrawPage.tsx`
  - 結果カード/行のUI整理
  - ranked=true のとき順位順で表示
  - ranked=false のとき順位非表示
  - role がある場合は併記
  - 抽選済みなら開始ボタンを無効化または非表示
  - 既存結果取得時にも同じ表示を使う
- [ ] `src/utils/resultViewModel.ts`
  - 表示用ラベル生成
  - 順位文言や role 表示整形

### Acceptance
- 主催者結果が見やすい
- draw済みルームで操作が誤解を生まない

---

## 6. フロント: 参加者結果表示と自己強調
### Update
- [ ] `src/pages/ParticipantWaitingPage.tsx`
  - 自分の `participantToken` または nickname と result を照合
  - 当選時は強調表示
  - 非当選でも結果一覧または必要文言を表示
  - private 時は結果本文を出さない
- [ ] 表示分岐
  - waiting: 待機文言
  - closed: 締切済み・まもなく抽選
  - drawn + public: 結果表示
  - drawn + private: 非公開メッセージ

### Acceptance
- 参加者が自分の結果をすぐ認識できる
- private設定で情報漏れしない

---

## 7. フロント: 簡易抽選演出の実装
### Goal
「開始した感」を出しつつ、壊れにくい最小演出に留める。

### Create / Update
- [ ] `src/components/DrawReveal.tsx` など任意
  - ranked=true: 一定間隔で1件ずつ表示
  - ranked=false: 短いローディング後に一括表示
- [ ] `src/pages/HostDrawPage.tsx`
  - draw直後のみ演出を再生
  - 既存結果表示時は演出をスキップ
- [ ] 必要なら参加者画面側も簡易演出対応（任意）

### Acceptance
- 抽選開始時に短い演出がある
- 再読込時に無駄な再演出で混乱しない

---

## 8. 共通: localStorage / 状態復元の整理
### Update
- [ ] localStorage helpers
  - `hostToken`
  - `participantToken`
  - `nickname`
  - `lastRoomId`
- [ ] 画面再訪時の復元
  - 主催者: 直前ルームをある程度復元
  - 参加者: 待機画面で自分情報を復元
- [ ] token欠損時の案内表示

### Acceptance
- リロードや再訪時に行き止まりになりにくい
- 自己強調に必要な情報が維持される

---

## 9. 文言・状態表示の磨き込み
### Update
- [ ] 状態バッジ/メッセージの統一
  - `waiting`: 参加受付中
  - `closed`: 受付終了 / 抽選待ち
  - `drawn`: 抽選完了
- [ ] エラーメッセージの統一
  - 受付終了
  - 設定保存失敗
  - 抽選済みで再実行不可
- [ ] 参加者向け説明文の調整
  - 結果公開ON/OFFに応じた文言

### Acceptance
- 画面ごとに似た状態が別表現になっていない

---

## 10. Final check
- [ ] `npm run build` OK
- [ ] roles を保存できる
- [ ] role が結果へ反映される
- [ ] ranked on/off 両方で表示崩れしない
- [ ] participant 自己強調が動く
- [ ] private時に結果が見えない
- [ ] draw済み状態の再訪で結果表示が安定
- [ ] 簡易演出が動く
- [ ] cycle 1 / cycle 2 の導線が壊れていない
