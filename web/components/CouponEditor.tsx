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
      <div className="flex items-center justify-between gap-3">
        <label className="block text-xs font-medium text-gray-500">{label}</label>
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-700"
        >
          クーポンを追加
        </button>
      </div>

      {coupons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-400">
          通常クーポンは未登録です。
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map((coupon, index) => (
            <div key={index} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label className="mb-1 block text-[11px] text-gray-500">税込み金額以上</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={coupon.minTotal}
                      min={0}
                      onChange={(event) => updateRow(index, "minTotal", event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-8 text-right text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">円</span>
                  </div>
                </div>
                <div className="sm:col-span-4">
                  <label className="mb-1 block text-[11px] text-gray-500">値引き額</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={coupon.discount}
                      min={1}
                      onChange={(event) => updateRow(index, "discount", event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-8 text-right text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">円</span>
                  </div>
                </div>
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-[11px] text-gray-500">枚数</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={coupon.count}
                      min={1}
                      onChange={(event) => updateRow(index, "count", event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-8 text-right text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">枚</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="rounded-lg px-2 py-2 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500"
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500">
        1注文につき通常クーポンは1枚まで使えます。HMVスペシャルクーポンとの同時利用はしません。
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
