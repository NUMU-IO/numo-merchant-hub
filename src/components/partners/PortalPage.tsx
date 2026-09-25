import type { ReactNode } from "react";

/** The portal's page frame: title + subtitle at the start, the page's main action
 *  at the end, content below. */
export function Page({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 sm:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}


export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

