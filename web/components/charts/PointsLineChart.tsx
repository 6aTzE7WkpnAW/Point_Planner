import type { OrderRow } from "@/types";

interface Props {
  orders: OrderRow[];
}

const WIDTH = 600;
const HEIGHT = 160;
const PADDING = { top: 16, right: 16, bottom: 24, left: 52 };
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

export default function PointsLineChart({ orders }: Props) {
  const maxPts = Math.max(...orders.map((r) => r.pointsBalance), 1);

  const xScale = (i: number) =>
    PADDING.left + (orders.length <= 1 ? 0 : (i / (orders.length - 1)) * CHART_W);
  const yScale = (v: number) =>
    PADDING.top + CHART_H - (v / maxPts) * CHART_H;

  const linePoints = orders
    .map((r, i) => `${xScale(i)},${yScale(r.pointsBalance)}`)
    .join(" ");

  const areaPoints = [
    `${xScale(0)},${PADDING.top + CHART_H}`,
    ...orders.map((r, i) => `${xScale(i)},${yScale(r.pointsBalance)}`),
    `${xScale(orders.length - 1)},${PADDING.top + CHART_H}`,
  ].join(" ");

  const yTicks = [0, 0.5, 1.0];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label="ポイント残高推移グラフ"
    >
      <title>ポイント残高の推移</title>

      {/* Y軸グリッド */}
      {yTicks.map((fraction) => {
        const y = PADDING.top + CHART_H * (1 - fraction);
        const label =
          fraction === 0
            ? "0"
            : `${Math.round(maxPts * fraction).toLocaleString()}pt`;
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

      {/* 塗り潰しエリア */}
      <polygon points={areaPoints} fill="#dbeafe" opacity={0.6} />

      {/* 折れ線 */}
      <polyline
        points={linePoints}
        fill="none"
        stroke="#2563eb"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* データ点 */}
      {orders.map((r, i) => (
        <circle
          key={r.index}
          cx={xScale(i)}
          cy={yScale(r.pointsBalance)}
          r={3}
          fill="#2563eb"
          stroke="white"
          strokeWidth={1.5}
        />
      ))}

      {/* X軸ラベル（注文番号） */}
      {orders.map((r, i) => (
        <text
          key={r.index}
          x={xScale(i)}
          y={HEIGHT - 4}
          textAnchor="middle"
          fontSize={9}
          fill="#6b7280"
        >
          {r.index}
        </text>
      ))}

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
  );
}
