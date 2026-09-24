import { create } from "zustand";
import type { UpgradeDetails } from "@/services/entitlementsApi";

interface UpgradeDialogState {
  details: UpgradeDetails | null;
  open: (details: UpgradeDetails) => void;
  close: () => void;
}

export const useUpgradeDialog = create<UpgradeDialogState>((set) => ({
  details: null,
  open: (details) => set({ details }),
  close: () => set({ details: null }),
}));
