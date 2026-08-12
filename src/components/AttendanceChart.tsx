import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { minutesToLabel, type DayRecord } from "@/lib/attendance";

type Point = {
  day: number;
  date: string;
  firstIn: number | null;
  lastOut: number | null;
  total: number;
};

const TICKS = [0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320, 1440];

function TooltipCard({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]!.payload;
  const d = new Date(p.date + "T00:00:00");
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-popover-foreground">
        {d.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
      </div>
      <dl className="mt-1.5 space-y-0.5 text-muted-foreground">
        <div className="flex justify-between gap-6">
          <dt>First In</dt>
          <dd className="tabular text-chart-in">{minutesToLabel(p.firstIn)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt>Last Out</dt>
          <dd className="tabular text-chart-out">{minutesToLabel(p.lastOut)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt>Total punches</dt>
          <dd className="tabular text-foreground">{p.total}</dd>
        </div>
      </dl>
      {p.total === 0 ? <div className="mt-1 text-[11px] text-muted-foreground">No punches recorded</div> : null}
    </div>
  );
}

export function AttendanceChart({ series, height = 340 }: { series: DayRecord[]; height?: number }) {
  const data = useMemo<Point[]>(
    () =>
      series.map((d) => ({
        day: d.day,
        date: d.date,
        firstIn: d.firstIn,
        lastOut: d.lastOut,
        total: d.total,
      })),
    [series],
  );

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
            minTickGap={0}
            padding={{ left: 6, right: 6 }}
          />
          <YAxis
            type="number"
            domain={[0, 1440]}
            ticks={TICKS}
            tickFormatter={(v: number) => `${String(Math.floor(v / 60)).padStart(2, "0")}:00`}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            width={52}
          />
          <Tooltip content={<TooltipCard />} />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            name="First In"
            dataKey="firstIn"
            stroke="var(--chart-in)"
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: "var(--chart-in)" }}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            name="Last Out"
            dataKey="lastOut"
            stroke="var(--chart-out)"
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: "var(--chart-out)" }}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
