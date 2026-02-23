import type { SolveResult } from "@/types";

interface Props {
  result: SolveResult;
}

export default function Summary({ result }: Props) {
  const { summary } = result;
  const discountRate =
    summary.grossTotal > 0
      ? ((summary.grossTotal - summary.cashTotal) / summary.grossTotal) * 100
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        label="現金支払い合計"
        value={`¥ ${summary.cashTotal.toLocaleString()}`}
        sub={`節約 ¥${(summary.grossTotal - summary.cashTotal).toLocaleString()}`}
        accent="bg-blue-600"
      />
      <StatCard
        label="実質割引率"
        value={`${discountRate.toFixed(1)} %`}
        sub={`総額 ¥${summary.grossTotal.toLocaleString()}`}
        accent="bg-emerald-500"
      />
      <StatCard
        label="注文回数"
        value={`${summary.orderCount} 回`}
        accent="bg-violet-500"
      />
      <StatCard
        label="最終ポイント残"
        value={`${summary.leftoverPoints.toLocaleString()} pt`}
        accent="bg-amber-400"
      />
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
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className={`h-1 ${accent}`} />
      <div className="p-4">
        <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-none tabular-nums">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}
