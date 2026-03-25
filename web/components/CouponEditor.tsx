"use client";

import type { CouponDraft } from "@/lib/coupon-form";

interface Props {
  coupons: CouponDraft[];
  onChange: (coupons: CouponDraft[]) => void;
  error?: string;
  label?: string;
}

export default function CouponEditor({
  coupons,
  onChange,
  error,
  label = "所持通常クーポン",
}: Props) {
  function updateRow(index: number, key: keyof CouponDraft, value: string) {
    const next = coupons.slice();
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  function addRow() {
    onChange([...coupons, { minTotal: "", discount: "", count: "1" }]);
  }

  function removeRow(index: number) {
    const next = coupons.slice();
    next.splice(index, 1);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-gray-500">{label}</label>

      {/* 追加済みクーポン一覧 */}
      {coupons.length > 0 && (
        <div className="space-y-1.5">
          {/* ヘッダー */}
          <div className="grid grid-cols-12 gap-1 px-1">
            <span className="col-span-5 text-[10px] text-gray-400">税込金額以上</span>
            <span className="col-span-4 text-[10px] text-gray-400">値引き額</span>
            <span className="col-span-2 text-[10px] text-gray-400">枚数</span>
          </div>
          {coupons.map((coupon, index) => (
            <div key={index} className="grid grid-cols-12 items-center gap-1">
              <div className="relative col-span-5">
                <input
                  type="number"
                  value={coupon.minTotal}
                  min={0}
                  placeholder="1000"
                  onChange={(event) => updateRow(index, "minTotal", event.target.value)}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 pr-7 text-right text-xs text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">円</span>
              </div>
              <div className="relative col-span-4">
                <input
                  type="number"
                  value={coupon.discount}
                  min={1}
                  placeholder="100"
                  onChange={(event) => updateRow(index, "discount", event.target.value)}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 pr-7 text-right text-xs text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">円</span>
              </div>
              <div className="relative col-span-2">
                <input
                  type="number"
                  value={coupon.count}
                  min={1}
                  onChange={(event) => updateRow(index, "count", event.target.value)}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 pr-5 text-right text-xs text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">枚</span>
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="col-span-1 flex h-6 w-6 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-100 hover:text-red-400"
                aria-label="削除"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="text-xs text-gray-400 transition-colors hover:text-gray-600"
      >
        + クーポンを追加
      </button>

      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500">
        1注文につき通常クーポンは1枚まで使えます。HMVスペシャルクーポンとの同時利用はしません。
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
