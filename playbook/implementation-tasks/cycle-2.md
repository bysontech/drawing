project: party-lottery
cycle: 2
owner: claude-code
priority: Must first

## 0. Branch
- branch: `feature/cycle-2-close-draw-results`

---

## 1. 詳細設計の固定化（抽選ロジック・状態遷移）
### Goal
cycle 2 で最も壊れやすい「抽選条件」「状態遷移」「結果形式」を先に固定する。

### Create / Update
- [ ] `docs/notes/cycle-2-decisions.md` または既存メモ置き場
  - 以下を明文化
    - `waiting -> closed -> drawn` の状態遷移
    - draw API の事前条件
    - 抽選アルゴリズム
    - results JSON の形
    - 主催者結果取得と参加者結果取得の違い
    - エラーコード方針（403 / 409 / 422 の使い分け）
- [ ] 型定義ファイル（例: `src/types/lottery.ts`）
  - `LotterySettings`
  - `LotteryResultItem`
  - `LotteryResult`
  - `RoomStatus`
- [ ] Workers 側の型/スキーマ補助
  - settings parse / validate
  - result serialize / parse

### Acceptance
- 抽選ロジックと状態遷移が人・AIどちらでも迷わず読める
- 後続実装が場当たり的な if 分岐にならない

---

## 2. D1: lottery_results と設定保存の整備
### Goal
抽選結果を1ルーム1件で保存できる形を確定する。

### Create / Update
- [ ] D1 migration ファイル
  - `lottery_results`
    - `id`
    - `room_id` unique
    - `results`
    - `drawn_at`
- [ ] `rooms` の settings 利用確認
  - `lottery_settings`
  - `show_result_to_participants`
- [ ] repository / query 層
  - `updateRoomSettings`
  - `closeRoom`
  - `saveLotteryResult`
  - `getLotteryResultByRoom`
  - `assertHostToken` 相当の共通化

### Acceptance
- 抽選結果を room 単位で一意に保存できる
- 設定更新と結果保存の責務が分離されている

---

## 3. Workers API: 設定更新
### Update
- [ ] `PATCH /rooms/:roomId/settings`
  - `X-Host-Token` 必須
  - 更新対象
    - `ranked`
    - `winner_count`
    - `roles`
    - `show_result_to_participants`
  - バリデーション
    - `winner_count >= 1`
    - `winner_count <= current participant count`
    - `roles` 最大20件
- [ ] エラーハンドリング
  - 400: 形式不正
  - 403: hostToken不一致
  - 422: 参加者数に対して winner_count が不正

### Acceptance
- 主催者が抽選前に必要設定を保存できる

---

## 4. Workers API: 参加締め切り
### Update
- [ ] `POST /rooms/:roomId/close`
  - `X-Host-Token` 必須
  - `waiting` のときのみ `closed` に変更
  - 参加者0名なら拒否するかどうかを決めて統一
    - 推奨: 1名以上必須
- [ ] `POST /rooms/:roomId/join`
  - `waiting` 以外では join 不可に統一
  - 締め切り済みは本文で判別できるエラーを返す

### Acceptance
- 締め切り操作後に参加登録できない
- UIに締め切り状態が反映される

---

## 5. Workers API: 抽選実行
### Update
- [ ] `POST /rooms/:roomId/draw`
  - `X-Host-Token` 必須
  - ルーム状態が `closed` であること
  - 既存結果がなければ抽選し保存
  - 保存後 `rooms.status = drawn`
  - 結果を返す
- [ ] 抽選ユーティリティ（例: `workers/src/domain/drawLottery.ts`）
  - 参加者シャッフル
  - winners抽出
  - rank付与
  - role付与
- [ ] 二重実行防止
  - `room.status`
  - `lottery_results.room_id unique`
  - どちらか片方ではなく両方で守る

### Acceptance
- 締め切り後にのみ抽選できる
- 同一ルームで抽選が2回走らない

---

## 6. Workers API: 結果取得
### Update
- [ ] `GET /rooms/:roomId/result`
  - 主催者利用時は `X-Host-Token` が一致すれば常に取得可
  - 参加者利用時は `show_result_to_participants = 1` のときのみ取得可
  - `drawn` 前は未取得扱い
- [ ] 必要に応じてレスポンスに以下を含める
  - `status`
  - `showResultToParticipants`
  - `results`

### Acceptance
- 主催者は必ず結果を見られる
- 参加者は公開設定に従ってのみ結果を見られる

---

## 7. フロント: 主催者画面に設定と締め切り導線を追加
### Update
- [ ] `src/pages/HostRoomPage.tsx` または主催者トップ画面
  - 抽選設定フォーム
    - ranked toggle
    - winner_count input
    - show_result_to_participants toggle
    - roles input は余力で可（カンマ区切り）
  - 設定保存アクション
  - 参加締め切りボタン
  - `status` バッジ表示
  - 締め切り後に draw画面への導線表示
- [ ] エラー表示
  - winner_count不正
  - hostTokenなし
  - 保存失敗

### Acceptance
- 主催者が抽選前に必要設定を完了できる
- `closed` への遷移が画面上で分かる

---

## 8. フロント: 主催者くじ引き画面
### Create / Update
- [ ] `src/pages/HostDrawPage.tsx` または `/room/:roomId/draw`
  - hostToken がない場合は入れない、または案内表示
  - 開始ボタン
  - 実行中ローディング / 簡易アニメーション
  - 結果表示
    - ranked=true: 順位つき
    - ranked=false: フラット表示
    - roleがあれば併記
- [ ] 必要に応じて初回表示時に result を取得
  - 既にdrawnなら再実行せず既存結果を表示

### Acceptance
- 抽選を主催者が完了できる
- 再読み込みしても結果表示が壊れない

---

## 9. フロント: 参加者待機画面の結果反映
### Update
- [ ] `src/pages/ParticipantWaitingPage.tsx`
  - 3秒ポーリングで room/result 状態を監視
  - `drawn` かつ公開ONなら結果表示
  - `drawn` かつ公開OFFなら「結果は主催者にお聞きください」
  - `participantToken` または nickname を使って自分をハイライト（任意だが推奨）
- [ ] 表示分岐を整理
  - waiting
  - closed
  - drawn + public
  - drawn + private

### Acceptance
- 参加者画面が抽選後の状態変化を追える
- 公開設定に応じて表示が切り替わる

---

## 10. フロント/共通: APIクライアント整理
### Update
- [ ] `src/lib/api/client.ts`
  - `updateRoomSettings`
  - `closeRoom`
  - `drawLottery`
  - `getRoomResult`
- [ ] エラー種別の吸収
  - UIごとに生のHTTP分岐を書き散らさない
- [ ] localStorage helpers
  - hostToken
  - participantToken
  - roomId / nickname（必要最小限）

### Acceptance
- cycle 2 追加APIをUIが一貫した方法で呼べる

---

## 11. Final check
- [ ] `npm run build` OK
- [ ] 設定保存できる
- [ ] 締め切りできる
- [ ] 締め切り後joinできない
- [ ] 抽選開始できる
- [ ] 抽選結果が保存・表示される
- [ ] 主催者は必ず結果を見られる
- [ ] 参加者は公開ON時のみ結果を見られる
- [ ] 同じルームで2回drawできない
- [ ] cycle 1 の「作成 → 参加 → 一覧」が壊れていない
