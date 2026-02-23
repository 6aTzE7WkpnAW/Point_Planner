"use client";

import { useState } from "react";
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
  const p = initialParams ?? DEFAULT_PARAMS;

  const [total, setTotal] = useState(String(initialTotal));
  const [unitPrice, setUnitPrice] = useState(String(p.unitPriceTaxIn));
  const [taxRate, setTaxRate] = useState(String(Math.round(p.taxRate * 100)));
  const [pointRate, setPointRate] = useState(String(Math.round(p.pointRate * 100)));
  const [minEligible, setMinEligible] = useState(String(p.minEligibleTotal));
  const [objective, setObjective] = useState<Params["objective"]>(p.objective);
  const [showSettings, setShowSettings] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const totalInt = parseInt(total, 10);
    if (!Number.isInteger(totalInt) || totalInt < 1) errs.total = "1以上の整数を入力してください";
    const up = parseInt(unitPrice, 10);
    if (!Number.isInteger(up) || up < 0) errs.unitPrice = "0以上の整数を入力してください";
    const tr = parseInt(taxRate, 10);
    if (isNaN(tr) || tr < 0 || tr > 100) errs.taxRate = "0〜100の整数を入力してください";
    const pr = parseInt(pointRate, 10);
    if (isNaN(pr) || pr < 0 || pr > 100) errs.pointRate = "0〜100の整数を入力してください";
    const me = parseInt(minEligible, 10);
    if (!Number.isInteger(me) || me < 0) errs.minEligible = "0以上の整数を入力してください";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(parseInt(total, 10), {
      unitPriceTaxIn: parseInt(unitPrice, 10),
      taxRate: parseInt(taxRate, 10) / 100,
      pointRate: parseInt(pointRate, 10) / 100,
      minEligibleTotal: parseInt(minEligible, 10),
      eligibleBasis: "order_total",
      taxExMethod: "taxex_floor_then_rate",
      objective,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          購入したい合計枚数
        </label>
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <div className="relative">
              <input
                type="number"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                min={1}
                className={`w-full bg-white border rounded-lg px-3 py-2.5 pr-10 text-right text-gray-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${
                  errors.total ? "border-red-400" : "border-gray-200"
                }`}
                placeholder="例: 60"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                枚
              </span>
            </div>
            {errors.total && <p className="text-red-500 text-xs mt-1">{errors.total}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
          >
            {loading ? "計算中…" : "最適プランを計算"}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        {showSettings ? "設定を閉じる" : "詳細設定"}
      </button>

      {showSettings && (
        <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">詳細設定</p>
          <div className="grid grid-cols-2 gap-4">
            <FieldNumber label="1枚の税込価格" value={unitPrice} onChange={setUnitPrice} error={errors.unitPrice} suffix="円" min={0} />
            <FieldNumber label="税率" value={taxRate} onChange={setTaxRate} error={errors.taxRate} suffix="%" min={0} max={100} />
            <FieldNumber label="ポイント付与率" value={pointRate} onChange={setPointRate} error={errors.pointRate} suffix="%" min={0} max={100} />
            <FieldNumber label="付与下限金額" value={minEligible} onChange={setMinEligible} error={errors.minEligible} suffix="円" min={0} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg p-3 space-y-0.5">
              <p className="font-semibold text-gray-600 mb-1">HMVルール（固定）</p>
              <p>条件: 注文金額（税込、ポイント使用前）≥ 10,000円</p>
              <p>付与: 税抜（ポイント利用後）× 20%（切捨て）</p>
            </div>
            <FieldSelect
              label="目的の優先順位"
              value={objective}
              onChange={(v) => setObjective(v as Params["objective"])}
              options={[
                { value: "min_cash_then_min_orders", label: "現金最小 → 注文回数最小" },
                { value: "min_cash_then_min_leftover", label: "現金最小 → 残ポイント最小" },
              ]}
            />
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
  onChange: (v: string) => void;
  error?: string;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          className={`w-full bg-white border rounded-lg px-3 py-2.5 text-right text-gray-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${
            suffix ? "pr-10" : ""
          } ${error ? "border-red-400" : "border-gray-200"}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
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
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
