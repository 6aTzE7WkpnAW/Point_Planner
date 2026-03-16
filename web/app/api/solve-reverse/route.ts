import { NextRequest, NextResponse } from "next/server";
import { solve } from "@/lib/solver";
import type { Coupon, Params, SolveReverseRequest } from "@/types";

function isValidCoupon(coupon: unknown): coupon is Coupon {
  if (typeof coupon !== "object" || coupon === null) {
    return false;
  }
  const value = coupon as Record<string, unknown>;
  return (
    typeof value.minTotal === "number" &&
    value.minTotal >= 0 &&
    typeof value.discount === "number" &&
    value.discount >= 0 &&
    typeof value.count === "number" &&
    value.count >= 0
  );
}

function validateParams(params: unknown): params is Params {
  if (typeof params !== "object" || params === null) return false;
  const p = params as Record<string, unknown>;
  if (typeof p.unitPriceTaxIn !== "number" || p.unitPriceTaxIn < 0) return false;
  if (typeof p.taxRate !== "number" || p.taxRate < 0 || p.taxRate > 1) return false;
  if (typeof p.pointRate !== "number" || p.pointRate < 0 || p.pointRate > 1) return false;
  if (typeof p.minEligibleTotal !== "number" || p.minEligibleTotal < 0) return false;
  if (p.eligibleBasis !== "order_total") return false;
  if (p.taxExMethod !== "taxex_floor_then_rate") return false;
  if (!["min_cash_then_min_leftover", "min_cash_then_min_orders"].includes(p.objective as string)) return false;
  if (p.coupons !== undefined) {
    if (!Array.isArray(p.coupons)) return false;
    if (!(p.coupons as unknown[]).every(isValidCoupon)) return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON を読み取れませんでした。" }, { status: 400 });
  }

  const { budget, params, startPoints } = body as Partial<SolveReverseRequest>;

  if (typeof budget !== "number" || !Number.isFinite(budget) || budget < 1) {
    return NextResponse.json({ error: "予算は1以上で指定してください。" }, { status: 400 });
  }
  if (!validateParams(params)) {
    return NextResponse.json({ error: "params の形式が不正です。" }, { status: 400 });
  }

  const normalizedStartPoints =
    typeof startPoints === "number" && Number.isFinite(startPoints) && startPoints >= 0
      ? Math.floor(startPoints)
      : 0;

  const coupons = params.coupons ?? [];
  const maxCouponSaving = coupons.reduce((sum, coupon) => sum + coupon.discount * coupon.count, 0);
  const taxExclusiveRatio = 1 / (1 + params.taxRate);
  const minEffectivePrice = params.unitPriceTaxIn * Math.max(0.01, 1 - params.pointRate * taxExclusiveRatio);
  const maxPossibleN = Math.min(
    500,
    Math.ceil((budget + normalizedStartPoints + maxCouponSaving) / Math.max(1, minEffectivePrice)) + 5
  );

  const oneItemResult = solve(1, params, normalizedStartPoints);
  if (oneItemResult === null) {
    return NextResponse.json({ error: "計算に失敗しました。" }, { status: 503 });
  }
  if (oneItemResult.summary.cashTotal > budget) {
    return NextResponse.json({ error: "この予算では1枚も購入できません。" }, { status: 400 });
  }

  let lo = 1;
  let hi = maxPossibleN;
  let bestN = 1;
  let bestResult = oneItemResult;

  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const result = solve(mid, params, normalizedStartPoints);
    if (result === null) {
      hi = mid - 1;
      continue;
    }
    if (result.summary.cashTotal <= budget) {
      lo = mid;
      bestN = mid;
      bestResult = result;
    } else {
      hi = mid - 1;
    }
  }

  if (lo > bestN) {
    const result = solve(lo, params, normalizedStartPoints);
    if (result !== null && result.summary.cashTotal <= budget) {
      bestN = lo;
      bestResult = result;
    }
  }

  return NextResponse.json({ ...bestResult, n: bestN });
}
