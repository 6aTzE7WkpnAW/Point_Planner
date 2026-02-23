import type { OrderRow } from "@/types";

interface Props {
  orders: OrderRow[];
}

export default function ResultTable({ orders }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs font-medium text-gray-500 text-right border-b border-gray-100">
            <th className="px-4 py-3 text-center w-10">#</th>
            <th className="px-4 py-3">購入枚数</th>
            <th className="px-4 py-3">注文金額</th>
            <th className="px-4 py-3">使用ポイント</th>
            <th className="px-4 py-3">支払現金</th>
            <th className="px-4 py-3">獲得ポイント</th>
            <th className="px-4 py-3">残ポイント</th>
            <th className="px-4 py-3 text-center">備考</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((row, i) => (
            <tr
              key={row.index}
              className={`text-right border-b border-gray-50 hover:bg-blue-50/40 transition-colors ${
                i % 2 === 1 ? "bg-gray-50/60" : "bg-white"
              }`}
            >
              <td className="px-4 py-3 text-center">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                  {row.index}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold text-gray-900 tabular-nums">{row.qty}</td>
              <td className="px-4 py-3 text-gray-700 tabular-nums">{row.orderTotal.toLocaleString()} 円</td>
              <td className="px-4 py-3 tabular-nums">
                {row.pointsUsed > 0 ? (
                  <span className="text-amber-600 font-medium">−{row.pointsUsed.toLocaleString()} pt</span>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-3 font-semibold text-blue-600 tabular-nums">
                {row.cashPaid.toLocaleString()} 円
              </td>
              <td className="px-4 py-3 tabular-nums">
                {row.pointsEarned > 0 ? (
                  <span className="text-emerald-600 font-medium">+{row.pointsEarned.toLocaleString()} pt</span>
                ) : (
                  <span className="text-gray-400">0 pt</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-700 tabular-nums">{row.pointsBalance.toLocaleString()} pt</td>
              <td className="px-4 py-3 text-center">
                {!row.eligible && (
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">
                    ポイント対象外
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-right bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-800">
            <td className="px-4 py-3 text-center text-xs text-gray-500 font-medium">合計</td>
            <td className="px-4 py-3 tabular-nums">{orders.reduce((s, r) => s + r.qty, 0)}</td>
            <td className="px-4 py-3 tabular-nums">{orders.reduce((s, r) => s + r.orderTotal, 0).toLocaleString()} 円</td>
            <td className="px-4 py-3 text-amber-600 tabular-nums">
              −{orders.reduce((s, r) => s + r.pointsUsed, 0).toLocaleString()} pt
            </td>
            <td className="px-4 py-3 text-blue-600 tabular-nums">
              {orders.reduce((s, r) => s + r.cashPaid, 0).toLocaleString()} 円
            </td>
            <td className="px-4 py-3 text-emerald-600 tabular-nums">
              +{orders.reduce((s, r) => s + r.pointsEarned, 0).toLocaleString()} pt
            </td>
            <td className="px-4 py-3 text-gray-700 tabular-nums" colSpan={2}>
              {orders[orders.length - 1]?.pointsBalance.toLocaleString()} pt
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
