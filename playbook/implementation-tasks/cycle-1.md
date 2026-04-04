project: party-lottery
cycle: 1
owner: claude-code
priority: Must first

## 0. Branch
- branch: `feature/cycle-1-room-join-participants`

---

## 1. 詳細設計の固定化（先に崩れない土台を作る）
### Goal
実装前に、責務分離・型・エラー方針を軽く固定し、後続の抽選機能追加で壊れにくい土台にする。

### Create / Update
- [ ] `docs/notes/cycle-1-decisions.md` または既存メモ置き場
  - 以下を明文化
    - 画面ルート
    - API最小セット
    - `RoomStatus` / `LotterySettings` の暫定型
    - nicknameバリデーション
    - APIエラーとUIメッセージの対応表
- [ ] フロント側の型定義ファイル（例: `src/types/room.ts`）
  - `Room`
  - `Participant`
  - `CreateRoomResponse`
  - `JoinRoomResponse`
- [ ] APIクライアント境界（例: `src/lib/api/client.ts`）
  - fetchラッパ
  - JSON parse
  - エラー整形

### Acceptance
- 画面/API/型/エラー対応が実装前に1箇所で参照できる
- UIが直接 `fetch` を乱発しない

---

## 2. D1 スキーマと Workers 側の最小データ層
### Goal
ルーム作成・参加・一覧取得に必要なDB構造を最小で確定する。

### Create / Update
- [ ] D1 migration ファイル
  - `rooms`
    - `id`
    - `join_code` unique
    - `host_token`
    - `status`
    - `lottery_settings`
    - `show_result_to_participants`
    - `created_at`
  - `participants`
    - `id`
    - `room_id`
    - `nickname`
    - `participant_token`
    - `joined_at`
  - 複合ユニーク制約 `(room_id, nickname)`
- [ ] Workers 側 repository / query 層
  - `createRoom`
  - `getRoomByJoinCode`
  - `joinParticipant`
  - `listParticipantsByRoom`
  - `getRoomById`
- [ ] 乱数/ID生成ユーティリティ
  - UUID
  - 6文字 joinCode

### Acceptance
- migration が適用できる
- nickname重複をDB制約で防げる
- joinCode がユニーク前提で扱える

---

## 3. Workers API: ルーム作成
### Update
- [ ] Workers エントリ（例: `workers/src/index.ts`）
- [ ] `POST /rooms`
  - 初期 status は `waiting`
  - 初期 `lottery_settings` は空またはデフォルト
  - `show_result_to_participants` は 0 で作成
  - `host_token` を返す
  - `joinCode` を返す
- [ ] レスポンス整形
  - フロントでそのまま使えるJSONにする

### Acceptance
- ルーム作成APIが成功し、主催者に必要な識別子が返る

---

## 4. Workers API: joinCode参照・参加登録
### Update
- [ ] `GET /rooms/join/:joinCode`
  - ルーム存在確認
  - `status` を返す
  - 必要最小限の公開情報のみ返す
- [ ] `POST /rooms/:roomId/join`
  - nickname trim
  - 空白のみ不可
  - 1〜20文字チェック
  - room.status が `closed` または `drawn` なら参加拒否
  - nickname重複時は 409
  - 成功時 `participant_token` を返す
- [ ] エラーコード
  - 400: バリデーション失敗
  - 404: room not found
  - 409: nickname重複 or 受付終了（どちらかに寄せるならレスポンス本文で判別可能にする）

### Acceptance
- 参加画面が joinCode で事前チェックできる
- 重複nicknameをAPIが正しく拒否する

---

## 5. Workers API: 参加者一覧取得
### Update
- [ ] `GET /rooms/:roomId/participants`
  - `nickname`
  - `joined_at`
  - 必要なら `count`
- [ ] 並び順は `joined_at ASC`
- [ ] token類は返さない

### Acceptance
- 主催者画面で参加者一覧を安全に描画できる
- レスポンスに秘密情報が含まれない

---

## 6. フロント: ルーターと画面骨組み
### Create / Update
- [ ] `src/App.tsx` または router 設定
  - `/`
  - `/join/:joinCode`
  - `/room/:roomId/participant`
- [ ] 共通レイアウト最小整備
  - ローディング
  - エラー表示
  - API base URL設定

### Acceptance
- 必要3画面へ遷移できる

---

## 7. フロント: 主催者画面（ルーム作成 + 一覧）
### Update
- [ ] `src/pages/HostRoomPage.tsx` または `/` 対応画面
  - ルーム作成ボタン
  - 作成後に参加用URL表示
  - `hostToken` を `localStorage` 保存
  - `roomId` / `joinCode` も必要に応じて保存
  - 参加者一覧表示
  - 参加人数表示
  - 3秒ポーリング
  - 参加締め切りボタンは disabled / skeleton でも可
- [ ] コピーしやすいUI
  - ボタンまたは選択しやすい表示

### Acceptance
- ルーム作成から一覧監視まで1画面で動く
- リロードしても主催者情報がある程度保持される

---

## 8. フロント: 参加者画面（join）
### Update
- [ ] `src/pages/JoinPage.tsx`
  - `joinCode` からルーム確認
  - nickname入力
  - バリデーション表示
  - submit中状態
  - 409時インラインエラー表示
  - 受付終了時は入力UIを出さず終了表示
- [ ] `participantToken` を保存
- [ ] 成功時 `/room/:roomId/participant` に遷移

### Acceptance
- join画面単体で参加可否が分かる
- エラー理由がユーザーに分かる

---

## 9. フロント: 参加者待機画面
### Update
- [ ] `src/pages/ParticipantWaitingPage.tsx`
  - 参加完了表示
  - 自分のnickname表示
  - 「主催者がくじ引きを開始するまでお待ちください」
  - 将来の結果監視を見越した最小ポーリング骨組みは任意

### Acceptance
- 参加完了後の着地点がある
- join直後に行き止まりにならない

---

## 10. 締め切りの骨組み（余力）
### Update
- [ ] `POST /rooms/:roomId/close`
  - `X-Host-Token` 検証
  - `waiting -> closed`
- [ ] 主催者画面ボタン接続
  - 参加者1名以上で活性でも可
  - まだ抽選画面に進めなくてもよい

### Acceptance
- 実装できた場合のみ、closedルームへのjoinが拒否される
- 未着手でも cycle 1 の Must は満たせる

---

## 11. Final check
- [ ] `npm run build` OK
- [ ] ルーム作成できる
- [ ] joinCodeで参加画面に入れる
- [ ] nickname登録できる
- [ ] 重複nicknameが弾かれる
- [ ] 主催者画面に参加者一覧が反映される
- [ ] 3秒ポーリングが動作する
- [ ] tokenや不要情報を一覧APIで返していない
- [ ] 抽選関連の未実装コードが今回スコープを壊していない
