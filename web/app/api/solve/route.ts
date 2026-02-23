import { NextRequest, NextResponse } from "next/server";
import { solve } from "@/lib/solver";
import type { Params, SolveRequest } from "@/types";

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
  return true;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの本文が不正なJSONです" }, { status: 400 });
  }

  const { n, params, startPoints } = (body as Partial<SolveRequest>);

  if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
    return NextResponse.json({ error: "n は1以上の整数を入力してください" }, { status: 400 });
  }
  if (n > 500) {
    return NextResponse.json({ error: "n が大きすぎます（上限: 500）" }, { status: 400 });
  }
  if (!validateParams(params)) {
    return NextResponse.json(
      { error: "params が不正です（適用条件は注文金額基準、税抜後に付与計算）" },
      { status: 400 }
    );
  }

  const sp =
    typeof startPoints === "number" && Number.isFinite(startPoints) && startPoints >= 0
      ? Math.floor(startPoints)
      : 0;
  const result = solve(n, params, sp);
  if (result === null) {
    return NextResponse.json(
      { error: "計算に失敗しました。条件を見直してください。" },
      { status: 503 }
    );
  }

  return NextResponse.json(result);
}
