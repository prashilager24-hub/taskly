import React, { Suspense } from "react";
import type { ApexOptions } from "apexcharts";

/* Shared chart styling for People Hub (ApexCharts, already used by this project), in the TapMind palette. */

const ReactApexChart = React.lazy(() => import("react-apexcharts"));

// brand orange, ink black, amber, emerald, sky
export const SERIES = ["#ff6a1f", "#141414", "#f59e0b", "#059669", "#0284c7"];

type Series = { key: string; label: string };
type Datum = Record<string, string | number>;

const base = (format?: (v: number) => string): ApexOptions => ({
  chart: { toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: false }, fontFamily: "Poppins, sans-serif", parentHeightOffset: 0 },
  colors: SERIES,
  dataLabels: { enabled: false },
  grid: { borderColor: "#e4e4e7", strokeDashArray: 0, padding: { left: 4, right: 8 } },
  legend: { position: "top", horizontalAlign: "left", fontSize: "12px", markers: { size: 5 } },
  tooltip: { y: { formatter: format ? (v: number) => format(v) : undefined } },
  xaxis: { axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: "#6a6a6a", fontSize: "12px" } } },
  yaxis: { labels: { style: { colors: "#6a6a6a", fontSize: "12px" }, formatter: format ? (v: number) => format(v) : undefined } },
});

function Chart(props: { type: "area" | "bar" | "donut"; options: ApexOptions; series: ApexOptions["series"]; height: number }) {
  return (
    <Suspense fallback={<div style={{ height: props.height }} />}>
      <ReactApexChart type={props.type} options={props.options} series={props.series} height={props.height} width="100%" />
    </Suspense>
  );
}

export function TrendChart({ data, x, series, height = 260, format, fit }: { data: Datum[]; x: string; series: Series[]; height?: number; format?: (v: number) => string; /** zoom the y-axis to the data range instead of starting at 0 */ fit?: boolean }) {
  const b = base(format);
  const options: ApexOptions = {
    ...b,
    stroke: { curve: "smooth", width: 2 },
    fill: { type: "gradient", gradient: { shadeIntensity: 0, opacityFrom: 0.28, opacityTo: 0, stops: [0, 100] } },
    legend: { ...b.legend, show: series.length > 1 },
    xaxis: { ...b.xaxis, categories: data.map((d) => d[x]) },
    yaxis: { ...(b.yaxis as object), forceNiceScale: true, min: fit ? undefined : 0 },
  };
  return <Chart type="area" height={height} options={options} series={series.map((s) => ({ name: s.label, data: data.map((d) => Number(d[s.key])) }))} />;
}

export function BarsChart({ data, x, series, height = 260, stacked, layout = "horizontal", format }: { data: Datum[]; x: string; series: Series[]; height?: number; stacked?: boolean; layout?: "horizontal" | "vertical"; format?: (v: number) => string }) {
  const vertical = layout === "vertical";
  const b = base(format);
  const options: ApexOptions = {
    ...b,
    chart: { ...b.chart, stacked },
    plotOptions: { bar: { horizontal: vertical, columnWidth: "55%", barHeight: "60%", borderRadius: 0 } },
    legend: { ...b.legend, show: series.length > 1 },
    grid: { ...b.grid, xaxis: { lines: { show: vertical } }, yaxis: { lines: { show: !vertical } } },
    // ApexCharts puts the value axis on x for horizontal bars, so the number formatter moves with it
    xaxis: { ...b.xaxis, categories: data.map((d) => d[x]), labels: { ...b.xaxis!.labels, formatter: vertical && format ? (v: string) => format(Number(v)) : undefined } },
    yaxis: vertical ? { labels: { style: { colors: "#6a6a6a", fontSize: "12px" }, maxWidth: 140 } } : b.yaxis,
  };
  return <Chart type="bar" height={height} options={options} series={series.map((s) => ({ name: s.label, data: data.map((d) => Number(d[s.key])) }))} />;
}

export function DonutChart({ data, height = 220, center, centerLabel }: { data: { name: string; value: number }[]; height?: number; center?: string; centerLabel?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const b = base();
  const options: ApexOptions = {
    ...b,
    labels: data.map((d) => d.name),
    legend: { show: false },
    stroke: { width: 2, colors: ["#ffffff"] },
    plotOptions: { pie: { donut: { size: "66%", labels: { show: false } } } },
  };
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <Chart type="donut" height={height} options={options} series={data.map((d) => d.value)} />
        {center && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold tabular-nums text-ink-900 dark:text-white">{center}</span>
            {centerLabel && <span className="text-xs text-ink-500">{centerLabel}</span>}
          </div>
        )}
      </div>
      <ul className="w-full flex-1 space-y-2.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
            <span className="flex-1 truncate text-ink-500 dark:text-ink-400">{d.name}</span>
            <span className="font-semibold tabular-nums">{d.value}</span>
            <span className="w-10 text-right text-xs tabular-nums text-ink-500">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
