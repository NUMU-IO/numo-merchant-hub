import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

/* Dark-mode switch bound to next-themes. The Settings › Display switch used
   to read `document.documentElement.classList.contains("dark")` during
   render, so it never re-rendered on change and could disagree with the
   header toggle. Both now share one source of truth. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Switch
      className={className}
      checked={resolvedTheme === "dark"}
      onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
    />
  );
}
