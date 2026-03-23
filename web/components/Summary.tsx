import type { SolveResult } from "@/types";

interface Props {
  result: SolveResult;
}

export default function Summary({ result }: Props) {
  const { summary } = result;
  const suggestionText = summary.suggestion
    ? summary.suggestion.additionalCash > 0
      ? `あと${summary.suggestion.additionalCash.toLocaleString()}円足すと${summary.suggestion.extraItems}枚多く買えます（計${summary.suggestion.targetItems.toLocaleString()}枚）`
      : `SC残高${summary.leftoverPoints.toLocaleString()}円、追加なしで${summary.suggestion.extraItems}枚多く買えます（計${summary.suggestion.targetItems.toLocaleString()}枚）`
    : null;
  const effectiveDiscountRate =
    summary.grossTotal > 0
      ? ((summary.grossTotal - summary.cashTotal) / summary.grossTotal) * 100
      : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard
          label="現金支払総額"
          value={`¥ ${summary.cashTotal.toLocaleString()}`}
          sub={`定価 ¥${summary.grossTotal.toLocaleString()}`}
          accent="bg-blue-600"
        />
        <StatCard
          label="クーポン値引き"
          value={`¥ ${summary.couponDiscountTotal.toLocaleString()}`}
          accent="bg-rose-500"
        />
        <StatCard
          label="実質割引率"
          value={`${effectiveDiscountRate.toFixed(1)} %`}
          accent="bg-emerald-500"
        />
        <StatCard
          label="注文回数"
          value={`${summary.orderCount} 回`}
          accent="bg-violet-500"
        />
        <StatCard
          label="最終SC残高"
          value={`${summary.leftoverPoints.toLocaleString()} 円`}
          accent="bg-amber-400"
        />
      </div>
      {suggestionText && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {suggestionText}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className={`h-1 ${accent}`} />
      <div className="p-4">
        <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
        <p className="tabular-nums text-xl font-bold leading-none text-gray-900">{value}</p>
        {sub && <p className="mt-1.5 text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}
