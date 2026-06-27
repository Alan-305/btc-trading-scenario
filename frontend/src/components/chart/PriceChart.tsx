import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import type { ForecastPoint } from "../../types/scenario";

interface PricePoint {
  ts: string;
  price: number;
  type: "history" | "forecast";
}

interface PriceChartProps {
  history: PricePoint[];
  forecast: ForecastPoint[];
  entryLow: number;
  entryHigh: number;
  takeProfit: number[];
  stopLoss: number;
}

export function PriceChart({
  history,
  forecast,
  entryLow,
  entryHigh,
  takeProfit,
  stopLoss,
}: PriceChartProps) {
  const chartData: PricePoint[] = [
    ...history.map((h) => ({ ...h, type: "history" as const })),
    ...forecast.map((f) => ({
      ts: new Date(f.ts).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
      price: f.price,
      type: "forecast" as const,
    })),
  ];

  const historyData = chartData.filter((d) => d.type === "history");
  const forecastData = chartData.filter((d) => d.type === "forecast");
  const bridge =
    historyData.length > 0 && forecastData.length > 0
      ? [{ ...historyData[historyData.length - 1], type: "forecast" as const }, ...forecastData]
      : forecastData;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="ts" stroke="#94a3b8" tick={{ fontSize: 11 }} />
          <YAxis
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            domain={["auto", "auto"]}
            tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, "Price"]}
          />
          <ReferenceArea
            y1={entryLow}
            y2={entryHigh}
            fill="#3b82f6"
            fillOpacity={0.15}
            label={{ value: "Entry", fill: "#93c5fd", fontSize: 11 }}
          />
          {takeProfit.map((tp, i) => (
            <ReferenceLine
              key={`tp-${i}`}
              y={tp}
              stroke="#22c55e"
              strokeDasharray="4 4"
              label={{ value: `TP${i + 1}`, fill: "#86efac", fontSize: 10 }}
            />
          ))}
          <ReferenceLine
            y={stopLoss}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: "SL", fill: "#fca5a5", fontSize: 10 }}
          />
          <Line
            data={historyData}
            type="monotone"
            dataKey="price"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
            name="History"
          />
          <Line
            data={bridge}
            type="monotone"
            dataKey="price"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            name="Forecast"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
