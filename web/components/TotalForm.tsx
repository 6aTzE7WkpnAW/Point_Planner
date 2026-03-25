"use client";

import { useState } from "react";
import CouponEditor from "@/components/CouponEditor";
import { draftsFromCoupons, validateCouponDrafts } from "@/lib/coupon-form";
import type { Params } from "@/types";
import { DEFAULT_PARAMS } from "@/types";

interface Props {
  onSubmit: (n: number, params: Params) => void;
  loading: boolean;
  initialTotal?: number;
  initialParams?: Params;
}

export default function TotalForm({
  onSubmit,
  loading,
  initialTotal = 60,
  initialParams,
}: Props) {
  const initial = initialParams ?? DEFAULT_PARAMS;

  const [total, setTotal] = useState(String(initialTotal));
  const [unitPrice, setUnitPrice] = useState(String(initial.unitPriceTaxIn));
  const [taxRate, setTaxRate] = useState(String(Math.round(initial.taxRate * 100)));
  const [pointRate, setPointRate] = useState(String(Math.round(initial.pointRate * 100)));
  const [minEligible, setMinEligible] = useState(String(initial.minEligibleTotal));
  const [objective, setObjective] = useState<Params["objective"]>(initial.objective);
  const [couponDrafts, setCouponDrafts] = useState(() => draftsFromCoupons(initial.coupons));
  const [showSettings, setShowSettings] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const nextErrors: Record<string, string> = {};
    const totalCount = parseInt(total, 10);
    const price = parseInt(unitPrice, 10);
    const tax = parseInt(taxRate, 10);
    const rate = parseInt(pointRate, 10);
    const minimum = parseInt(minEligible, 10);

    if (!Number.isInteger(totalCount) || totalCount < 1) nextErrors.total = "1以上の整数で入力してください。";
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

    onSubmit(parseInt(total, 10), {
      unitPriceTaxIn: parseInt(unitPrice, 10),
      taxRate: parseInt(taxRate, 10) / 100,
      pointRate: parseInt(pointRate, 10) / 100,
      minEligibleTotal: parseInt(minEligible, 10),
      eligibleBasis: "order_total",
      taxExMethod: "taxex_floor_then_rate",
      objective,
      coupons,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-500">購入したい総枚数</label>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="relative">
              <input
                type="number"
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                min={1}
                className={`w-full rounded-lg border bg-white px-3 py-2.5 pr-10 text-right text-sm font-semibold text-gray-900 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.total ? "border-red-400" : "border-gray-200"
                }`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">枚</span>
            </div>
            {errors.total && <p className="mt-1 text-xs text-red-500">{errors.total}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="whitespace-nowrap rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "計算中..." : "最適プランを計算"}
          </button>
        </div>
      </div>

      <button type="button" onClick={() => setShowSettings((value) => !value)} className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-600">
        {showSettings ? "詳細設定を閉じる" : "詳細設定"}
        {!showSettings && couponDrafts.length > 0 && (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
            クーポン {couponDrafts.length}枚
          </span>
        )}
      </button>

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
      <label className="mb-1.5 block text-xs font-medium text-gray-500">{label}</label>
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
