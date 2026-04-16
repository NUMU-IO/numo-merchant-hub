import { apiClient } from "@/services/api";

export interface CatalogSyncStatus {
  status: "idle" | "syncing" | "completed" | "failed";
  last_synced_at: string | null;
  items_synced: number;
  errors: string[];
}

export async function syncCatalog(storeId: string, connectionId: string): Promise<{ task_id: string }> {
  return apiClient(`/stores/${storeId}/channels/${connectionId}/catalog/sync`, {
    method: "POST",
  });
}

export async function getSyncStatus(
  storeId: string,
  connectionId: string,
): Promise<CatalogSyncStatus> {
  return apiClient(`/stores/${storeId}/channels/${connectionId}/catalog/status`);
}