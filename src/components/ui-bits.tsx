import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-4">
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Btn({ children, onClick, variant = "ghost", disabled, active, className, title }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "outline"; disabled?: boolean; active?: boolean; className?: string; title?: string;
}) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" && "bg-primary text-primary-foreground shadow-[var(--shadow-primary)] hover:bg-primary/90",
        variant === "ghost" && "bg-secondary text-secondary-foreground hover:bg-accent",
        variant === "outline" && "border border-border bg-card text-foreground hover:bg-accent",
        active && "bg-foreground text-background hover:bg-foreground/90",
        className,
      )}>
      {children}
    </button>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-sm">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-primary" : "bg-input")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function Range({ label, value, min, max, step, onChange, fmt }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <label className="block text-sm">
      <div className="mb-1 flex justify-between"><span>{label}</span><span className="font-mono text-xs text-muted-foreground">{fmt ? fmt(value) : value}</span></div>
      <input type="range" className="w-full accent-[var(--primary)]" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-md bg-secondary p-0.5">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={cn("h-7 flex-1 rounded text-xs font-medium transition-colors", value === o.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        {value}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-border bg-transparent" />
      </span>
    </label>
  );
}
