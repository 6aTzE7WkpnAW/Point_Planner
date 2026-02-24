/**
 * solver.ts
 *
 * ポイント分割購入の最適化ソルバー（TypeScript実装）。
 *
 * アルゴリズム:
 *   レイヤー別 DP（層ごとに前進探索）+ Pareto frontier 枝刈り
 *   ヒープを使わず、i=0,1,...,n の順に確定的に処理する。
 */

import type { Params, OrderRow, SolveResult } from "@/types";

// ---------------------------------------------------------------------------
// 探索チューニング定数
// ---------------------------------------------------------------------------
const Q_TAIL_WINDOW = 12;
const Q_SMALL_MAX = 12;
const Q_THRESHOLD_NEAR = 4;

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function gcd(a: number, b: number): number {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * ポイント付与比率を既約分数 (num/den) で返す。
 * earned = floor(cashPaid * num / den)  (ratio_floor モード)
 */
function ratioNumDen(pointRate: number, taxRate: number): [number, number] {
  const scale = 1_000_000;
  const num = Math.round(pointRate * scale);
  const den = scale + Math.round(taxRate * scale);
  const g = gcd(num, den);
  return [num / g, den / g];
}

// ---------------------------------------------------------------------------
// 1注文の計算
// ---------------------------------------------------------------------------
function isEligible(
  orderTotal: number,
  cashPaid: number,
  minEligibleTotal: number,
  eligibleBasis: string
): boolean {
  return eligibleBasis === "order_total"
    ? orderTotal >= minEligibleTotal
    : cashPaid >= minEligibleTotal;
}

function calcPointsEarned(
  cashPaid: number,
  orderTotal: number,
  params: Params,
  num: number,
  den: number
): number {
  if (!isEligible(orderTotal, cashPaid, params.minEligibleTotal, params.eligibleBasis)) {
    return 0;
  }
  if (params.taxExMethod === "ratio_floor") {
    return Math.floor((cashPaid * num) / den);
  }
  const taxEx = Math.floor(cashPaid / (1 + params.taxRate));
  return Math.floor(taxEx * params.pointRate);
}

/**
 * 注文後のポイント残高（candidateCashValues 内で使用）
 */
function endPoints(
  p0: number,
  cashPaid: number,
  orderTotal: number,
  params: Params,
  num: number,
  den: number
): number {
  const used = orderTotal - cashPaid;
  return p0 - used + calcPointsEarned(cashPaid, orderTotal, params, num, den);
}

// ---------------------------------------------------------------------------
// Pareto frontier  (pts 昇順、costs 厳密増加)
// ---------------------------------------------------------------------------
class Frontier {
  pts: number[] = [];
  costs: number[] = [];

  dominated(p: number, cost: number): boolean {
    const idx = lowerBound(this.pts, p);
    return idx < this.pts.length && this.costs[idx] <= cost;
  }

  insert(p: number, cost: number): boolean {
    const idx = lowerBound(this.pts, p);
    if (idx < this.pts.length && this.pts[idx] === p) {
      if (this.costs[idx] <= cost) return false;
      this.costs[idx] = cost;
    } else {
      if (idx < this.pts.length && this.costs[idx] <= cost) return false;
      this.pts.splice(idx, 0, p);
      this.costs.splice(idx, 0, cost);
    }
    let i = idx;
    while (i > 0 && this.costs[i - 1] >= this.costs[i]) {
      this.pts.splice(i - 1, 1);
      this.costs.splice(i - 1, 1);
      i--;
    }
    return true;
  }

  items(): Array<[number, number]> {
    return this.pts.map((p, i) => [p, this.costs[i]]);
  }

  get size(): number {
    return this.pts.length;
  }
}

function lowerBound(arr: number[], target: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ---------------------------------------------------------------------------
// 探索候補の生成
// ---------------------------------------------------------------------------
function qCandidates(remItems: number, params: Params): number[] {
  const P = params.unitPriceTaxIn;
  const qThr = Math.ceil(params.minEligibleTotal / P);
  const seen = new Uint8Array(remItems + 1);
  const result: number[] = [];

  function add(q: number) {
    if (q >= 1 && q <= remItems && !seen[q]) {
      seen[q] = 1;
      result.push(q);
    }
  }

  for (let q = 1; q <= Math.min(remItems, Q_SMALL_MAX); q++) add(q);
  for (let dq = -Q_THRESHOLD_NEAR; dq <= Q_THRESHOLD_NEAR; dq++) add(qThr + dq);
  for (let k = 0; k <= Math.min(Q_TAIL_WINDOW, remItems - 1); k++) add(remItems - k);
  add(remItems);

  return result.sort((a, b) => a - b);
}

/**
 * 支払現金の候補を絞り込む。
 * ratio_floor モードでは解析的推定で境界点を高速計算する。
 */
function candidateCashValues(
  pAvail: number,
  orderTotal: number,
  remainingTotal: number,
  params: Params,
  num: number,
  den: number
): number[] {
  const cashMin = Math.max(0, orderTotal - Math.min(pAvail, orderTotal));
  const cashMax = orderTotal;

  // 最大 8 個の候補を収集する
  const buf: number[] = [cashMin];
  if (cashMax !== cashMin) buf.push(cashMax);

  const addU = (v: number) => {
    if (v < cashMin || v > cashMax) return;
    for (let k = 0; k < buf.length; k++) if (buf[k] === v) return;
    buf.push(v);
  };

  for (const target of [remainingTotal, Math.max(0, remainingTotal - params.unitPriceTaxIn)]) {
    const epMin = endPoints(pAvail, cashMin, orderTotal, params, num, den);
    if (epMin >= target) {
      addU(cashMin + 1);
      continue;
    }
    const epMax = endPoints(pAvail, cashMax, orderTotal, params, num, den);
    if (epMax < target) continue;

    let lo: number;
    if (params.taxExMethod === "ratio_floor") {
      // 解析的推定: cash ≈ T * den / (den + num)
      const T = target - pAvail + orderTotal;
      lo = Math.max(cashMin, Math.min(cashMax, Math.ceil(T * den / (den + num))));
      // 左側に戻りながら下限を確定（最大 den ステップ）
      while (lo > cashMin && endPoints(pAvail, lo - 1, orderTotal, params, num, den) >= target) lo--;
      // 右側に進んで条件を満たす位置まで（最大 den ステップ）
      while (endPoints(pAvail, lo, orderTotal, params, num, den) < target && lo < cashMax) lo++;
    } else {
      // taxex_floor_then_rate: 二分探索
      let hi = cashMax;
      lo = cashMin;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (endPoints(pAvail, mid, orderTotal, params, num, den) >= target) hi = mid;
        else lo = mid + 1;
      }
    }
    addU(lo - 1);
    addU(lo);
    addU(lo + 1);
  }

  return buf.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// 親情報
// ---------------------------------------------------------------------------
type ParentInfo = {
  pi: number;       // 親の i（購入済み枚数）
  pp: number;       // 親の p（ポイント残高、キャップ済み）
  qty: number;
  cashPaid: number;
  pointsUsed: number;
  orderTotal: number;
};

// ---------------------------------------------------------------------------
// 連続ポイント未使用注文の統合（後処理）
// ---------------------------------------------------------------------------

/**
 * 連続する「ポイント未使用 かつ 付与対象」の注文をまとめて1注文に統合する。
 *
 * eligible=false の注文は除外する。統合すると注文合計が付与閾値を超えてポイントが
 * 新たに発生し、DP が想定していた残高と乖離するため。
 *
 * eligible=true の連続注文を統合しても floor の超加法性から獲得ポイントは
 * 統合前の合計以上になるため、キャッシュ支払い総額は不変かつポイント残高は改善。
 */
function consolidateOrders(
  orders: OrderRow[],
  params: Params,
  num: number,
  den: number,
  startPoints: number
): OrderRow[] {
  if (orders.length <= 1) return orders;

  // Step 1: 統合後の (qty, cashPaid, pointsUsed) リストを構築
  type Step = { qty: number; cashPaid: number; pointsUsed: number };
  const steps: Step[] = [];
  let i = 0;

  while (i < orders.length) {
    if (orders[i].pointsUsed === 0 && orders[i].eligible) {
      // 連続する eligible かつ pointsUsed=0 の注文を収集
      let j = i + 1;
      while (j < orders.length && orders[j].pointsUsed === 0 && orders[j].eligible) j++;

      if (j > i + 1) {
        const run = orders.slice(i, j);
        steps.push({
          qty: run.reduce((s, o) => s + o.qty, 0),
          cashPaid: run.reduce((s, o) => s + o.cashPaid, 0),
          pointsUsed: 0,
        });
        i = j;
        continue;
      }
    }
    steps.push({ qty: orders[i].qty, cashPaid: orders[i].cashPaid, pointsUsed: orders[i].pointsUsed });
    i++;
  }

  if (steps.length === orders.length) return orders; // 統合なし

  // Step 2: 再シミュレーションで各注文のポイント残高を再計算
  let pBal = startPoints;
  return steps.map((step, idx) => {
    const { qty, cashPaid, pointsUsed } = step;
    const orderTotal = cashPaid + pointsUsed;
    const eligible = isEligible(orderTotal, cashPaid, params.minEligibleTotal, params.eligibleBasis);
    const earned = calcPointsEarned(cashPaid, orderTotal, params, num, den);
    pBal = pBal - pointsUsed + earned;
    return {
      index: idx + 1,
      qty,
      orderTotal,
      pointsUsed,
      cashPaid,
      pointsEarned: earned,
      pointsBalance: pBal,
      eligible,
    };
  });
}

// ---------------------------------------------------------------------------
// メインソルバー（レイヤー別 DP）
// ---------------------------------------------------------------------------
export function solve(n: number, params: Params, startPoints = 0): SolveResult | null {
  const startMs = Date.now();
  const [num, den] = ratioNumDen(params.pointRate, params.taxRate);
  const P = params.unitPriceTaxIn;
  const startP = Math.min(Math.max(0, Math.floor(startPoints)), n * P);

  // 数値キーエンコード: key = p (各 layer で独立管理)
  // layer[i] : p → { cost, parent }
  type LayerEntry = { cost: number; parent: ParentInfo | null };
  const layers: Map<number, LayerEntry>[] = Array.from({ length: n + 1 }, () => new Map());
  layers[0].set(startP, { cost: 0, parent: null });

  // 各 i でのフロンティア（支配関係の管理）
  const frontiers: Frontier[] = Array.from({ length: n + 1 }, () => new Frontier());
  frontiers[0].insert(startP, 0);

  const TIME_LIMIT_MS = 8000; // 8 秒で打ち切り → exact: false で返す
  let isExact = true;

  // i=0 から n-1 まで前進
  for (let i = 0; i < n; i++) {
    if (Date.now() - startMs > TIME_LIMIT_MS) {
      isExact = false;
      break;
    }
    const layer = layers[i];
    if (layer.size === 0) continue;

    const qs = qCandidates(n - i, params);

    for (const q of qs) {
      const i2 = i + q;
      if (i2 > n) continue;
      const orderTotal = q * P;
      const remainingTotal = (n - i2) * P;
      const frontier2 = frontiers[i2];
      const layer2 = layers[i2];

      // 最終ステップ（i2 === n）ではポイントのキャップを行わない。
      // 実際の余剰ポイントを保持して "min_cash_then_min_leftover" を正しく処理する。
      const isFinalStep = i2 === n;

      for (const [p, { cost }] of layer) {
        const cashList = candidateCashValues(p, orderTotal, remainingTotal, params, num, den);

        for (const cash of cashList) {
          const used = orderTotal - cash;
          if (used > p) continue;

          const earned = calcPointsEarned(cash, orderTotal, params, num, den);
          let p2 = p - used + earned;
          // 中間ステップのみキャップ。最終ステップは実際の値を保持。
          if (!isFinalStep && p2 > remainingTotal) p2 = remainingTotal;

          const cost2 = cost + cash;

          // 最終ステップでは Pareto 支配チェックをスキップ（目的は leftover 最小化）
          if (!isFinalStep) {
            if (frontier2.dominated(p2, cost2)) continue;
            if (!frontier2.insert(p2, cost2)) continue;
          }

          const existing = layer2.get(p2);
          if (existing === undefined || cost2 < existing.cost) {
            layer2.set(p2, {
              cost: cost2,
              parent: { pi: i, pp: p, qty: q, cashPaid: cash, pointsUsed: used, orderTotal },
            });
          }
        }
      }
    }
  }

  // 時間切れの場合は到達済みの最善値を探す
  const finalLayer = layers[n];
  if (!isExact && finalLayer.size === 0) {
    // n まで到達した状態がなければ、最も多く買えた状態から greedy で補完
    // ここでは null を返して API 側で 503 を返す
    return null;
  }
  if (finalLayer.size === 0) return null;

  // 最終ステップは Pareto frontier を使っていないので layer から直接集計する
  let minCost = Infinity;
  for (const entry of finalLayer.values()) {
    if (entry.cost < minCost) minCost = entry.cost;
  }

  // minCost のエントリーを全列挙
  const finalCandidatePs: number[] = [];
  for (const [p, entry] of finalLayer) {
    if (entry.cost === minCost) finalCandidatePs.push(p);
  }

  let finalP: number;
  if (params.objective === "min_cash_then_min_leftover") {
    // 実際の leftover（= final layer の p 値）を最小化
    finalP = Math.min(...finalCandidatePs);
  } else {
    // min_cash_then_min_orders: 注文回数最小
    let bestCount = Infinity;
    finalP = finalCandidatePs[0];
    for (const cp of finalCandidatePs) {
      const count = countOrders(n, cp, layers);
      if (count < bestCount) {
        bestCount = count;
        finalP = cp;
      }
    }
  }

  // 経路復元
  const steps: ParentInfo[] = [];
  {
    let ci = n;
    let cp = finalP;
    while (true) {
      const entry = layers[ci].get(cp);
      if (!entry || !entry.parent) break;
      steps.push(entry.parent);
      ci = entry.parent.pi;
      cp = entry.parent.pp;
    }
  }
  steps.reverse();

  // シミュレーション（表示用）
  let pBal = startP;
  let cashTotal = 0;
  const orders: OrderRow[] = [];

  for (let idx = 0; idx < steps.length; idx++) {
    const { qty, cashPaid, pointsUsed, orderTotal } = steps[idx];
    const eligible = isEligible(orderTotal, cashPaid, params.minEligibleTotal, params.eligibleBasis);
    const earned = calcPointsEarned(cashPaid, orderTotal, params, num, den);
    pBal = pBal - pointsUsed + earned;
    cashTotal += cashPaid;

    orders.push({
      index: idx + 1,
      qty,
      orderTotal,
      pointsUsed,
      cashPaid,
      pointsEarned: earned,
      pointsBalance: pBal,
      eligible,
    });
  }

  // 後処理: 連続するポイント未使用注文を統合
  const consolidatedOrders = consolidateOrders(orders, params, num, den, startP);
  const leftoverPoints = consolidatedOrders.length > 0
    ? consolidatedOrders[consolidatedOrders.length - 1].pointsBalance
    : startP;

  return {
    summary: {
      orderCount: consolidatedOrders.length,
      cashTotal,
      leftoverPoints,
      grossTotal: n * P,
    },
    orders: consolidatedOrders,
    meta: {
      exact: isExact,
      timeMs: Date.now() - startMs,
    },
  };
}

function countOrders(
  ni: number,
  pi: number,
  layers: Map<number, { cost: number; parent: ParentInfo | null }>[]
): number {
  let count = 0;
  let ci = ni, cp = pi;
  while (true) {
    const entry = layers[ci].get(cp);
    if (!entry || !entry.parent) break;
    ci = entry.parent.pi;
    cp = entry.parent.pp;
    count++;
  }
  return count;
}
