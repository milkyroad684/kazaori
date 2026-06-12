# カゼオリ マイルストーン 1 + 2 実装計画

## 目的
SPEC.md §4 の受け入れテスト AT-1〜AT-10 をトレース単位で完全一致させ green にする。

## チェックリスト

- [x] SPEC.md AT-10 のターン数表記を修正（ターン 7 → ターン 8。M1 ルール整合）
- [x] tasks/todo.md（本ファイル）作成
- [x] package.json / tsconfig.json / vitest.config.ts 作成
- [x] levels/levels.json 作成（SPEC §3 をそのまま）
- [x] src/types.ts — 型定義（Dir / Vec / Fan / Level / SimResult）
- [x] src/engine.ts — 純粋ロジック
  - [x] computeField(level, placedFans): Map<key, Vec> — W1〜W4
  - [x] validatePlacement(level, placedFans) — P1〜P3
  - [x] step(level, placedFans, leaves) — T1 1ターン処理
  - [x] simulate(level, placedFans, maxTurns=40) — T2〜T5 終了判定
- [x] test/engine.test.ts — AT-1〜AT-10 を逐次トレース比較
- [x] npm install
- [x] npm test で全 green を確認（10/10 passed, 6ms）

## 設計メモ
- engine は純粋関数のみ。副作用なし。
- 葉処理順は M3 によりレベル定義配列順（決定論）。
- trace 形式: `Array<Array<{x,y} | null>>`（捕獲後は null）。
- maxTurns 経過 → outcome 'timeout'。

## レビュー（マイルストーン 1 + 2 完了）

### 実装したもの
- **src/engine.ts**：副作用なしの純粋関数 3 つ + 検証関数 1 つ
  - `computeField` … 全ファン（固定＋配置）の向き直線で d=1,2,3 にベクトル加算、盤外・壁・任意ファンで遮断（W1〜W4）
  - `validatePlacement` … 占有セル集合と budget をチェック（P1〜P2）
  - `step` … 1 ターン進める（テストから個別検証もできる公開関数）
  - `simulate` … `{outcome, turns, trace}` を返す。配列順での葉処理（M3）と即時失敗（T3）、捕獲後勝利（T2）、無移動 stall（T4）、40 ターン timeout（T5）
- **test/engine.test.ts**：AT-1〜AT-10 を全ターンのトレース付きで完全一致比較
- **levels/levels.json**：SPEC §3 のレベル定義を JSON 化

### 主な決定
1. AT-10 のターン数（spec の「ターン 7」）は M1（一ターン1セル）と矛盾するため、ユーザー合意のもと SPEC.md を「ターン 8」に修正。
2. trace 形式は `Array<Array<{x,y} | null>>`。捕獲（gone）は `null`、それ以外（移動・茨で死亡・stall）は座標。
3. step は internal 関数を別に持ち、シミュレーション内では葉オブジェクトを破壊的に更新、公開 step ラッパーはコピーを返すことで純粋性を維持。

### 検証結果
`npm test` で 10/10 passed（6ms）。すべての受け入れテストが SPEC のトレースと完全一致。

### 次に向けて（マイルストーン 3 以降）
- マイルストーン 3: `src/cli.ts`（`sim` サブコマンド）
- マイルストーン 4（任意）: `web/` canvas レンダラ、`solve` サブコマンド
- DoD §6.2 のプロパティテスト 3 件以上（風が固定ファンを越えない、穴が複数枚吸う、配置数 ≤ budget の上限境界、など）
