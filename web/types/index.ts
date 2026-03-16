export interface Coupon {
  minTotal: number;
  discount: number;
  count: number;
}

export interface Params {
  unitPriceTaxIn: number;
  taxRate: number;
  pointRate: number;
  minEligibleTotal: number;
  eligibleBasis: "order_total" | "cash_paid";
  taxExMethod: "ratio_floor" | "taxex_floor_then_rate";
  objective: "min_cash_then_min_leftover" | "min_cash_then_min_orders";
  coupons?: Coupon[];
}

export interface OrderRow {
  index: number;
  qty: number;
  orderTotal: number;
  couponDiscount: number;
  couponApplied: string | null;
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
  couponDiscountTotal: number;
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

export interface SolveReverseRequest {
  budget: number;
  params: Params;
  startPoints?: number;
}

export interface SolveReverseResult extends SolveResult {
  n: number;
}

export const DEFAULT_PARAMS: Params = {
  unitPriceTaxIn: 1800,
  taxRate: 0.1,
  pointRate: 0.2,
  minEligibleTotal: 10000,
  eligibleBasis: "order_total",
  taxExMethod: "taxex_floor_then_rate",
  objective: "min_cash_then_min_leftover",
  coupons: [],
};
