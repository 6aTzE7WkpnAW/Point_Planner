import { NextRequest, NextResponse } from "next/server";
import { solve } from "@/lib/solver";
import type { Coupon, Params, SolveRequest } from "@/types";

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

  const { n, params, startPoints } = body as Partial<SolveRequest>;

  if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
    return NextResponse.json({ error: "n は1以上の整数で指定してください。" }, { status: 400 });
  }
  if (n > 500) {
    return NextResponse.json({ error: "n が大きすぎます。上限は 500 です。" }, { status: 400 });
  }
  if (!validateParams(params)) {
    return NextResponse.json({ error: "params の形式が不正です。" }, { status: 400 });
  }

  const normalizedStartPoints =
    typeof startPoints === "number" && Number.isFinite(startPoints) && startPoints >= 0
      ? Math.floor(startPoints)
      : 0;

  const result = solve(n, params, normalizedStartPoints);
  if (result === null) {
    return NextResponse.json(
      { error: "計算がタイムアウトしました。クーポン条件を整理するか、入力値を小さくして再度お試しください。" },
      { status: 503 }
    );
  }

  return NextResponse.json(result);
}
