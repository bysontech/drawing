project: party-lottery
cycle: 1
goal: ルーム作成から参加登録・参加者一覧確認までを縦に通し、抽選前の土台を壊れにくく作る

## Scope（Must）
1. ルーム作成の最小導線
- 主催者がルームを作成できる
- 作成時に `roomId` / `joinCode` / `hostToken` を受け取り、主催者端末に保持できる
- 参加用URLを表示できる
- QRコード表示はこのサイクルでは任意とし、URL共有を先に通す

2. 参加登録の最小導線
- 参加者が `joinCode` 経由で参加画面に到達できる
- ニックネーム入力・送信ができる
- 同一ルーム内でニックネーム重複を防げる
- 締め切り前のルームにのみ参加できる

3. 主催者の参加者確認
- 主催者が参加者一覧を確認できる
- 一覧は 3 秒ポーリングで更新される
- 参加人数が分かる
- 締め切りボタンの存在まで実装するが、抽選実行はまだ入れない

4. 詳細設計の最適化を含む基盤整備
- APIクライアント層とRepository境界を最初から分ける
- 画面遷移に必要な最小ルーティングを確定する
- D1スキーマとユニーク制約を先に固める
- エラーコードとUIメッセージの対応を先に決める

## Scope（Should）
- 参加者登録後に待機画面へ遷移する
- 主催者画面にルーム状態（waiting / closed）を表示する
- 参加締め切りAPIとUIの骨組みまで用意する
- 受付終了時の画面分岐を入れる

## Out of Scope
- 抽選アニメーション
- 抽選実行ロジック
- 順位付き表示
- 役割割り当て
- 参加者への結果共有
- Durable Objects / WebSocket
- 高度なUI演出
- 認証強化（JWT等）
- 72時間後削除のCron実装
- テスト/CIの本格導入

## Detailed Design Notes
1. ルーティング最小セット
- `/` : 主催者ルーム作成・参加者一覧確認
- `/join/:joinCode` : 参加者ニックネーム入力
- `/room/:roomId/participant` : 参加完了後の待機画面
- `/room/:roomId/draw` はルートだけ作ってもよいが、未実装扱いでよい

2. API最小セット
- `POST /rooms`
- `GET /rooms/join/:joinCode`
- `POST /rooms/:roomId/join`
- `GET /rooms/:roomId/participants`
- `POST /rooms/:roomId/close` は余力があれば先行で追加可

3. 状態設計
- `rooms.status` は `waiting` / `closed` / `drawn`
- cycle 1 では基本的に `waiting` を扱う
- `closed` は join 拒否条件としてだけ先に考慮する

4. バリデーション設計
- nickname: trim後 1〜20文字、空白のみ不可
- joinCode: 6文字英数字想定
- 重複判定はDBユニーク制約 `(room_id, nickname)` を真実の源とする
- APIは 409 を返し、UIは「そのニックネームはすでに使われています」を表示

5. トークン設計
- `hostToken` は `localStorage` に保存
- `participantToken` も返却・保存する
- ただし cycle 1 では participantToken の用途は待機画面の自己識別用の下地まで

6. 実装方針
- まずは「ルーム作成 → 参加 → 一覧反映」を確実に通す
- 抽選関連の型は仮置き可だが、画面やAPIは作り込みすぎない
- 既存設計に沿って Workers + D1 + React の責務を分離する

## Definition of Done
- 主催者がルームを作成できる
- 主催者画面に参加用URLが表示される
- 参加者が `joinCode` から参加画面に入れる
- ニックネーム登録が成功すると待機画面へ進める
- 同一ルーム内の重複ニックネームが 409 + UIメッセージで弾かれる
- 主催者画面で参加者一覧と参加人数が見える
- 一覧がポーリングで更新される
- 少なくとも `build` が成功する
- 抽選機能を未実装のまま混ぜて壊していない
