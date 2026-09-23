import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

export type WeekDayPoint = {
  label: string;
  date: string;
  kcal: number;
};

export type WeekBarsChartProps = {
  days: WeekDayPoint[];
  target: number | null;
};

export default function WeekBarsChart({ days, target }: WeekBarsChartProps) {
  return (
    <div className="h-[200px] w-full md:h-[280px]" role="img" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeDasharray="0"
            horizontal={false}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)" }}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
            }}
            formatter={(value: number) => [`${Math.round(value)} kcal`, "Calories"]}
          />
          <Bar
            dataKey="kcal"
            fill="var(--color-macro-energy)"
            radius={[2, 2, 0, 0]}
            maxBarSize={48}
          />
          {target != null && target > 0 ? (
            <ReferenceLine
              y={target}
              stroke="var(--color-accent)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
