import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * `cards`: under 640px every row becomes a stacked card and each cell is
 * labelled with its column header (copied into `data-label`, which the
 * `.tbl-cards` CSS in index.css prints before the value). Headers are read
 * from the DOM so pages don't have to repeat them per cell.
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & { cards?: boolean }
>(({ className, cards, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTableElement>(null);
  React.useImperativeHandle(ref, () => innerRef.current as HTMLTableElement);

  React.useEffect(() => {
    const table = innerRef.current;
    if (!cards || !table) return;
    const label = () => {
      const heads = Array.from(table.querySelectorAll("thead th"), (th) => th.textContent?.trim() ?? "");
      table.querySelectorAll("tbody tr").forEach((tr) => {
        Array.from(tr.children).forEach((cell, i) => {
          const text = heads[i];
          if (text && cell.getAttribute("data-label") !== text) cell.setAttribute("data-label", text);
        });
      });
    };
    label();
    // Rows arrive and change after mount (pagination, filters, language).
    const observer = new MutationObserver(label);
    observer.observe(table, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [cards]);

  return (
    <div className="relative w-full overflow-auto">
      <table
        ref={innerRef}
        className={cn("w-full caption-bottom text-sm", cards && "tbl-cards", className)}
        {...props}
      />
    </div>
  );
});
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
  ),
);
TableFooter.displayName = "TableFooter";

/* Souq table — warm cream hover row, tabular-friendly cells, eyebrow
   header (11px uppercase ink-faint), matches NHUB `.tbl` spec. */
const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("border-t border-border transition-colors data-[state=selected]:bg-muted hover:bg-muted/60", className)}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-11 px-4 text-start align-middle text-[11px] font-bold uppercase tracking-wider text-ink-faint [&:has([role=checkbox])]:pe-0",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn("px-4 py-3.5 align-middle text-[13.5px] [&:has([role=checkbox])]:pe-0", className)} {...props} />
  ),
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
