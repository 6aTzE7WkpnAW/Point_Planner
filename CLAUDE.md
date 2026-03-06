# Point_Planner — Claude Code ガイド

## プロジェクト概要

ポイント（1pt = 1円）を活用しながら同じ商品を複数回に分けて購入するとき、**現金支払い総額を最小化**する購入計画を求めるツール。

- **Python実装** (`point_planner.py`): 正解基準となる参照実装
- **TypeScript実装** (`web/lib/solver.ts`): Webアプリ用のプロダクション実装
- 両実装は同一アルゴリズムであり、**出力が一致することが正しさの基準**

---

## 開発コマンド

```bash
# Webアプリ起動
cd web && npm run dev        # http://localhost:3000

# Lintチェック
cd web && npm run lint

# Python参照実装の実行
python point_planner.py 12 --unit 1800 --tax 10 --rate 20 --min 10000

# ビルド確認
cd web && npm run build
```

---

## プロジェクト構造

```
Point_Planner/
├── point_planner.py              # Python参照実装（正解基準）
├── CLAUDE.md                     # このファイル
├── AGENTS.md                     # 開発規約
├── README.md                     # ユーザー向けドキュメント（日本語）
├── .claude/settings.local.json   # ClaudeCode権限設定
└── web/
    ├── app/
    │   ├── page.tsx              # メインUI（タブ切り替え・URL共有）
    │   ├── layout.tsx
    │   └── api/solve/route.ts   # POST /api/solve エンドポイント
    ├── components/
    │   ├── InputForm.tsx         # 「追加購入」タブのフォーム
    │   ├── TotalForm.tsx         # 「合計枚数から計算」タブのフォーム
    │   ├── Summary.tsx           # 結果サマリーカード
    │   └── ResultTable.tsx       # 注文明細テーブル
    ├── lib/
    │   └── solver.ts             # DPアルゴリズム本体（最重要ファイル）
    └── types/
        └── index.ts              # 型定義・デフォルトパラメータ
```

---

## ビジネスルール（仕様）

### ポイント付与計算

```
税抜価格 = floor(税込価格 / (1 + 税率))
獲得ポイント = floor(現金支払額 × 付与率 / (1 + 税率))
```

- **切り捨て（floor）** で計算する（四捨五入ではない）
- ポイントは**同一注文内では使えない**（次回以降の注文で使用）
- ポイント付与の対象は注文合計金額が `minEligibleTotal` 以上の注文のみ

### デフォルトパラメータ（`web/types/index.ts`）

| パラメータ | デフォルト値 |
|---|---|
| 税込単価 | 1,800円 |
| 消費税率 | 10% |
| ポイント付与率 | 20% |
| ポイント付与下限 | 10,000円 |
| 下限判定基準 | `order_total`（注文合計で判定） |
| 税抜計算方式 | `taxex_floor_then_rate` |
| 最適化目的 | `min_cash_then_min_orders` |

### 現在の制約（APIバリデーション）

- `eligibleBasis` は現状 `"order_total"` のみ受け付ける（`"cash_paid"` は未実装）
- `taxExMethod` は現状 `"taxex_floor_then_rate"` のみ
- N上限: 500

---

## アルゴリズム詳細

### 状態空間

**状態** = `(購入済み個数, ポイント残高)` の2次元

DPは注文ごとに層を進む前向き探索。

### パレートフロンティア枝刈り

同じ `購入済み個数` において、ある状態Aが別の状態Bに対して:
- `pointsBalance(A) >= pointsBalance(B)` かつ `cashPaid(A) <= cashPaid(B)`

を満たすとき、Bは支配されているとして破棄。状態数を大幅に削減。

### 適応的量子化（N > 70 のとき）

```
Q = ceil(N² × P / 550,000)   // P = unitPriceTaxIn
```

ポイント残高を Q 単位に**切り捨て**で丸めることで状態数を圧縮する。

- 現金支払い誤差は ±Q 円以内に収まることが保証される
- 量子化でポイント残高が実際より少なく見えるため、負のポイント残高が発生しないよう注意が必要（`max(0, quantized)` で保護）

### タイムアウト保護

- 8秒を超えた場合は計算を打ち切り
- Web APIは503を返す
- `SolveResult.meta.exact = false` のとき近似解

### 注文統合（後処理）

連続する「ポイント未使用 かつ 付与対象」の注文を1注文にまとめて出力を簡潔化する。

### 性能目安

| N | Q | 推定時間 | 精度 |
|---|---|---|---|
| ≤70 | 1（精密） | ~7秒以内 | 最適解 |
| 100 | 33 | ~5秒 | ±33円以内 |
| 200 | 131 | ~6秒 | ±131円以内 |
| 500 | 819 | ~6秒 | ±819円以内 |

---

## 型定義（`web/types/index.ts`）

```typescript
interface Params {
  unitPriceTaxIn: number;       // 税込単価（円）
  taxRate: number;              // 税率（例: 0.10）
  pointRate: number;            // ポイント付与率（例: 0.20）
  minEligibleTotal: number;     // 付与下限金額（円）
  eligibleBasis: "order_total" | "cash_paid";
  taxExMethod: "ratio_floor" | "taxex_floor_then_rate";
  objective: "min_cash_then_min_leftover" | "min_cash_then_min_orders";
}

interface SolveRequest {
  n: number;           // 購入個数
  params: Params;
  startPoints?: number; // 追加購入時の初期所持ポイント
}
```

---

## コーディング規約

### TypeScript（`web/`）

- `snake_case` → **禁止**。`camelCase` を使用
- 型は `web/types/index.ts` に集約する
- `floor()` による切り捨ては意図的。`round()` に変えない

### Python（`point_planner.py`）

- インデント: 4スペース
- 命名: `snake_case`（関数/変数）、`PascalCase`（クラス）、`UPPER_SNAKE_CASE`（定数）

### 共通

- アルゴリズムを変更したときは必ず **Python版とTypeScript版の出力が一致するか**を確認する
- 量子化ロジック (`Q` の計算・適用箇所) を変更するときは±Q円の誤差保証が壊れないか確認する

---

## テスト方針

現時点でテストスイートは存在しない。追加する場合:

- **Python**: `pytest`、`tests/test_*.py` に配置
- **TypeScript**: `vitest`（未設定）
- 最優先テストケース: N=1, 2, 3（境界値）、N=70（量子化境界）、N=100（量子化あり）
- Python版とTypeScript版の同一入力に対する出力一致確認が最も価値が高い

---

## コミット規約

英語または日本語、どちらでも可。

```
# 推奨フォーマット
Fix negative point balance in quantization edge case
量子化境界でのポイント残高マイナスを修正
Add vitest setup for solver unit tests
```

---

## よくある落とし穴

1. **`round()` を使わない**: ポイント付与は常に `Math.floor()` / `floor()`
2. **量子化後のゼロ未満チェック**: 量子化でポイント残高が負になるケースを `max(0, ...)` で防ぐ
3. **`startPoints` の扱い**: 追加購入モードでは初期ポイント残高を `Math.floor(startPoints)` で渡す
4. **`eligibleBasis`**: APIは現状 `"order_total"` のみ対応（`"cash_paid"` はバリデーションで弾かれる）
5. **チャートコンポーネントは削除済み**: `web/components/charts/` は現在未使用・削除済み
