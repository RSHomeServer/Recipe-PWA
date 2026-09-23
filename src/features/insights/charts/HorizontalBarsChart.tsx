import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type HorizontalBarRow = {
  label: string;
  kcal: number;
  colour: string;
};

export type HorizontalBarsChartProps = {
  rows: HorizontalBarRow[];
};

export default function HorizontalBarsChart({ rows }: HorizontalBarsChartProps) {
  const data = rows.filter((r) => r.kcal > 0);
  if (data.length === 0) {
    return (
      <p className="text-base text-muted-foreground">Nothing to chart yet.</p>
    );
  }

  const height = Math.max(160, data.length * 36 + 24);

  return (
    <div
      className="w-full md:min-h-[200px]"
      style={{ height }}
      role="img"
      aria-hidden="true"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-foreground)", fontSize: 12 }}
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
          <Bar dataKey="kcal" radius={[0, 2, 2, 0]} maxBarSize={20}>
            {data.map((row) => (
              <Cell key={row.label} fill={row.colour} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
