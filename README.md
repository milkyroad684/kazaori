# カゼオリ (Kazaori)

離散格子の風パズル。ファンを配置し、距離減衰する風のベクトル和で葉を渦穴へ導く。

**▶ 遊ぶ**: <!-- GitHub Pages URL を有効化後にここへ貼る -->

## ルール概要

- ファンは向いた方向の直線上に **強さ 3 / 2 / 1** の風を出す。
- 風は盤外・壁・任意のファンで遮断される（W2）。
- 各セルの風は全ファンの **ベクトル和**（W4）。
- 葉は毎ターン、自セルの風の主軸方向へ 1 マス。同じ強さの直交合成では止まる（M1 干渉ロック）。
- 渦穴に入れば成功、茨に触れたら失敗。

詳細は [SPEC.md](./SPEC.md) を参照。

## レベル

| ID | 名前 | コンセプト |
|----|------|-----------|
| 1 | 追い風 | 入門 — 1 ファンで直接押す |
| 2 | 曲がり角 | 壁を使った 90° の継ぎ手 |
| 3 | 向かい風 | 固定ファンとの合成 (W4) |
| 4 | 風の継ぎ手 | 複数ファンの連携と射程制限 |
| 5 | 雁行 | 2 枚の葉と逐次処理 (M3) |
| 6 | 逆風の門 | 5 ファンの本格パズル |

## 開発

```bash
npm install
npm run dev        # ローカルで開発サーバー (http://localhost:5173)
npm run build      # 本番ビルドを dist/ に出力
npm test           # 受け入れテスト AT-1〜AT-10 を実行
```

### アーキテクチャ

- `src/engine.ts` — 純粋関数のゲームロジック（`simulate` / `step` / `computeField` / `validatePlacement`）
- `src/types.ts` — 共有型
- `levels/levels.json` — レベル定義
- `web/` — Vite + Canvas のシンプル UI
- `test/engine.test.ts` — SPEC §4 の受け入れテスト
- `.github/workflows/deploy.yml` — GitHub Pages 自動デプロイ

ロジックは engine.ts に一本化し、レンダラや CLI からは呼び出すだけ（重複実装禁止）。

## ライセンス

[MIT](./LICENSE)
