import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      /* Souq toast — navy pill with white text + saffron action button,
         per NHUB `.toast` spec (navy bg, saffron-tinted icon, 999px
         radius, soft pop shadow). Description sits in a muted white,
         destructive variant gets the danger color, success gets sage. */
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-navy group-[.toaster]:text-white group-[.toaster]:border-navy-700 group-[.toaster]:rounded-2xl group-[.toaster]:shadow-pop group-[.toaster]:font-semibold",
          description: "group-[.toast]:text-white/70 group-[.toast]:font-medium",
          actionButton: "group-[.toast]:bg-saffron group-[.toast]:text-navy-900 group-[.toast]:font-bold group-[.toast]:rounded-xl",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white group-[.toast]:rounded-xl",
          success: "group-[.toaster]:text-white [&_[data-icon]]:text-sage",
          error: "group-[.toaster]:text-white [&_[data-icon]]:text-destructive",
          info: "group-[.toaster]:text-white [&_[data-icon]]:text-saffron",
          warning: "group-[.toaster]:text-white [&_[data-icon]]:text-warning",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
