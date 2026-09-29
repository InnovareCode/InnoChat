"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayNumber } from "@/components/lib/format-date";

type Point = { date: string; count: number };

/**
 * Gráfico de agendamentos por dia, últimos 30 dias (docs/design/premium-spec.md §8/§10) —
 * cores do tema via variável CSS (`var(--color-primary)`), nunca hex fixo do MultMarkets. Um
 * `ResponsiveContainer` porque o card em volta não tem largura fixa (shell sem `max-w`).
 */
export function InicioChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="inicio-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatDayNumber(value)}
          tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
          axisLine={{ stroke: "var(--color-border)" }}
          tickLine={false}
          interval={4}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-card)",
            fontSize: 12,
          }}
          labelFormatter={(value) => (typeof value === "string" ? formatDayNumber(value) : value)}
          formatter={(value) => [value, "agendamentos"]}
        />
        <Area type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} fill="url(#inicio-chart-fill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
