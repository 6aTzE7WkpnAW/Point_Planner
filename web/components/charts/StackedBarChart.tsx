import type { OrderRow } from "@/types";

interface Props {
  orders: OrderRow[];
}

const WIDTH = 600;
const HEIGHT = 200;
const PADDING = { top: 16, right: 16, bottom: 28, left: 52 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

export default function StackedBarChart({ orders }: Props) {
  const maxVal = Math.max(...orders.map((r) => r.orderTotal), 1);
  const gap = CHART_W / orders.length;
  const barWidth = gap * 0.6;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        style={{ minWidth: Math.max(orders.length * 16, 200) }}
        role="img"
        aria-label="注文ごとの支払い内訳グラフ"
      >
        <title>注文ごとの支払い内訳</title>

        {/* Y軸グリッド */}
        {yTicks.map((fraction) => {
          const y = PADDING.top + CHART_H * (1 - fraction);
          const label =
            fraction === 0
              ? "0"
              : `¥${Math.round(maxVal * fraction).toLocaleString()}`;
          return (
            <g key={fraction}>
              <line
                x1={PADDING.left}
                x2={PADDING.left + CHART_W}
                y1={y}
                y2={y}
                stroke="#f3f4f6"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 4}
                y={y + 3}
                textAnchor="end"
                fontSize={8}
                fill="#9ca3af"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* バー */}
        {orders.map((row, i) => {
          const x = PADDING.left + i * gap + gap * 0.2;
          const cashH = (row.cashPaid / maxVal) * CHART_H;
          const ptH = (row.pointsUsed / maxVal) * CHART_H;
          const totalH = cashH + ptH;

          return (
            <g key={row.index}>
              {/* ポイント使用セグメント（上、琥珀） */}
              {row.pointsUsed > 0 && (
                <rect
                  x={x}
                  y={PADDING.top + CHART_H - totalH}
                  width={barWidth}
                  height={ptH}
                  fill="#f59e0b"
                  rx={2}
                />
              )}
              {/* 現金支払いセグメント（下、青） */}
              <rect
                x={x}
                y={PADDING.top + CHART_H - cashH}
                width={barWidth}
                height={cashH}
                fill={row.eligible ? "#2563eb" : "#93c5fd"}
                rx={row.pointsUsed > 0 ? 0 : 2}
              />
              {/* X軸ラベル */}
              <text
                x={x + barWidth / 2}
                y={HEIGHT - 4}
                textAnchor="middle"
                fontSize={9}
                fill="#6b7280"
              >
                {row.index}
              </text>
            </g>
          );
        })}

        {/* Y軸ベースライン */}
        <line
          x1={PADDING.left}
          x2={PADDING.left}
          y1={PADDING.top}
          y2={PADDING.top + CHART_H}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
