import type { Coupon } from "@/types";

export const COUPON_PRESETS: { label: string; minTotal: number; discount: number }[] = [
  { label: "500円以上\n100円引き", minTotal: 500, discount: 100 },
  { label: "1000円以上\n100円引き", minTotal: 1000, discount: 100 },
  { label: "2000円以上\n200円引き", minTotal: 2000, discount: 200 },
  { label: "5000円以上\n500円引き", minTotal: 5000, discount: 500 },
];

export type CouponDraft = {
  minTotal: string;
  discount: string;
  count: string;
};

export function draftsFromCoupons(coupons?: Coupon[]): CouponDraft[] {
  if (!coupons || coupons.length === 0) {
    return [];
  }
  return coupons.map((coupon) => ({
    minTotal: String(coupon.minTotal),
    discount: String(coupon.discount),
    count: String(coupon.count),
  }));
}

export function emptyCouponDraft(): CouponDraft {
  return {
    minTotal: "",
    discount: "",
    count: "1",
  };
}

export function validateCouponDrafts(drafts: CouponDraft[]): { coupons: Coupon[]; error?: string } {
  const coupons: Coupon[] = [];

  for (const draft of drafts) {
    const isBlank =
      draft.minTotal.trim() === "" &&
      draft.discount.trim() === "" &&
      draft.count.trim() === "";
    if (isBlank) {
      continue;
    }

    const minTotal = parseInt(draft.minTotal, 10);
    const discount = parseInt(draft.discount, 10);
    const count = parseInt(draft.count || "1", 10);

    if (!Number.isInteger(minTotal) || minTotal < 0) {
      return { coupons: [], error: "クーポンの適用金額は0以上の整数で入力してください。" };
    }
    if (!Number.isInteger(discount) || discount <= 0) {
      return { coupons: [], error: "クーポン値引き額は1以上の整数で入力してください。" };
    }
    if (!Number.isInteger(count) || count <= 0) {
      return { coupons: [], error: "クーポン枚数は1以上の整数で入力してください。" };
    }

    coupons.push({ minTotal, discount, count });
  }

  return { coupons };
}
