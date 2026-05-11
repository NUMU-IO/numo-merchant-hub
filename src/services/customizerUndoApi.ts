/**
 * Customizer server-undo entries — Phase 6.
 *
 * Replaces the client-side 50-FIFO with a server-persisted stack so
 * tab close + reopen preserves history. The customizer store calls
 * append() on each action and remove() when an undo is applied; on
 * mount it calls list() to rehydrate the stack.
 */

import { apiClient } from "./api";

export interface UndoEntry {
  id: string;
  theme_id: string;
  action_label: string;
  forward: Record<string, unknown>;
  inverse: Record<string, unknown>;
  created_at: string;
}

const base = (storeId: string) =>
  `/api/v1/stores/${storeId}/themes/v3/undo`;

export async function listUndoEntries(
  storeId: string,
  themeId: string,
): Promise<UndoEntry[]> {
  const qs = new URLSearchParams({ theme_id: themeId }).toString();
  return apiClient<UndoEntry[]>(`${base(storeId)}?${qs}`);
}

export async function appendUndoEntry(
  storeId: string,
  payload: {
    theme_id: string;
    action_label: string;
    forward: Record<string, unknown>;
    inverse: Record<string, unknown>;
  },
): Promise<UndoEntry> {
  return apiClient<UndoEntry>(base(storeId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteUndoEntry(
  storeId: string,
  entryId: string,
): Promise<void> {
  await apiClient<{ id: string }>(`${base(storeId)}/${entryId}`, {
    method: "DELETE",
  });
}

export async function clearUndoStack(
  storeId: string,
  themeId: string,
): Promise<number> {
  const qs = new URLSearchParams({ theme_id: themeId }).toString();
  const res = await apiClient<{ deleted: number }>(
    `${base(storeId)}?${qs}`,
    { method: "DELETE" },
  );
  return res?.deleted ?? 0;
}
