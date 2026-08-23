import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { FUNNEL_COLORS } from "./chart-palette";

export interface PieSlice {
  name: string;
  value: number;
}

interface Props {
  data: PieSlice[];
  locale?: string;
  /** Tooltip value formatter (defaults to the raw number). */
  formatValue?: (v: number) => string;
  height?: number;
}

const PALETTE = [
  "hsl(var(--navy))",
  "hsl(var(--saffron))",
  "hsl(var(--sage))",
  "hsl(var(--terracotta))",
  "hsl(var(--navy-700))",
  ...FUNNEL_COLORS.slice(5),
];

type LabelProps = {
  cx: number; cy: number; midAngle: number; outerRadius: number; percent: number; name: string; index: number;
};

/**
 * Zid-style breakdown pie: solid disc, outside "name: 12.3%" labels on
 * leader lines, dot legend underneath. Tiny slices (<3%) keep their
 * legend entry but skip the outside label so labels never overlap.
 */
export function BreakdownPie({ data, locale, formatValue, height = 240 }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmtPct = (p: number) =>
    `${(p * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  const renderLabel = (props: unknown) => {
    const { cx, cy, midAngle, outerRadius, percent, name, index } = props as LabelProps;
    if (percent < 0.03) return null;
    const RAD = Math.PI / 180;
    const r = outerRadius + 22;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    const anchor = x > cx ? "start" : "end";
    return (
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        dominantBaseline="central"
        className="fill-foreground"
        style={{ fontSize: 11.5, fontWeight: 600 }}
      >
        <tspan className="fill-muted-foreground" style={{ fontWeight: 500 }}>{name}: </tspan>
        <tspan fill={PALETTE[index % PALETTE.length]}>{fmtPct(percent)}</tspan>
      </text>
    );
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius="68%"
              dataKey="value"
              nameKey="name"
              isAnimationActive={false}
              label={renderLabel}
              labelLine={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              stroke="hsl(var(--card))"
              strokeWidth={1.5}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px" }}
              formatter={(value: number, name: string) => [
                `${formatValue ? formatValue(value) : value.toLocaleString(locale)} (${total > 0 ? fmtPct(value / total) : "0%"})`,
                name,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="text-[11px] text-muted-foreground">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BreakdownPie;
