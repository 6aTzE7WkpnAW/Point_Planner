import type { Coupon, OrderRow, Params, SolveResult } from "@/types";

const Q_TAIL_WINDOW = 12;
const Q_SMALL_MAX = 12;
const Q_THRESHOLD_NEAR = 4;
const TIME_LIMIT_MS = 8000;

type CouponAction = {
  nextCounts: number[];
  discount: number;
  label: string | null;
};

type ParentInfo = {
  prevItems: number;
  prevPoints: number;
  prevCouponKey: string;
  qty: number;
  orderTotal: number;
  couponDiscount: number;
  couponApplied: string | null;
  pointsUsed: number;
  cashPaid: number;
};

type LayerEntry = {
  cost: number;
  parent: ParentInfo | null;
};

type CouponStateData = {
  counts: number[];
  key: string;
  actionsByOrderTotal: Map<number, CouponAction[]>;
};

function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

function ratioNumDen(pointRate: number, taxRate: number): [number, number] {
  const scale = 1_000_000;
  const num = Math.round(pointRate * scale);
  const den = scale + Math.round(taxRate * scale);
  const div = gcd(num, den);
  return [num / div, den / div];
}

function normalizeCoupons(coupons?: Coupon[]): Coupon[] {
  return (coupons ?? [])
    .map((coupon) => ({
      minTotal: Math.max(0, Math.floor(coupon.minTotal)),
      discount: Math.max(0, Math.floor(coupon.discount)),
      count: Math.max(0, Math.floor(coupon.count)),
    }))
    .filter((coupon) => coupon.discount > 0 && coupon.count > 0)
    .sort((a, b) => (a.minTotal - b.minTotal) || (a.discount - b.discount));
}

function couponKey(counts: number[]): string {
  return counts.join(",");
}

function parseCouponKey(key: string): number[] {
  if (!key) return [];
  return key.split(",").map((value) => parseInt(value, 10));
}

function isEligible(orderTotal: number, cashPaid: number, params: Params): boolean {
  return params.eligibleBasis === "order_total"
    ? orderTotal >= params.minEligibleTotal
    : cashPaid >= params.minEligibleTotal;
}

function calcPointsEarned(
  cashPaid: number,
  orderTotal: number,
  params: Params,
  num: number,
  den: number
): number {
  if (!isEligible(orderTotal, cashPaid, params)) {
    return 0;
  }
  if (params.taxExMethod === "ratio_floor") {
    return Math.floor((cashPaid * num) / den);
  }
  const taxExclusive = Math.floor(cashPaid / (1 + params.taxRate));
  return Math.floor(taxExclusive * params.pointRate);
}

function endPoints(
  startPoints: number,
  cashPaid: number,
  payableTotal: number,
  orderTotal: number,
  params: Params,
  num: number,
  den: number
): number {
  const used = payableTotal - cashPaid;
  return startPoints - used + calcPointsEarned(cashPaid, orderTotal, params, num, den);
}

class Frontier {
  private points: number[] = [];
  private costs: number[] = [];

  dominated(pointBalance: number, cost: number, keepLowerPointsOnTie: boolean): boolean {
    const idx = lowerBound(this.points, pointBalance);
    if (idx < this.points.length && this.points[idx] === pointBalance) {
      return this.costs[idx] <= cost;
    }
    if (idx < this.points.length) {
      return keepLowerPointsOnTie ? this.costs[idx] < cost : this.costs[idx] <= cost;
    }
    return false;
  }

  insert(pointBalance: number, cost: number, keepLowerPointsOnTie: boolean): boolean {
    const idx = lowerBound(this.points, pointBalance);
    if (idx < this.points.length && this.points[idx] === pointBalance) {
      if (this.costs[idx] <= cost) {
        return false;
      }
      this.costs[idx] = cost;
    } else {
      if (idx < this.points.length) {
        const dominates = keepLowerPointsOnTie ? this.costs[idx] < cost : this.costs[idx] <= cost;
        if (dominates) {
          return false;
        }
      }
      this.points.splice(idx, 0, pointBalance);
      this.costs.splice(idx, 0, cost);
    }

    let i = idx;
    while (
      i > 0 &&
      (keepLowerPointsOnTie ? this.costs[i - 1] > this.costs[i] : this.costs[i - 1] >= this.costs[i])
    ) {
      this.points.splice(i - 1, 1);
      this.costs.splice(i - 1, 1);
      i -= 1;
    }
    return true;
  }
}

function lowerBound(values: number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (values[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function qCandidates(remItems: number, params: Params): number[] {
  const thresholdQty = Math.ceil(params.minEligibleTotal / params.unitPriceTaxIn);
  const seen = new Uint8Array(remItems + 1);
  const result: number[] = [];

  const add = (qty: number) => {
    if (qty >= 1 && qty <= remItems && seen[qty] === 0) {
      seen[qty] = 1;
      result.push(qty);
    }
  };

  for (let qty = 1; qty <= Math.min(remItems, Q_SMALL_MAX); qty += 1) {
    add(qty);
  }
  for (let delta = -Q_THRESHOLD_NEAR; delta <= Q_THRESHOLD_NEAR; delta += 1) {
    add(thresholdQty + delta);
  }
  for (let offset = 0; offset <= Math.min(Q_TAIL_WINDOW, remItems - 1); offset += 1) {
    add(remItems - offset);
  }
  add(remItems);

  return result.sort((a, b) => a - b);
}

function maxFutureCouponDiscount(
  coupons: Coupon[],
  counts: number[],
  remainingItems: number,
  unitPriceTaxIn: number
): number {
  if (remainingItems <= 0 || coupons.length === 0) {
    return 0;
  }

  const remainingGross = remainingItems * unitPriceTaxIn;
  let total = 0;
  for (let index = 0; index < coupons.length; index += 1) {
    if (counts[index] <= 0) {
      continue;
    }
    if (coupons[index].minTotal > remainingGross) {
      continue;
    }
    total += coupons[index].discount * counts[index];
  }
  return Math.min(total, remainingGross);
}

function couponActions(coupons: Coupon[], counts: number[], orderTotal: number): CouponAction[] {
  const actions: CouponAction[] = [{ nextCounts: counts, discount: 0, label: null }];

  for (let index = 0; index < coupons.length; index += 1) {
    const coupon = coupons[index];
    if (counts[index] <= 0 || orderTotal < coupon.minTotal) {
      continue;
    }
    const nextCounts = counts.slice();
    nextCounts[index] -= 1;
    actions.push({
      nextCounts,
      discount: Math.min(coupon.discount, orderTotal),
      label: `${coupon.minTotal.toLocaleString()}円以上で${coupon.discount.toLocaleString()}円引き`,
    });
  }

  return actions;
}

function getCouponStateData(
  key: string,
  couponStateCache: Map<string, CouponStateData>
): CouponStateData {
  let state = couponStateCache.get(key);
  if (!state) {
    state = {
      counts: parseCouponKey(key),
      key,
      actionsByOrderTotal: new Map<number, CouponAction[]>(),
    };
    couponStateCache.set(key, state);
  }
  return state;
}

function getCouponActionsForState(
  coupons: Coupon[],
  state: CouponStateData,
  orderTotal: number,
  couponStateCache: Map<string, CouponStateData>
): Array<CouponAction & { nextState: CouponStateData }> {
  let actions = state.actionsByOrderTotal.get(orderTotal);
  if (!actions) {
    actions = couponActions(coupons, state.counts, orderTotal);
    state.actionsByOrderTotal.set(orderTotal, actions);
  }

  return actions.map((action) => ({
    ...action,
    nextState: getCouponStateData(couponKey(action.nextCounts), couponStateCache),
  }));
}

function candidateCashValues(
  pointBalance: number,
  payableTotal: number,
  orderTotal: number,
  allowSpecialCouponUse: boolean,
  futureTarget: number,
  params: Params,
  num: number,
  den: number
): number[] {
  const usableSpecialCoupon = allowSpecialCouponUse ? Math.min(pointBalance, payableTotal) : 0;
  const cashMin = Math.max(0, payableTotal - usableSpecialCoupon);
  const cashMax = payableTotal;
  const values = new Set<number>([cashMin, cashMax]);

  const add = (value: number) => {
    if (value >= cashMin && value <= cashMax) {
      values.add(value);
    }
  };

  const targets = [
    0,
    futureTarget,
    Math.max(0, futureTarget - params.unitPriceTaxIn),
  ];

  for (const target of targets) {
    const minEndPoints = endPoints(pointBalance, cashMin, payableTotal, orderTotal, params, num, den);
    if (minEndPoints >= target) {
      add(cashMin + 1);
      continue;
    }

    const maxEndPoints = endPoints(pointBalance, cashMax, payableTotal, orderTotal, params, num, den);
    if (maxEndPoints < target) {
      continue;
    }

    let lo = cashMin;
    let hi = cashMax;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const pointsAfter = endPoints(pointBalance, mid, payableTotal, orderTotal, params, num, den);
      if (pointsAfter >= target) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    add(lo - 1);
    add(lo);
    add(lo + 1);
  }

  return Array.from(values).sort((a, b) => a - b);
}

function countOrders(
  items: number,
  pointBalance: number,
  couponState: string,
  layers: Map<string, Map<number, LayerEntry>>[]
): number {
  let total = 0;
  let currentItems = items;
  let currentPointBalance = pointBalance;
  let currentCouponState = couponState;

  while (true) {
    const entry = layers[currentItems].get(currentCouponState)?.get(currentPointBalance);
    if (!entry?.parent) {
      return total;
    }
    total += 1;
    currentItems = entry.parent.prevItems;
    currentPointBalance = entry.parent.prevPoints;
    currentCouponState = entry.parent.prevCouponKey;
  }
}


function buildPurchaseSuggestion(
  baseCashTotal: number,
  targetItems: number,
  params: Params,
  startPoints: number,
  leftoverPoints: number
) {
  if (leftoverPoints <= 0) {
    return null;
  }
  const budget = baseCashTotal + params.unitPriceTaxIn;
  const coupons = params.coupons ?? [];
  const maxCouponSaving = coupons.reduce((sum, coupon) => sum + coupon.discount * coupon.count, 0);
  const taxExclusiveRatio = 1 / (1 + params.taxRate);
  const minEffectivePrice = params.unitPriceTaxIn * Math.max(0.01, 1 - params.pointRate * taxExclusiveRatio);
  const maxPossibleItems = Math.min(
    500,
    Math.max(
      targetItems + 1,
      Math.ceil((budget + startPoints + maxCouponSaving) / Math.max(1, minEffectivePrice)) + 5
    )
  );

  let low = targetItems + 1;
  let high = maxPossibleItems;
  let bestResult: SolveResult | null = null;
  let bestTargetItems = targetItems;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const candidate = solve(mid, params, startPoints, false);
    if (candidate === null) {
      high = mid - 1;
      continue;
    }

    if (candidate.summary.cashTotal <= budget) {
      bestResult = candidate;
      bestTargetItems = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (!bestResult || bestTargetItems <= targetItems) {
    return null;
  }

  const additionalCash = Math.max(0, bestResult.summary.cashTotal - baseCashTotal);
  if (additionalCash > params.unitPriceTaxIn) {
    return null;
  }

  return {
    additionalCash,
    targetItems: bestTargetItems,
    extraItems: bestTargetItems - targetItems,
  };
}

export function solve(n: number, params: Params, startPoints = 0, includeSuggestion = true): SolveResult | null {
  const startedAt = Date.now();
  const coupons = normalizeCoupons(params.coupons);
  const [num, den] = ratioNumDen(params.pointRate, params.taxRate);
  const unitPrice = params.unitPriceTaxIn;
  const startPointBalance = Math.min(Math.max(0, Math.floor(startPoints)), n * unitPrice);
  const startCouponCounts = coupons.map((coupon) => coupon.count);
  const startCouponKey = couponKey(startCouponCounts);
  const couponStateCache = new Map<string, CouponStateData>();
  const futureDiscountCache = new Map<string, number>();
  const cashCandidateCache = new Map<string, number[]>();
  const keepLowerPointsOnTie = params.objective === "min_cash_then_min_leftover";

  const layers: Map<string, Map<number, LayerEntry>>[] = Array.from({ length: n + 1 }, () => new Map());
  const frontiers: Map<string, Frontier>[] = Array.from({ length: n + 1 }, () => new Map());
  layers[0].set(startCouponKey, new Map([[startPointBalance, { cost: 0, parent: null }]]));
  frontiers[0].set(startCouponKey, new Frontier());
  frontiers[0].get(startCouponKey)?.insert(startPointBalance, 0, keepLowerPointsOnTie);

  let isExact = true;

  for (let purchased = 0; purchased < n; purchased += 1) {
    if (Date.now() - startedAt > TIME_LIMIT_MS) {
      isExact = false;
      break;
    }

    const currentLayer = layers[purchased];
    if (currentLayer.size === 0) {
      continue;
    }

    const quantities = qCandidates(n - purchased, params);
    for (const qty of quantities) {
      const nextPurchased = purchased + qty;
      const orderTotal = qty * unitPrice;
      const isFinalStep = nextPurchased === n;
      const nextLayer = layers[nextPurchased];
      const nextFrontiers = frontiers[nextPurchased];

      for (const [currentCouponKey, pointEntries] of currentLayer) {
        const currentCouponState = getCouponStateData(currentCouponKey, couponStateCache);
        for (const [pointBalance, entry] of pointEntries) {

          for (const action of getCouponActionsForState(coupons, currentCouponState, orderTotal, couponStateCache)) {
            const payableTotal = Math.max(0, orderTotal - action.discount);
            const remainingItems = n - nextPurchased;
            const futureDiscountKey = `${remainingItems}|${action.nextState.key}`;
            let futureCouponDiscount = futureDiscountCache.get(futureDiscountKey);
            if (futureCouponDiscount === undefined) {
              futureCouponDiscount = maxFutureCouponDiscount(
                coupons,
                action.nextState.counts,
                remainingItems,
                unitPrice
              );
              futureDiscountCache.set(futureDiscountKey, futureCouponDiscount);
            }
            const futureTarget = Math.max(0, remainingItems * unitPrice - futureCouponDiscount);
            const nextCouponKey = action.nextState.key;
            const cashCandidateKey = [
              pointBalance,
              payableTotal,
              orderTotal,
              action.discount === 0 ? 1 : 0,
              futureTarget,
            ].join("|");
            let cashValues = cashCandidateCache.get(cashCandidateKey);
            if (!cashValues) {
              cashValues = candidateCashValues(
                pointBalance,
                payableTotal,
                orderTotal,
                action.discount === 0,
                futureTarget,
                params,
                num,
                den
              );
              cashCandidateCache.set(cashCandidateKey, cashValues);
            }

            for (const cashPaid of cashValues) {
              const pointsUsed = payableTotal - cashPaid;
              if (pointsUsed > pointBalance) {
                continue;
              }

              const earned = calcPointsEarned(cashPaid, orderTotal, params, num, den);
              const nextPointBalance = pointBalance - pointsUsed + earned;
              const nextCost = entry.cost + cashPaid;

              if (!isFinalStep) {
                let frontier = nextFrontiers.get(nextCouponKey);
                if (!frontier) {
                  frontier = new Frontier();
                  nextFrontiers.set(nextCouponKey, frontier);
                }
                if (frontier.dominated(nextPointBalance, nextCost, keepLowerPointsOnTie)) {
                  continue;
                }
                if (!frontier.insert(nextPointBalance, nextCost, keepLowerPointsOnTie)) {
                  continue;
                }
              }

              let couponLayer = nextLayer.get(nextCouponKey);
              if (!couponLayer) {
                couponLayer = new Map<number, LayerEntry>();
                nextLayer.set(nextCouponKey, couponLayer);
              }
              const currentBest = couponLayer.get(nextPointBalance);
              if (currentBest && currentBest.cost <= nextCost) {
                continue;
              }

              couponLayer.set(nextPointBalance, {
                cost: nextCost,
                parent: {
                  prevItems: purchased,
                  prevPoints: pointBalance,
                  prevCouponKey: currentCouponKey,
                  qty,
                  orderTotal,
                  couponDiscount: action.discount,
                  couponApplied: action.label,
                  pointsUsed,
                  cashPaid,
                },
              });
            }
          }
        }
      }
    }
  }

  const finalLayer = layers[n];
  if (finalLayer.size === 0) {
    return null;
  }

  let minCost = Number.POSITIVE_INFINITY;
  for (const pointEntries of finalLayer.values()) {
    for (const entry of pointEntries.values()) {
      minCost = Math.min(minCost, entry.cost);
    }
  }

  const finalStates: Array<{ pointBalance: number; couponState: string }> = [];
  for (const [couponState, pointEntries] of finalLayer) {
    for (const [pointBalance, entry] of pointEntries) {
      if (entry.cost !== minCost) {
        continue;
      }
      finalStates.push({ pointBalance, couponState });
    }
  }

  let chosen = finalStates[0];
  if (params.objective === "min_cash_then_min_leftover") {
    for (const candidate of finalStates) {
      if (candidate.pointBalance < chosen.pointBalance) {
        chosen = candidate;
      }
    }
  } else {
    let bestOrderCount = Number.POSITIVE_INFINITY;
    for (const candidate of finalStates) {
      const orderCount = countOrders(n, candidate.pointBalance, candidate.couponState, layers);
      if (orderCount < bestOrderCount) {
        bestOrderCount = orderCount;
        chosen = candidate;
      }
    }
  }

  const steps: ParentInfo[] = [];
  let currentItems = n;
  let currentPointBalance = chosen.pointBalance;
  let currentCouponState = chosen.couponState;
  while (true) {
    const entry = layers[currentItems].get(currentCouponState)?.get(currentPointBalance);
    if (!entry?.parent) {
      break;
    }
    steps.push(entry.parent);
    currentItems = entry.parent.prevItems;
    currentPointBalance = entry.parent.prevPoints;
    currentCouponState = entry.parent.prevCouponKey;
  }
  steps.reverse();

  let pointBalance = startPointBalance;
  let cashTotal = 0;
  let couponDiscountTotal = 0;
  const orders: OrderRow[] = [];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const pointsEarned = calcPointsEarned(step.cashPaid, step.orderTotal, params, num, den);
    pointBalance = pointBalance - step.pointsUsed + pointsEarned;
    cashTotal += step.cashPaid;
    couponDiscountTotal += step.couponDiscount;

    orders.push({
      index: index + 1,
      qty: step.qty,
      orderTotal: step.orderTotal,
      couponDiscount: step.couponDiscount,
      couponApplied: step.couponApplied,
      pointsUsed: step.pointsUsed,
      cashPaid: step.cashPaid,
      pointsEarned,
      pointsBalance: pointBalance,
      eligible: isEligible(step.orderTotal, step.cashPaid, params),
    });
  }

  return {
    summary: {
      orderCount: orders.length,
      cashTotal,
      leftoverPoints: pointBalance,
      grossTotal: n * unitPrice,
      couponDiscountTotal,
      suggestion: includeSuggestion ? buildPurchaseSuggestion(cashTotal, n, params, startPoints, pointBalance) : null,
    },
    orders,
    meta: {
      exact: isExact,
      timeMs: Date.now() - startedAt,
    },
  };
}
