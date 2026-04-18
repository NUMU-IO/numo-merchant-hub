import { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import TrialPaywallModal, {
  PaywallReason,
} from "@/components/demo/TrialPaywallModal";
import DemoConvertModal from "@/components/demo/DemoConvertModal";

interface TrialPaywallContextValue {
  /**
   * Returns true if the caller may proceed with the gated action.
   * Returns false and shows the paywall modal if the current tenant is in
   * demo mode. Callers should early-return when this returns false.
   */
  requireTrial: (reason: PaywallReason) => boolean;
}

const TrialPaywallContext = createContext<TrialPaywallContextValue | null>(null);

export const TrialPaywallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isDemoMode } = useAuth();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [reason, setReason] = useState<PaywallReason>("generic");

  const requireTrial = useCallback(
    (nextReason: PaywallReason) => {
      if (!isDemoMode) return true;
      setReason(nextReason);
      setPaywallOpen(true);
      return false;
    },
    [isDemoMode]
  );

  return (
    <TrialPaywallContext.Provider value={{ requireTrial }}>
      {children}
      <TrialPaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        reason={reason}
        onUpgrade={() => setConvertOpen(true)}
      />
      <DemoConvertModal open={convertOpen} onOpenChange={setConvertOpen} />
    </TrialPaywallContext.Provider>
  );
};

export const useTrialPaywall = (): TrialPaywallContextValue => {
  const ctx = useContext(TrialPaywallContext);
  if (!ctx) {
    throw new Error("useTrialPaywall must be used inside TrialPaywallProvider");
  }
  return ctx;
};
