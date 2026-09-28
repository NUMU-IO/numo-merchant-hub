import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatMoney } from "@/lib/format-money";

/* Memoized so unrelated Dashboard renders (goal edits, polls) skip Recharts. */
const RevenueAreaChart = React.memo(function RevenueAreaChart({
  data,
  isAr,
}: {
  data: { day: string; revenue: number }[];
  isAr: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient
            id="colorRevenue"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="5%"
              stopColor="hsl(var(--navy))"
              stopOpacity={0.18}
            />
            <stop
              offset="95%"
              stopColor="hsl(var(--navy))"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 5"
          className="stroke-border/40"
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tick={{
            fill: "hsl(var(--muted-foreground))",
            fontSize: 10,
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{
            fill: "hsl(var(--muted-foreground))",
            fontSize: 10,
          }}
          axisLine={false}
          tickLine={false}
          width={45}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
            boxShadow: "var(--shadow-pop)",
            fontSize: "12px",
            padding: "8px 12px",
          }}
          formatter={(value: number) => [
            formatMoney(value * 100, { fromCents: true, locale: isAr ? "ar" : "en" }),
            isAr ? "الإيراد" : "Revenue",
          ]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="hsl(var(--navy))"
          fill="url(#colorRevenue)"
          strokeWidth={2.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

export default RevenueAreaChart;
