import type { SolveResult } from "@/types";
import StackedBarChart from "@/components/charts/StackedBarChart";
import PointsLineChart from "@/components/charts/PointsLineChart";
import SavingsDonut from "@/components/charts/SavingsDonut";

interface Props {
  result: SolveResult;
}

export default function Charts({ result }: Props) {
  const { orders, summary } = result;

  // 1注文のみの場合はグラフ不要
  if (orders.length < 2) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* ヘッダー */}
      <div className="px-5 py-3.5 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">支払いの内訳グラフ</h2>
      </div>

      <div className="p-5 space-y-6">
        {/* 凡例 */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
            現金支払い
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-300 inline-block" />
            現金（ポイント対象外）
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
            ポイント使用
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
            節約額
          </span>
        </div>

        {/* グラフA（棒グラフ）+ グラフC（ドーナツ）横並び */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
          <div className="sm:col-span-2">
            <p className="text-xs text-gray-400 mb-2">注文ごとの支払い内訳（X軸: 注文番号）</p>
            <StackedBarChart orders={orders} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">節約の内訳</p>
            <div className="flex justify-center">
              <SavingsDonut summary={summary} />
            </div>
          </div>
        </div>

        {/* グラフB（折れ線）全幅 */}
        <div>
          <p className="text-xs text-gray-400 mb-2">ポイント残高の推移（X軸: 注文番号）</p>
          <PointsLineChart orders={orders} />
        </div>
      </div>
    </div>
  );
}
