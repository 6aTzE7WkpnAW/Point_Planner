export interface Params {
  unitPriceTaxIn: number;       // 1枚の税込価格（円）
  taxRate: number;              // 税率（例: 0.10）
  pointRate: number;            // ポイント付与率（例: 0.20）
  minEligibleTotal: number;     // ポイント付与の下限金額（円）
  eligibleBasis: "order_total" | "cash_paid"; // 下限金額の判定基準
  taxExMethod: "ratio_floor" | "taxex_floor_then_rate"; // 税抜計算と丸め
  objective: "min_cash_then_min_leftover" | "min_cash_then_min_orders"; // 最適化目的
}

export interface OrderRow {
  index: number;
  qty: number;
  orderTotal: number;
  pointsUsed: number;
  cashPaid: number;
  pointsEarned: number;
  pointsBalance: number;
  eligible: boolean;
}

export interface Summary {
  orderCount: number;
  cashTotal: number;
  leftoverPoints: number;
  grossTotal: number;
}

export interface SolveResult {
  summary: Summary;
  orders: OrderRow[];
  meta: {
    exact: boolean;
    timeMs: number;
  };
}

export interface SolveRequest {
  n: number;
  params: Params;
  startPoints?: number;
}

export const DEFAULT_PARAMS: Params = {
  unitPriceTaxIn: 1800,
  taxRate: 0.10,
  pointRate: 0.20,
  minEligibleTotal: 10000,
  eligibleBasis: "order_total",
  taxExMethod: "taxex_floor_then_rate",
  objective: "min_cash_then_min_orders",
};
