"use client";

import { useMemo, useState } from "react";
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
  const p = initialParams ?? DEFAULT_PARAMS;

  const [additional, setAdditional] = useState(String(initialAdditional));
  const [purchased, setPurchased] = useState(String(initialPurchased));
  const [points, setPoints] = useState(String(initialPoints));
  const [unitPrice, setUnitPrice] = useState(String(p.unitPriceTaxIn));
  const [taxRate, setTaxRate] = useState(String(Math.round(p.taxRate * 100)));
  const [pointRate, setPointRate] = useState(String(Math.round(p.pointRate * 100)));
  const [minEligible, setMinEligible] = useState(String(p.minEligibleTotal));
  const [objective, setObjective] = useState<Params["objective"]>(p.objective);
  const [showSettings, setShowSettings] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalAfter = useMemo(() => {
    const p0 = parseInt(purchased, 10);
    const add = parseInt(additional, 10);
    if (!Number.isFinite(p0) || !Number.isFinite(add)) return null;
    return p0 + add;
  }, [purchased, additional]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const addInt = parseInt(additional, 10);
    if (!Number.isInteger(addInt) || addInt < 1) errs.additional = "1以上の整数を入力してください";
    const purInt = parseInt(purchased, 10);
    if (!Number.isInteger(purInt) || purInt < 0) errs.purchased = "0以上の整数を入力してください";
    const pt = parseInt(points, 10);
    if (!Number.isInteger(pt) || pt < 0) errs.points = "0以上の整数を入力してください";
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
      },
      parseInt(points, 10),
      parseInt(purchased, 10)
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FieldNumber
          label="購入済み枚数"
          value={purchased}
          onChange={setPurchased}
          error={errors.purchased}
          suffix="枚"
          min={0}
        />
        <FieldNumber
          label="所持ポイント"
          value={points}
          onChange={setPoints}
          error={errors.points}
          suffix="pt"
          min={0}
        />
        <FieldNumber
          label="追加購入したい枚数"
          value={additional}
          onChange={setAdditional}
          error={errors.additional}
          suffix="枚"
          min={1}
        />
      </div>

      {/* 合計表示 */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>追加後の合計</span>
        <span className="font-semibold text-gray-900 tabular-nums">
          {totalAfter === null ? "—" : `${totalAfter.toLocaleString()} 枚`}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {loading ? "計算中…" : "最適プランを計算"}
        </button>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showSettings ? "設定を閉じる" : "詳細設定"}
        </button>
      </div>

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
