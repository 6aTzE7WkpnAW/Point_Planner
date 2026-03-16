"use client";

import { useMemo, useState } from "react";
import CouponEditor from "@/components/CouponEditor";
import { draftsFromCoupons, validateCouponDrafts } from "@/lib/coupon-form";
import type { Params } from "@/types";
import { DEFAULT_PARAMS } from "@/types";

interface Props {
  onSubmit: (n: number, params: Params, startPoints: number, purchased: number) => void;
  loading: boolean;
  initialAdditional?: number;
  initialPurchased?: number;
  initialPoints?: number;
  initialParams?: Params;
}

export default function InputForm({
  onSubmit,
  loading,
  initialAdditional = 1,
  initialPurchased = 0,
  initialPoints = 0,
  initialParams,
}: Props) {
  const initial = initialParams ?? DEFAULT_PARAMS;

  const [additional, setAdditional] = useState(String(initialAdditional));
  const [purchased, setPurchased] = useState(String(initialPurchased));
  const [points, setPoints] = useState(String(initialPoints));
  const [pointsAutoFilled, setPointsAutoFilled] = useState(true);
  const [unitPrice, setUnitPrice] = useState(String(initial.unitPriceTaxIn));
  const [taxRate, setTaxRate] = useState(String(Math.round(initial.taxRate * 100)));
  const [pointRate, setPointRate] = useState(String(Math.round(initial.pointRate * 100)));
  const [minEligible, setMinEligible] = useState(String(initial.minEligibleTotal));
  const [objective, setObjective] = useState<Params["objective"]>(initial.objective);
  const [couponDrafts, setCouponDrafts] = useState(() => draftsFromCoupons(initial.coupons));
  const [showSettings, setShowSettings] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function calcAutoPoints(purchasedValue: string): number | null {
    const purchasedCount = parseInt(purchasedValue, 10);
    const price = parseInt(unitPrice, 10);
    const tax = parseInt(taxRate, 10);
    const rate = parseInt(pointRate, 10);
    if (!Number.isFinite(purchasedCount) || purchasedCount < 0) return null;
    if (!Number.isFinite(price) || price < 0) return null;
    if (!Number.isFinite(tax) || !Number.isFinite(rate)) return null;
    return Math.floor((purchasedCount * price / (1 + tax / 100)) * (rate / 100));
  }

  function handlePurchasedChange(value: string) {
    setPurchased(value);
    const auto = calcAutoPoints(value);
    if (auto !== null) {
      setPoints(String(auto));
      setPointsAutoFilled(true);
    }
  }

  function handlePointsChange(value: string) {
    setPoints(value);
    setPointsAutoFilled(false);
  }

  function resetPointsToAuto() {
    const auto = calcAutoPoints(purchased);
    if (auto !== null) {
      setPoints(String(auto));
      setPointsAutoFilled(true);
    }
  }

  const totalAfter = useMemo(() => {
    const purchasedCount = parseInt(purchased, 10);
    const additionalCount = parseInt(additional, 10);
    if (!Number.isFinite(purchasedCount) || !Number.isFinite(additionalCount)) {
      return null;
    }
    return purchasedCount + additionalCount;
  }, [purchased, additional]);

  function validate() {
    const nextErrors: Record<string, string> = {};
    const additionalCount = parseInt(additional, 10);
    const purchasedCount = parseInt(purchased, 10);
    const pointBalance = parseInt(points, 10);
    const price = parseInt(unitPrice, 10);
    const tax = parseInt(taxRate, 10);
    const rate = parseInt(pointRate, 10);
    const minimum = parseInt(minEligible, 10);

    if (!Number.isInteger(additionalCount) || additionalCount < 1) nextErrors.additional = "1以上の整数で入力してください。";
    if (!Number.isInteger(purchasedCount) || purchasedCount < 0) nextErrors.purchased = "0以上の整数で入力してください。";
    if (!Number.isInteger(pointBalance) || pointBalance < 0) nextErrors.points = "0以上の整数で入力してください。";
    if (!Number.isInteger(price) || price < 0) nextErrors.unitPrice = "0以上の整数で入力してください。";
    if (!Number.isInteger(tax) || tax < 0 || tax > 100) nextErrors.taxRate = "0から100の整数で入力してください。";
    if (!Number.isInteger(rate) || rate < 0 || rate > 100) nextErrors.pointRate = "0から100の整数で入力してください。";
    if (!Number.isInteger(minimum) || minimum < 0) nextErrors.minEligible = "0以上の整数で入力してください。";

    const validatedCoupons = validateCouponDrafts(couponDrafts);
    if (validatedCoupons.error) {
      nextErrors.coupons = validatedCoupons.error;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return null;
    }
    return validatedCoupons.coupons;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const coupons = validate();
    if (coupons === null) {
      return;
    }

    onSubmit(
      parseInt(additional, 10),
      {
        unitPriceTaxIn: parseInt(unitPrice, 10),
        taxRate: parseInt(taxRate, 10) / 100,
        pointRate: parseInt(pointRate, 10) / 100,
        minEligibleTotal: parseInt(minEligible, 10),
        eligibleBasis: "order_total",
        taxExMethod: "taxex_floor_then_rate",
        objective,
        coupons,
      },
      parseInt(points, 10),
      parseInt(purchased, 10)
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldNumber label="購入済み枚数" value={purchased} onChange={handlePurchasedChange} error={errors.purchased} suffix="枚" min={0} />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-500">所持スペシャルクーポン</label>
            {pointsAutoFilled ? (
              <span className="text-xs font-medium text-blue-500">自動計算</span>
            ) : (
              <button type="button" onClick={resetPointsToAuto} className="text-xs text-gray-400 transition-colors hover:text-blue-500">
                自動計算に戻す
              </button>
            )}
          </div>
          <FieldNumber label="" value={points} onChange={handlePointsChange} error={errors.points} suffix="円" min={0} />
        </div>
        <FieldNumber label="追加購入枚数" value={additional} onChange={setAdditional} error={errors.additional} suffix="枚" min={1} />
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>購入後の総枚数</span>
        <span className="tabular-nums font-semibold text-gray-900">
          {totalAfter === null ? "-" : `${totalAfter.toLocaleString()} 枚`}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "計算中..." : "最適プランを計算"}
        </button>
        <button type="button" onClick={() => setShowSettings((value) => !value)} className="text-sm text-gray-400 transition-colors hover:text-gray-600">
          {showSettings ? "詳細設定を閉じる" : "詳細設定"}
        </button>
      </div>

      {showSettings && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">詳細設定</p>
          <div className="grid grid-cols-2 gap-4">
            <FieldNumber label="税込単価" value={unitPrice} onChange={setUnitPrice} error={errors.unitPrice} suffix="円" min={0} />
            <FieldNumber label="税率" value={taxRate} onChange={setTaxRate} error={errors.taxRate} suffix="%" min={0} max={100} />
            <FieldNumber label="スペシャルクーポン還元率" value={pointRate} onChange={setPointRate} error={errors.pointRate} suffix="%" min={0} max={100} />
            <FieldNumber label="付与対象最低金額" value={minEligible} onChange={setMinEligible} error={errors.minEligible} suffix="円" min={0} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldSelect
              label="最適化目標"
              value={objective}
              onChange={(value) => setObjective(value as Params["objective"])}
              options={[
                { value: "min_cash_then_min_orders", label: "現金最小 → 注文回数最小" },
                { value: "min_cash_then_min_leftover", label: "現金最小 → 残SC最小" },
              ]}
            />
            <CouponEditor coupons={couponDrafts} onChange={setCouponDrafts} error={errors.coupons} />
          </div>
        </div>
      )}
    </form>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  error,
  suffix,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      {label && <label className="mb-1.5 block text-xs font-medium text-gray-500">{label}</label>}
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          min={min}
          max={max}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-right text-sm font-semibold text-gray-900 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            suffix ? "pr-10" : ""
          } ${error ? "border-red-400" : "border-gray-200"}`}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-500">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-900 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
