from functools import lru_cache

from point_planner import Coupon, Params, normalize_coupons, points_earned, solve


def brute_force_solve(n_items: int, params: Params, start_points: int = 0):
    coupons = normalize_coupons(params.coupons)
    num, den = params.ratio_num_den()
    unit_price = params.unit_price_tax_incl
    start_points = min(max(0, int(start_points)), n_items * unit_price)
    initial_counts = tuple(coupon.count for coupon in coupons)

    @lru_cache(maxsize=None)
    def best(purchased: int, point_balance: int, counts: tuple[int, ...]):
        if purchased == n_items:
            return (0, point_balance)

        best_result = None
        rem = n_items - purchased
        for qty in range(1, rem + 1):
            order_total = qty * unit_price

            actions = [(counts, 0)]
            for idx, coupon in enumerate(coupons):
                if counts[idx] > 0 and order_total >= coupon.min_total:
                    next_counts = list(counts)
                    next_counts[idx] -= 1
                    actions.append((tuple(next_counts), min(coupon.discount, order_total)))

            for next_counts, coupon_discount in actions:
                payable_total = max(0, order_total - coupon_discount)
                allow_points = coupon_discount == 0
                cash_min = payable_total - min(point_balance, payable_total) if allow_points else payable_total
                for cash_paid in range(cash_min, payable_total + 1):
                    points_used = payable_total - cash_paid
                    earned = points_earned(cash_paid, order_total, params, num, den)
                    result = best(purchased + qty, point_balance - points_used + earned, next_counts)
                    candidate = (cash_paid + result[0], result[1])
                    if best_result is None or candidate < best_result:
                        best_result = candidate
        return best_result

    cash_total, leftover_points = best(0, start_points, initial_counts)
    return {"cash_total": cash_total, "leftover_points": leftover_points}


def test_sample_plan_matches_expected_totals():
    params = Params(coupons=(Coupon(10000, 500, 2), Coupon(15000, 1000, 1)))

    result = solve(20, params, 3000, include_suggestion=False)

    assert result is not None
    assert result["cash_total"] == 26865
    assert result["leftover_points"] == 0
    assert result["coupon_discount_total"] == 1500


def test_solver_matches_bruteforce_for_small_case_with_coupons():
    params = Params(
        unit_price_tax_incl=1800,
        tax_rate_pct=10,
        point_rate_pct=20,
        min_order_total_for_points=3600,
        threshold_basis="order_total",
        coupons=(Coupon(5400, 500, 1), Coupon(7200, 700, 1)),
    )

    result = solve(5, params, 1000, include_suggestion=False)
    expected = brute_force_solve(5, params, 1000)

    assert result is not None
    assert result["cash_total"] == expected["cash_total"]
    assert result["leftover_points"] == expected["leftover_points"]


def test_solver_matches_bruteforce_for_cash_threshold_case():
    params = Params(
        unit_price_tax_incl=1500,
        tax_rate_pct=10,
        point_rate_pct=15,
        min_order_total_for_points=4500,
        threshold_basis="cash",
        coupons=(Coupon(4500, 400, 1),),
    )

    result = solve(4, params, 800, include_suggestion=False)
    expected = brute_force_solve(4, params, 800)

    assert result is not None
    assert result["cash_total"] == expected["cash_total"]
    assert result["leftover_points"] == expected["leftover_points"]
