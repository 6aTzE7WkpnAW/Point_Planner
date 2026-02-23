from dataclasses import dataclass
from fractions import Fraction
from heapq import heappush, heappop
from bisect import bisect_left
import argparse
import textwrap
from typing import Dict, Tuple, List, Optional

SCRIPT_PATH = "/mnt/data/point_planner.py"

script = r'''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
point_planner.py

目的:
  欲しい枚数 N を入力すると、購入回数・各回の購入枚数・使用ポイント・支払現金・獲得ポイントを
  「現金支払い最小（＝実質割引最大）」になるように提案します。

前提（デフォルト）:
  - 1枚あたり 1800円（税込）
  - 消費税 10%
  - 還元: 税抜の20%をポイント付与（= 実際の現金支払いの税抜を基準）
  - 条件: 1回の購入（注文金額・税込）が 10,000円以上のときだけポイント付与
  - ポイントは1pt=1円として次回以降に使用できる
  - 獲得ポイントは 1pt未満切り捨て（floor）
  - ポイントを使った分は「現金支払い」が減り、ポイント計算の対象も減る

注意:
  - 実店舗/サービスによって「税抜を丸めるタイミング」や「条件判定が支払金額か注文金額か」が違います。
    その場合はオプションで調整してください。
"""

from dataclasses import dataclass
from fractions import Fraction
from heapq import heappush, heappop
from bisect import bisect_left
from typing import Dict, Tuple, List, Optional

@dataclass(frozen=True)
class Params:
    unit_price_tax_incl: int = 1800
    tax_rate_pct: int = 10
    point_rate_pct: int = 20
    min_order_total_for_points: int = 10000  # 「条件」の基準額
    min_cash_for_points: int = 0            # 追加条件（通常0でOK）
    threshold_basis: str = "order_total"    # "order_total"（注文金額） or "cash"（支払金額）
    cap_points_to_remaining: bool = True    # 残額以上のポイントは探索上カットして高速化

    # 探索の高速化用（候補に入れる購入枚数の絞り込み）
    q_tail_window: int = 12                 # 残り枚数の近辺（例: 残り-0..-12）を候補に入れる
    q_small_max: int = 12                   # 少ない枚数（例: 1..12）を候補に入れる
    q_threshold_near: int = 4               # 条件達成の最小枚数（例: 6）の前後を候補に入れる

    def ratio_num_den(self) -> Tuple[int, int]:
        # 付与ポイント = floor( 現金支払い * (point_rate/(1+tax_rate)) )
        pr = Fraction(self.point_rate_pct, 100)
        tr = Fraction(self.tax_rate_pct, 100)
        r = pr / (1 + tr)
        return r.numerator, r.denominator

def eligible(order_total: int, cash_paid: int, params: Params) -> bool:
    if params.threshold_basis == "order_total":
        return (order_total >= params.min_order_total_for_points) and (cash_paid >= params.min_cash_for_points)
    if params.threshold_basis == "cash":
        # 「支払金額が1万円以上なら付与」という店向け
        return (cash_paid >= params.min_order_total_for_points) and (cash_paid >= params.min_cash_for_points)
    raise ValueError("threshold_basis must be 'order_total' or 'cash'")

def points_earned(cash_paid: int, order_total: int, params: Params, num: int, den: int) -> int:
    if not eligible(order_total, cash_paid, params):
        return 0
    return (cash_paid * num) // den

def end_points(p0: int, cash_paid: int, order_total: int, params: Params, num: int, den: int) -> int:
    used = order_total - cash_paid
    return p0 - used + points_earned(cash_paid, order_total, params, num, den)

class Frontier:
    """
    (points, cost) の非劣解（Pareto frontier）を points 昇順で保持。
    cost は points が増えるほど（通常）増えるので、支配関係の判定を高速化できます。
    """
    def __init__(self):
        self.points: List[int] = []
        self.costs: List[int] = []

    def dominated(self, p: int, cost: int) -> bool:
        idx = bisect_left(self.points, p)
        return idx < len(self.points) and self.costs[idx] <= cost

    def insert(self, p: int, cost: int) -> bool:
        idx = bisect_left(self.points, p)
        if idx < len(self.points) and self.points[idx] == p:
            if self.costs[idx] <= cost:
                return False
            self.costs[idx] = cost
        else:
            if idx < len(self.points) and self.costs[idx] <= cost:
                return False
            self.points.insert(idx, p)
            self.costs.insert(idx, cost)

        # 左側にある「ポイントが少ないのにコストが高い」状態を削除
        while idx > 0 and self.costs[idx-1] >= self.costs[idx]:
            del self.points[idx-1]
            del self.costs[idx-1]
            idx -= 1
        return True

    def items(self):
        return list(zip(self.points, self.costs))

def q_candidates(rem_items: int, params: Params) -> List[int]:
    P = params.unit_price_tax_incl
    q_thr = (params.min_order_total_for_points + P - 1) // P  # 条件達成の最小枚数
    cand = set()

    for q in range(1, min(rem_items, params.q_small_max) + 1):
        cand.add(q)

    for dq in range(-params.q_threshold_near, params.q_threshold_near + 1):
        q = q_thr + dq
        if 1 <= q <= rem_items:
            cand.add(q)

    for k in range(0, min(params.q_tail_window, rem_items-1) + 1):
        cand.add(rem_items - k)

    cand.add(rem_items)
    return sorted(cand)

def candidate_cash_values(p_avail: int, order_total: int, remaining_total: int,
                          params: Params, num: int, den: int) -> List[int]:
    """
    「支払現金」の候補値を少数に絞る。
    - 最小（ポイント最大使用）
    - 最大（ポイント不使用）
    - 残りを全部ポイントで払えるだけの残高を作るのに必要な最小現金（近傍）
    """
    cash_min = max(0, order_total - min(p_avail, order_total))
    cash_max = order_total
    cands = {cash_min, cash_max}

    targets = set()
    targets.add(remaining_total)  # 残りを全部ポイントで払える残高
    if remaining_total - params.unit_price_tax_incl >= 0:
        targets.add(remaining_total - params.unit_price_tax_incl)
    targets.add(0)

    for target in targets:
        if end_points(p_avail, cash_min, order_total, params, num, den) >= target:
            cands.add(cash_min)
            if cash_min + 1 <= cash_max:
                cands.add(cash_min + 1)
            continue

        if end_points(p_avail, cash_max, order_total, params, num, den) < target:
            continue

        lo, hi = cash_min, cash_max
        while lo < hi:
            mid = (lo + hi) // 2
            if end_points(p_avail, mid, order_total, params, num, den) >= target:
                hi = mid
            else:
                lo = mid + 1

        cands.add(lo)
        if lo - 1 >= cash_min:
            cands.add(lo - 1)
        if lo + 1 <= cash_max:
            cands.add(lo + 1)

    # 範囲内のみ
    return sorted(c for c in cands if cash_min <= c <= cash_max)

def solve(n_items: int, params: Params):
    num, den = params.ratio_num_den()
    P = params.unit_price_tax_incl

    frontiers = [Frontier() for _ in range(n_items + 1)]
    frontiers[0].insert(0, 0)

    best: Dict[Tuple[int,int], int] = {(0,0): 0}
    parent: Dict[Tuple[int,int], Tuple[int,int,int,int,int,int,int]] = {}
    heap = [(0, 0, 0)]  # cost, items, points

    while heap:
        cost, i, p = heappop(heap)
        if best.get((i,p)) != cost:
            continue

        rem_items = n_items - i
        if rem_items == 0:
            continue

        for q in q_candidates(rem_items, params):
            order_total = q * P
            i2 = i + q
            remaining_total = (n_items - i2) * P

            for cash in candidate_cash_values(p, order_total, remaining_total, params, num, den):
                used = order_total - cash
                if used > p:
                    continue

                earned = points_earned(cash, order_total, params, num, den)
                p2 = p - used + earned

                if params.cap_points_to_remaining:
                    cap = remaining_total
                    if p2 > cap:
                        p2 = cap

                cost2 = cost + cash

                if frontiers[i2].dominated(p2, cost2):
                    continue
                if not frontiers[i2].insert(p2, cost2):
                    continue

                key = (i2, p2)
                prev = best.get(key)
                if prev is None or cost2 < prev:
                    best[key] = cost2
                    parent[key] = (i, p, q, cash, used, earned, order_total)
                    heappush(heap, (cost2, i2, p2))

    finals = frontiers[n_items].items()
    if not finals:
        return None

    min_cost = min(c for p,c in finals)
    min_left = min(p for p,c in finals if c == min_cost)
    state = (n_items, min_left)

    plan = []
    while state in parent:
        pi, pp, q, cash, used, earned, order_total = parent[state]
        plan.append((q, order_total, used, cash, earned))
        state = (pi, pp)
    plan.reverse()

    # シミュレーション（表示用）
    pbal = 0
    cash_total = 0
    rows = []
    for idx, (q, order_total, used, cash, _) in enumerate(plan, start=1):
        earned = points_earned(cash, order_total, params, num, den)
        pbal = pbal - used + earned
        cash_total += cash
        rows.append({
            "no": idx,
            "qty": q,
            "order_total": order_total,
            "points_used": used,
            "cash_paid": cash,
            "points_earned": earned,
            "points_balance": pbal
        })

    return {"cash_total": cash_total, "leftover_points": pbal, "rows": rows}

def main():
    ap = argparse.ArgumentParser(
        formatter_class=argparse.RawTextHelpFormatter,
        description="枚数を入れると、分割購入＋ポイント使用の最適案（現金最小）を出します。"
    )
    ap.add_argument("n", type=int, help="購入したい枚数")
    ap.add_argument("--unit", type=int, default=1800, help="1枚の税込価格（円）")
    ap.add_argument("--tax", type=int, default=10, help="消費税率（%）")
    ap.add_argument("--rate", type=int, default=20, help="ポイント還元率（税抜に対して）（%）")
    ap.add_argument("--min", dest="min_total", type=int, default=10000, help="ポイント付与条件の下限金額（円）")
    ap.add_argument("--basis", choices=["order_total", "cash"], default="order_total",
                    help="条件判定の基準: order_total=注文金額, cash=支払金額")
    args = ap.parse_args()

    params = Params(
        unit_price_tax_incl=args.unit,
        tax_rate_pct=args.tax,
        point_rate_pct=args.rate,
        min_order_total_for_points=args.min_total,
        threshold_basis=args.basis
    )

    out = solve(args.n, params)
    if out is None:
        print("解が見つかりませんでした。条件や入力を確認してください。")
        return

    print(f"合計支払（現金）: {out['cash_total']} 円")
    print(f"最終ポイント残: {out['leftover_points']} pt")
    print("")
    print("内訳（各回）:")
    header = f"{'回':>2} {'枚数':>4} {'注文金額':>8} {'使用pt':>8} {'支払現金':>8} {'獲得pt':>8} {'残pt':>8}"
    print(header)
    print("-" * len(header))
    for r in out["rows"]:
        print(f"{r['no']:>2} {r['qty']:>4} {r['order_total']:>8} {r['points_used']:>8} {r['cash_paid']:>8} {r['points_earned']:>8} {r['points_balance']:>8}")

if __name__ == "__main__":
    main()
'''

with open(SCRIPT_PATH, "w", encoding="utf-8") as f:
    f.write(script)

print(SCRIPT_PATH)

