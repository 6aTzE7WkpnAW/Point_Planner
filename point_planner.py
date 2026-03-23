from __future__ import annotations

import argparse
from bisect import bisect_left
from dataclasses import dataclass
from fractions import Fraction
from time import perf_counter
from typing import Dict, Iterable, List, Optional, Tuple


Q_TAIL_WINDOW = 12
Q_SMALL_MAX = 12
Q_THRESHOLD_NEAR = 4
CouponCounts = Tuple[int, ...]
StateKey = Tuple[int, CouponCounts]


@dataclass(frozen=True)
class Coupon:
    min_total: int
    discount: int
    count: int = 1


@dataclass(frozen=True)
class Params:
    unit_price_tax_incl: int = 1800
    tax_rate_pct: int = 10
    point_rate_pct: int = 20
    min_order_total_for_points: int = 10000
    threshold_basis: str = "order_total"
    coupons: Tuple[Coupon, ...] = ()

    def ratio_num_den(self) -> Tuple[int, int]:
        point_rate = Fraction(self.point_rate_pct, 100)
        tax_rate = Fraction(self.tax_rate_pct, 100)
        ratio = point_rate / (1 + tax_rate)
        return ratio.numerator, ratio.denominator


@dataclass(frozen=True)
class ParentInfo:
    prev_items: int
    prev_points: int
    prev_coupon_counts: CouponCounts
    qty: int
    order_total: int
    coupon_discount: int
    coupon_label: Optional[str]
    points_used: int
    cash_paid: int


class Frontier:
    def __init__(self) -> None:
        self.points: List[int] = []
        self.costs: List[int] = []

    def dominated(self, point_balance: int, cost: int, keep_lower_points_on_tie: bool) -> bool:
        idx = bisect_left(self.points, point_balance)
        if idx < len(self.points) and self.points[idx] == point_balance:
            return self.costs[idx] <= cost
        if idx < len(self.points):
            return self.costs[idx] < cost if keep_lower_points_on_tie else self.costs[idx] <= cost
        return False

    def insert(self, point_balance: int, cost: int, keep_lower_points_on_tie: bool) -> bool:
        idx = bisect_left(self.points, point_balance)
        if idx < len(self.points) and self.points[idx] == point_balance:
            if self.costs[idx] <= cost:
                return False
            self.costs[idx] = cost
        else:
            if idx < len(self.points):
                dominates = self.costs[idx] < cost if keep_lower_points_on_tie else self.costs[idx] <= cost
                if dominates:
                    return False
            self.points.insert(idx, point_balance)
            self.costs.insert(idx, cost)

        while idx > 0 and (
            self.costs[idx - 1] > self.costs[idx]
            if keep_lower_points_on_tie
            else self.costs[idx - 1] >= self.costs[idx]
        ):
            del self.points[idx - 1]
            del self.costs[idx - 1]
            idx -= 1
        return True


def normalize_coupons(coupons: Tuple[Coupon, ...]) -> Tuple[Coupon, ...]:
    normalized = [
        Coupon(
            min_total=max(0, int(coupon.min_total)),
            discount=max(0, int(coupon.discount)),
            count=max(0, int(coupon.count)),
        )
        for coupon in coupons
        if coupon.discount > 0 and coupon.count > 0
    ]
    normalized.sort(key=lambda coupon: (coupon.min_total, coupon.discount))
    return tuple(normalized)


def eligible(order_total: int, cash_paid: int, params: Params) -> bool:
    if params.threshold_basis == "order_total":
        return order_total >= params.min_order_total_for_points
    if params.threshold_basis == "cash":
        return cash_paid >= params.min_order_total_for_points
    raise ValueError("threshold_basis must be 'order_total' or 'cash'")


def points_earned(cash_paid: int, order_total: int, params: Params, num: int, den: int) -> int:
    if not eligible(order_total, cash_paid, params):
        return 0
    return (cash_paid * num) // den


def end_points(
    start_points: int,
    cash_paid: int,
    payable_total: int,
    order_total: int,
    params: Params,
    num: int,
    den: int,
) -> int:
    used = payable_total - cash_paid
    return start_points - used + points_earned(cash_paid, order_total, params, num, den)


def q_candidates(rem_items: int, params: Params) -> List[int]:
    threshold_qty = (params.min_order_total_for_points + params.unit_price_tax_incl - 1) // params.unit_price_tax_incl
    candidates = set()
    for qty in range(1, min(rem_items, Q_SMALL_MAX) + 1):
        candidates.add(qty)
    for delta in range(-Q_THRESHOLD_NEAR, Q_THRESHOLD_NEAR + 1):
        qty = threshold_qty + delta
        if 1 <= qty <= rem_items:
            candidates.add(qty)
    for offset in range(0, min(Q_TAIL_WINDOW, rem_items - 1) + 1):
        candidates.add(rem_items - offset)
    candidates.add(rem_items)
    return sorted(candidates)


def max_future_coupon_discount(
    coupons: Tuple[Coupon, ...],
    counts: CouponCounts,
    remaining_items: int,
    unit_price_tax_incl: int,
) -> int:
    remaining_total = remaining_items * unit_price_tax_incl
    total = 0
    for coupon, count in zip(coupons, counts):
        if count <= 0 or coupon.min_total > remaining_total:
            continue
        total += coupon.discount * count
    return min(total, remaining_total)


def coupon_actions(coupons: Tuple[Coupon, ...], counts: CouponCounts, order_total: int) -> Iterable[Tuple[CouponCounts, int, Optional[str]]]:
    yield counts, 0, None
    for idx, coupon in enumerate(coupons):
        if counts[idx] <= 0 or order_total < coupon.min_total:
            continue
        next_counts = list(counts)
        next_counts[idx] -= 1
        yield (
            tuple(next_counts),
            min(coupon.discount, order_total),
            f"{coupon.min_total}円以上で{coupon.discount}円引き",
        )


def candidate_cash_values(
    point_balance: int,
    payable_total: int,
    order_total: int,
    allow_special_coupon_use: bool,
    future_target: int,
    params: Params,
    num: int,
    den: int,
) -> List[int]:
    usable_special_coupon = min(point_balance, payable_total) if allow_special_coupon_use else 0
    cash_min = max(0, payable_total - usable_special_coupon)
    cash_max = payable_total
    values = {cash_min, cash_max}

    for target in (0, future_target, max(0, future_target - params.unit_price_tax_incl)):
        if end_points(point_balance, cash_min, payable_total, order_total, params, num, den) >= target:
            if cash_min + 1 <= cash_max:
                values.add(cash_min + 1)
            continue
        if end_points(point_balance, cash_max, payable_total, order_total, params, num, den) < target:
            continue

        lo, hi = cash_min, cash_max
        while lo < hi:
            mid = (lo + hi) // 2
            if end_points(point_balance, mid, payable_total, order_total, params, num, den) >= target:
                hi = mid
            else:
                lo = mid + 1

        if lo - 1 >= cash_min:
            values.add(lo - 1)
        values.add(lo)
        if lo + 1 <= cash_max:
            values.add(lo + 1)

    return sorted(values)


def build_purchase_suggestion(base_cash_total: int, target_items: int, params: Params, start_points: int):
    budget = base_cash_total + params.unit_price_tax_incl
    max_coupon_saving = sum(coupon.discount * coupon.count for coupon in params.coupons)
    tax_exclusive_ratio = Fraction(1, 1) / (1 + Fraction(params.tax_rate_pct, 100))
    min_effective_ratio = max(Fraction(1, 100), Fraction(1, 1) - Fraction(params.point_rate_pct, 100) * tax_exclusive_ratio)
    min_effective_price = max(1, int(params.unit_price_tax_incl * min_effective_ratio))
    max_possible_items = max(
        target_items + 1,
        (budget + start_points + max_coupon_saving + min_effective_price - 1) // min_effective_price + 5,
    )

    low = target_items + 1
    high = max_possible_items
    best_result = None
    best_target_items = target_items

    while low <= high:
        mid = (low + high) // 2
        candidate = solve(mid, params, start_points, include_suggestion=False)
        if candidate is None:
            high = mid - 1
            continue

        if candidate["cash_total"] <= budget:
            best_result = candidate
            best_target_items = mid
            low = mid + 1
        else:
            high = mid - 1

    if best_result is None or best_target_items <= target_items:
        return None

    additional_cash = best_result["cash_total"] - base_cash_total
    if additional_cash <= 0 or additional_cash > params.unit_price_tax_incl:
        return None

    return {
        "additional_cash": additional_cash,
        "target_items": best_target_items,
        "extra_items": best_target_items - target_items,
    }


def solve(n_items: int, params: Params, start_points: int = 0, include_suggestion: bool = True):
    started_at = perf_counter()
    coupons = normalize_coupons(params.coupons)
    num, den = params.ratio_num_den()
    unit_price = params.unit_price_tax_incl
    start_point_balance = min(max(0, int(start_points)), n_items * unit_price)
    start_coupon_counts: CouponCounts = tuple(coupon.count for coupon in coupons)
    keep_lower_points_on_tie = True

    q_by_remaining = {rem: q_candidates(rem, params) for rem in range(1, n_items + 1)}
    future_target_cache: Dict[Tuple[CouponCounts, int], int] = {}
    cash_candidates_cache: Dict[Tuple[int, int, int, bool, int], List[int]] = {}
    coupon_action_cache: Dict[Tuple[CouponCounts, int], Tuple[Tuple[CouponCounts, int, Optional[str]], ...]] = {}

    layers: List[Dict[StateKey, Tuple[int, Optional[ParentInfo]]]] = [dict() for _ in range(n_items + 1)]
    frontiers: List[Dict[CouponCounts, Frontier]] = [dict() for _ in range(n_items + 1)]
    start_state = (start_point_balance, start_coupon_counts)
    layers[0][start_state] = (0, None)
    frontiers[0][start_coupon_counts] = Frontier()
    frontiers[0][start_coupon_counts].insert(start_point_balance, 0, keep_lower_points_on_tie)

    for purchased in range(n_items):
        layer = layers[purchased]
        if not layer:
            continue

        for qty in q_by_remaining[n_items - purchased]:
            next_purchased = purchased + qty
            order_total = qty * unit_price
            next_layer = layers[next_purchased]
            is_final_step = next_purchased == n_items

            for (point_balance, current_coupon_counts), (cost, _) in layer.items():
                action_key = (current_coupon_counts, order_total)
                actions = coupon_action_cache.get(action_key)
                if actions is None:
                    actions = tuple(coupon_actions(coupons, current_coupon_counts, order_total))
                    coupon_action_cache[action_key] = actions

                for next_counts, coupon_discount, coupon_label in actions:
                    payable_total = max(0, order_total - coupon_discount)
                    remaining_items = n_items - next_purchased
                    future_key = (next_counts, remaining_items)
                    future_target = future_target_cache.get(future_key)
                    if future_target is None:
                        future_target = max(
                            0,
                            remaining_items * unit_price - max_future_coupon_discount(coupons, next_counts, remaining_items, unit_price),
                        )
                        future_target_cache[future_key] = future_target

                    cash_key = (point_balance, payable_total, order_total, coupon_discount == 0, future_target)
                    cash_values = cash_candidates_cache.get(cash_key)
                    if cash_values is None:
                        cash_values = candidate_cash_values(
                            point_balance,
                            payable_total,
                            order_total,
                            coupon_discount == 0,
                            future_target,
                            params,
                            num,
                            den,
                        )
                        cash_candidates_cache[cash_key] = cash_values

                    for cash_paid in cash_values:
                        points_used = payable_total - cash_paid
                        if points_used > point_balance:
                            continue

                        next_points = point_balance - points_used + points_earned(cash_paid, order_total, params, num, den)
                        next_cost = cost + cash_paid
                        next_state = (next_points, next_counts)

                        if not is_final_step:
                            frontier = frontiers[next_purchased].setdefault(next_counts, Frontier())
                            if frontier.dominated(next_points, next_cost, keep_lower_points_on_tie):
                                continue
                            if not frontier.insert(next_points, next_cost, keep_lower_points_on_tie):
                                continue

                        prev = next_layer.get(next_state)
                        if prev is not None and prev[0] <= next_cost:
                            continue

                        next_layer[next_state] = (
                            next_cost,
                            ParentInfo(
                                prev_items=purchased,
                                prev_points=point_balance,
                                prev_coupon_counts=current_coupon_counts,
                                qty=qty,
                                order_total=order_total,
                                coupon_discount=coupon_discount,
                                coupon_label=coupon_label,
                                points_used=points_used,
                                cash_paid=cash_paid,
                            ),
                        )

    final_layer = layers[n_items]
    if not final_layer:
        return None

    min_cost = min(cost for cost, _ in final_layer.values())
    finalists = [state for state, (cost, _) in final_layer.items() if cost == min_cost]
    best_state = min(finalists, key=lambda item: item[0])

    steps: List[ParentInfo] = []
    current_items = n_items
    current_state = best_state
    while True:
        entry = layers[current_items].get(current_state)
        if entry is None or entry[1] is None:
            break
        steps.append(entry[1])
        current_items = entry[1].prev_items
        current_state = (entry[1].prev_points, entry[1].prev_coupon_counts)
    steps.reverse()

    point_balance = start_point_balance
    cash_total = 0
    coupon_discount_total = 0
    rows = []
    for index, step in enumerate(steps, start=1):
        earned = points_earned(step.cash_paid, step.order_total, params, num, den)
        point_balance = point_balance - step.points_used + earned
        cash_total += step.cash_paid
        coupon_discount_total += step.coupon_discount
        rows.append(
            {
                "no": index,
                "qty": step.qty,
                "order_total": step.order_total,
                "coupon_discount": step.coupon_discount,
                "coupon_applied": step.coupon_label,
                "points_used": step.points_used,
                "cash_paid": step.cash_paid,
                "points_earned": earned,
                "points_balance": point_balance,
                "eligible": eligible(step.order_total, step.cash_paid, params),
            }
        )

    suggestion = None
    if include_suggestion:
        suggestion = build_purchase_suggestion(cash_total, n_items, params, start_points)

    return {
        "cash_total": cash_total,
        "leftover_points": point_balance,
        "coupon_discount_total": coupon_discount_total,
        "rows": rows,
        "time_ms": int((perf_counter() - started_at) * 1000),
        "suggestion": suggestion,
    }


def parse_coupon_arg(value: str) -> Coupon:
    try:
        threshold_part, rest = value.split(":", 1)
        discount_part, *count_part = rest.split("x", 1)
        return Coupon(
            min_total=int(threshold_part),
            discount=int(discount_part),
            count=int(count_part[0]) if count_part else 1,
        )
    except ValueError as exc:
        raise argparse.ArgumentTypeError("クーポンは 10000:500x2 の形式で指定してください。") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="HMVスペシャルクーポンと通常クーポンを含めた分割購入プランを計算します。")
    parser.add_argument("n", type=int, help="購入したい枚数")
    parser.add_argument("--start-points", type=int, default=0, help="開始時スペシャルクーポン残高")
    parser.add_argument("--unit", type=int, default=1800, help="1枚の税込価格")
    parser.add_argument("--tax", type=int, default=10, help="税率（%）")
    parser.add_argument("--rate", type=int, default=20, help="スペシャルクーポン還元率（%）")
    parser.add_argument("--min", dest="min_total", type=int, default=10000, help="スペシャルクーポン付与最低金額")
    parser.add_argument("--basis", choices=["order_total", "cash"], default="order_total", help="スペシャルクーポン付与条件の判定基準")
    parser.add_argument(
        "--coupon",
        dest="coupons",
        action="append",
        type=parse_coupon_arg,
        default=[],
        help="通常クーポンを 10000:500x2 の形式で追加",
    )
    args = parser.parse_args()

    params = Params(
        unit_price_tax_incl=args.unit,
        tax_rate_pct=args.tax,
        point_rate_pct=args.rate,
        min_order_total_for_points=args.min_total,
        threshold_basis=args.basis,
        coupons=tuple(args.coupons),
    )
    result = solve(args.n, params, args.start_points)
    if result is None:
        print("計算に失敗しました。")
        return

    print(f"現金支払総額: {result['cash_total']} 円")
    print(f"クーポン値引き合計: {result['coupon_discount_total']} 円")
    print(f"最終スペシャルクーポン残: {result['leftover_points']} 円")
    print(f"計算時間: {result['time_ms']} ms")
    if result["suggestion"] is not None:
        suggestion = result["suggestion"]
        print(
            f"サジェスト: あと{suggestion['additional_cash']}円あれば(スペシャルクーポンと合わせて)"
            f"{suggestion['target_items']}枚購入できます。"
        )
    print("")
    print(f"{'回':>2} {'枚数':>4} {'注文金額':>10} {'通常CP':>10} {'使用SC':>8} {'支払現金':>10} {'獲得SC':>8} {'残SC':>8}")
    print("-" * 76)
    for row in result["rows"]:
        print(
            f"{row['no']:>2} {row['qty']:>4} {row['order_total']:>10} {row['coupon_discount']:>10} "
            f"{row['points_used']:>8} {row['cash_paid']:>10} {row['points_earned']:>8} {row['points_balance']:>8}"
        )


if __name__ == "__main__":
    main()
