import type { OrderRow } from "@/types";

interface Props {
  orders: OrderRow[];
}

export default function ResultTable({ orders }: Props) {
  const totalCouponDiscount = orders.reduce((sum, row) => sum + row.couponDiscount, 0);
  const totalPointsUsed = orders.reduce((sum, row) => sum + row.pointsUsed, 0);
  const totalCashPaid = orders.reduce((sum, row) => sum + row.cashPaid, 0);
  const totalPointsEarned = orders.reduce((sum, row) => sum + row.pointsEarned, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-right text-xs font-medium text-gray-500">
            <th className="w-10 px-4 py-3 text-center">#</th>
            <th className="px-4 py-3">枚数</th>
            <th className="px-4 py-3">注文金額</th>
            <th className="px-4 py-3">クーポン</th>
            <th className="px-4 py-3">使用SC</th>
            <th className="px-4 py-3">支払現金</th>
            <th className="px-4 py-3">獲得SC</th>
            <th className="px-4 py-3">残SC</th>
            <th className="px-4 py-3 text-center">備考</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((row, index) => (
            <tr
              key={row.index}
              className={`border-b border-gray-50 text-right transition-colors hover:bg-blue-50/40 ${
                index % 2 === 1 ? "bg-gray-50/60" : "bg-white"
              }`}
            >
              <td className="px-4 py-3 text-center">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
                  {row.index}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums font-semibold text-gray-900">{row.qty}</td>
              <td className="px-4 py-3 tabular-nums text-gray-700">{row.orderTotal.toLocaleString()} 円</td>
              <td className="px-4 py-3 tabular-nums">
                {row.couponDiscount > 0 ? (
                  <div className="text-right">
                    <span className="font-medium text-rose-600">-{row.couponDiscount.toLocaleString()} 円</span>
                    {row.couponApplied && <div className="text-[11px] text-gray-400">{row.couponApplied}</div>}
                  </div>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>
              <td className="px-4 py-3 tabular-nums">
                {row.pointsUsed > 0 ? (
                  <span className="font-medium text-amber-600">-{row.pointsUsed.toLocaleString()} 円</span>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>
              <td className="px-4 py-3 tabular-nums font-semibold text-blue-600">{row.cashPaid.toLocaleString()} 円</td>
              <td className="px-4 py-3 tabular-nums">
                {row.pointsEarned > 0 ? (
                  <span className="font-medium text-emerald-600">+{row.pointsEarned.toLocaleString()} 円</span>
                ) : (
                  <span className="text-gray-400">0 円</span>
                )}
              </td>
              <td className="px-4 py-3 tabular-nums text-gray-700">{row.pointsBalance.toLocaleString()} 円</td>
              <td className="px-4 py-3 text-center">
                {!row.eligible && (
                  <span className="inline-block whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    SC付与なし
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 text-right font-semibold text-gray-800">
            <td className="px-4 py-3 text-center text-xs font-medium text-gray-500">合計</td>
            <td className="px-4 py-3 tabular-nums">{orders.reduce((sum, row) => sum + row.qty, 0)}</td>
            <td className="px-4 py-3 tabular-nums">{orders.reduce((sum, row) => sum + row.orderTotal, 0).toLocaleString()} 円</td>
            <td className="px-4 py-3 tabular-nums text-rose-600">-{totalCouponDiscount.toLocaleString()} 円</td>
            <td className="px-4 py-3 tabular-nums text-amber-600">-{totalPointsUsed.toLocaleString()} 円</td>
            <td className="px-4 py-3 tabular-nums text-blue-600">{totalCashPaid.toLocaleString()} 円</td>
            <td className="px-4 py-3 tabular-nums text-emerald-600">+{totalPointsEarned.toLocaleString()} 円</td>
            <td className="px-4 py-3 tabular-nums text-gray-700" colSpan={2}>
              {orders[orders.length - 1]?.pointsBalance.toLocaleString()} 円
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
