import { useState } from "react";
import { Mail, Info } from "lucide-react";
import { Button, Card, CardBody, Chip, Input, Textarea } from "../../../../../components/ui";
import { SCALE_LABELS } from "../lib/scale";
import { avg, one } from "../lib/metrics";

export const inputCls =
  "w-full border border-gray-300 rounded px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400";

export function Pill({ tone = "grey", children }) {
  const colorMap = {
    grey: "default",
    open: "primary",
    done: "success",
    warn: "danger",
  };
  return (
    <Chip size="sm" variant="flat" color={colorMap[tone] || "default"}>
      {children}
    </Chip>
  );
}

export function CardStat({ label, value, unit, note, hero }) {
  return (
    <Card className={`border ${hero ? "border-primary-300 bg-primary-50" : "border-gray-200"}`} shadow="none">
      <CardBody className="p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">{label}</div>
        <div className={`text-2xl font-bold tracking-tight ${hero ? "text-primary-700" : "text-gray-900"}`}>
          {value}
          {unit && <span className="text-sm font-medium text-gray-400">{unit}</span>}
        </div>
        {note && <div className="text-[11px] text-gray-500 mt-1">{note}</div>}
      </CardBody>
    </Card>
  );
}

export function Cards({ children }) {
  return (
    <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
      {children}
    </div>
  );
}

export function Section({ children }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mt-6 mb-3 pb-1.5 border-b border-gray-200">
      {children}
    </div>
  );
}

export function Screen({ id, title, sub, children }) {
  return (
    <Card shadow="none" className="border border-gray-200 mb-5">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-baseline gap-3 flex-wrap">
        {id && (
          <Chip size="sm" variant="flat" color="primary" className="font-mono text-[11px]">
            {id}
          </Chip>
        )}
        <span className="font-semibold text-[15px]">{title}</span>
        {sub && <span className="text-xs text-gray-500">{sub}</span>}
      </div>
      <CardBody className="p-4">{children}</CardBody>
    </Card>
  );
}

export function Field({ label, children }) {
  return (
    <div className="mb-3.5">
      {label && <label className="block text-xs font-semibold text-gray-800 mb-1.5">{label}</label>}
      {children}
    </div>
  );
}

export function Btn({ children, onClick, variant = "solid", size = "sm", disabled, color = "primary" }) {
  const heroVariant = variant === "ghost" || variant === "solid" ? "flat" : "bordered";
  const heroColor = variant === "ghost" ? "default" : color;
  return (
    <Button
      size={size}
      variant={heroVariant}
      color={heroColor}
      onPress={onClick}
      isDisabled={disabled}
      className={variant === "solid" ? "bg-primary text-white hover:bg-primary-600" : ""}
    >
      {children}
    </Button>
  );
}

export function BackLink({ onClick, children = "Back" }) {
  return (
    <button onClick={onClick} className="text-xs text-gray-500 hover:text-gray-800 mb-4 flex items-center gap-1">
      &larr; {children}
    </button>
  );
}

export function Scale({ value, onChange, compact }) {
  const [hover, setHover] = useState(null);
  const shown = hover || value;
  return (
    <div>
      <div className="flex gap-1.5 flex-wrap mt-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <Button
            key={n}
            size="sm"
            isIconOnly
            variant={value === n ? "solid" : "bordered"}
            color={value === n ? "primary" : "default"}
            onPress={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            title={`${n} — ${SCALE_LABELS[n - 1]}`}
            className={compact ? "w-8 h-8 min-w-0" : "w-9 h-9 min-w-0"}
          >
            {n}
          </Button>
        ))}
      </div>
      <div className="text-[11px] mt-1.5 h-4">
        {shown ? (
          <span className="text-primary-700 font-medium">
            {shown} — {SCALE_LABELS[shown - 1]}
          </span>
        ) : (
          <span className="text-gray-400">1 — Very Poor · 10 — Excellent</span>
        )}
      </div>
    </div>
  );
}

export function ScaleLegend() {
  return (
    <div className="border border-gray-200 rounded p-3 mb-5 bg-gray-50">
      <div className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-2">Rating scale</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-gray-600">
        {SCALE_LABELS.map((l, i) => (
          <span key={i}>
            <span className="font-semibold text-gray-800">{i + 1}</span> {l}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Distribution({ values, counts }) {
  const c = counts || Array.from({ length: 10 }, (_, i) => values.filter((v) => Math.round(v) === i + 1).length);
  const max = Math.max(...c, 1);
  return (
    <div>
      <div className="flex items-end gap-1.5 h-24">
        {c.map((cc, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="text-[10px] font-mono text-gray-400 mb-1">{cc || ""}</div>
            <div
              className={`w-full rounded-t ${cc === max && cc > 0 ? "bg-primary" : "bg-gray-200"}`}
              style={{ height: `${(cc / max) * 100}%`, minHeight: cc ? 4 : 1 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {c.map((_, i) => (
          <div key={i} className="flex-1 text-center text-[10px] font-mono text-gray-400">
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuestionAverages({ labels, rows, averages }) {
  const a = averages || labels.map((_, qi) => avg(rows.map((r) => r[qi]).filter((n) => typeof n === "number")));
  return (
    <div className="space-y-2.5">
      {labels.map((q, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="text-xs text-gray-600 flex-1 min-w-0 truncate" title={q}>
            {q}
          </div>
          <div className="w-40 h-2 bg-gray-100 rounded overflow-hidden">
            <div
              className={`h-full rounded ${a[i] < 7 ? "bg-red-400" : "bg-primary"}`}
              style={{ width: `${(a[i] / 10) * 100}%` }}
            />
          </div>
          <div className="w-9 text-right text-xs font-semibold">{a[i] ? one(a[i]) : "—"}</div>
        </div>
      ))}
    </div>
  );
}

export function EmailPreview({ to, subject, body }) {
  return (
    <Card shadow="none" className="border border-gray-300 bg-gray-50">
      <CardBody className="p-3 text-[13px]">
        <div className="font-mono text-[10.5px] text-gray-500 mb-1.5 flex items-center gap-1.5">
          <Mail size={12} /> To: {to}
        </div>
        <div className="font-mono text-[10.5px] text-gray-500 mb-2">Subject: {subject}</div>
        <div className="text-gray-700">{body}</div>
      </CardBody>
    </Card>
  );
}

export function Empty({ children }) {
  return (
    <div className="border border-dashed border-gray-300 rounded p-6 text-center text-xs text-gray-400 bg-gray-50">
      {children}
    </div>
  );
}

export function OpenPoint({ children }) {
  return (
    <div className="flex items-start gap-2 text-[11.5px] text-primary-800 bg-primary-50 border border-primary-200 rounded p-2.5 mt-3">
      <Info size={13} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function Thread({ messages }) {
  return (
    <div className="border-l-2 border-gray-200 pl-3.5 mb-4">
      {messages.map((m, i) => (
        <div key={i} className="mb-3.5">
          <div className="text-xs font-semibold">
            {m.who}
            <span className="font-normal text-gray-400 font-mono text-[10.5px] ml-2">{m.at}</span>
          </div>
          <div className="text-[13px] text-gray-600 mt-0.5">{m.text}</div>
        </div>
      ))}
    </div>
  );
}

export function ContextBar({ title, meta }) {
  return (
    <div className="border border-dashed border-gray-300 rounded p-3 mb-4 bg-gray-50">
      <div className="font-semibold text-sm">{title}</div>
      {meta && <div className="text-xs text-gray-500 mt-0.5">{meta}</div>}
    </div>
  );
}

export function THead({ cols }) {
  return (
    <thead>
      <tr className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
        {cols.map((c, i) => (
          <th key={i} className="text-left py-2 border-b border-gray-200 whitespace-nowrap">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}
