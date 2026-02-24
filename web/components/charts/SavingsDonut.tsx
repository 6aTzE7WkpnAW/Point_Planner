import type { Summary } from "@/types";

interface Props {
  summary: Summary;
}

const R = 60;
const CX = 90;
const CY = 90;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function SavingsDonut({ summary }: Props) {
  const saved = summary.grossTotal - summary.cashTotal;
  const savingsRatio =
    summary.grossTotal > 0 ? saved / summary.grossTotal : 0;
  const cashRatio = 1 - savingsRatio;

  const cashArc = CIRCUMFERENCE * cashRatio;
  const savingsArc = CIRCUMFERENCE * savingsRatio;
  const discountPct = (savingsRatio * 100).toFixed(1);

  return (
    <svg
      viewBox="0 0 180 180"
      width="100%"
      style={{ maxWidth: 160 }}
      role="img"
      aria-label={`節約の内訳グラフ。割引率 ${discountPct}%`}
    >
      <title>節約の内訳</title>

      {/* 背景リング */}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={18}
      />

      {/* 現金セグメント（青） */}
      {cashRatio > 0 && (
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="#2563eb"
          strokeWidth={18}
          strokeDasharray={`${cashArc} ${CIRCUMFERENCE}`}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
      )}

      {/* 節約セグメント（緑） */}
      {savingsRatio > 0 && (
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="#10b981"
          strokeWidth={18}
          strokeDasharray={`${savingsArc} ${CIRCUMFERENCE}`}
          strokeDashoffset={-cashArc}
          transform={`rotate(-90 ${CX} ${CY})`}
        />
      )}

      {/* 中央テキスト: 割引率 */}
      <text
        x={CX}
        y={CY - 6}
        textAnchor="middle"
        fontSize={18}
        fontWeight="bold"
        fill="#111827"
      >
        {discountPct}%
      </text>
      <text
        x={CX}
        y={CY + 11}
        textAnchor="middle"
        fontSize={9}
        fill="#6b7280"
      >
        実質割引率
      </text>

      {/* 凡例テキスト */}
      <g transform="translate(10, 160)">
        <rect width={8} height={8} fill="#2563eb" rx={1} />
        <text x={12} y={7} fontSize={8} fill="#6b7280">
          現金 ¥{summary.cashTotal.toLocaleString()}
        </text>
      </g>
      <g transform="translate(10, 172)">
        <rect width={8} height={8} fill="#10b981" rx={1} />
        <text x={12} y={7} fontSize={8} fill="#6b7280">
          節約 ¥{saved.toLocaleString()}
        </text>
      </g>
    </svg>
  );
}
