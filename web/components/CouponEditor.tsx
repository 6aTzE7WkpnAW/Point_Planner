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
        <div className="space-y-2">
          {coupons.map((coupon, index) => (
            <div key={index} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-1">
                  <label className="shrink-0 text-[11px] text-gray-400 w-12">金額以上</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={coupon.minTotal}
                    placeholder="1000"
                    onChange={(event) => updateRow(index, "minTotal", event.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full rounded-md border border-gray-200 px-2 py-2 text-right text-base text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="shrink-0 text-xs text-gray-400">円</span>
                </div>
                <div className="flex items-center gap-1">
                  <label className="shrink-0 text-[11px] text-gray-400 w-12">値引き</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={coupon.discount}
                    placeholder="100"
                    onChange={(event) => updateRow(index, "discount", event.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full rounded-md border border-gray-200 px-2 py-2 text-right text-base text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="shrink-0 text-xs text-gray-400">円</span>
                </div>
                <div className="flex items-center gap-1">
                  <label className="shrink-0 text-[11px] text-gray-400 w-12">枚数</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={coupon.count}
                    placeholder="1"
                    onChange={(event) => updateRow(index, "count", event.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full rounded-md border border-gray-200 px-2 py-2 text-right text-base text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="shrink-0 text-xs text-gray-400">枚</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-100 hover:text-red-400"
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
        className="rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600 w-full"
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
