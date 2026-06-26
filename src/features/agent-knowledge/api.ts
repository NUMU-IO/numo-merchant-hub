/**
 * Merchant notes/FAQ API client (spec 002, FR-004a).
 *
 * Talks to the store-scoped notes endpoints under `/stores/{storeId}/agent/notes`.
 * Reuses the Hub's central `apiClient` (CSRF, X-Tenant-Id, 401 refresh, error
 * envelope unwrapping). Notes feed the merchant's own Layer-B knowledge.
 */
import { apiClient } from "@/services/api";

export type NoteLocale = "en" | "ar";
export type NoteStatus = "published" | "retired";

export interface MerchantNote {
  id: string;
  title: string;
  locale: NoteLocale;
  status: NoteStatus;
  updated_at: string | null;
}

export interface NoteInput {
  title: string;
  body: string;
  locale: NoteLocale;
}

export async function listNotes(storeId: string): Promise<MerchantNote[]> {
  const res = await apiClient<{ notes: MerchantNote[] }>(
    `/stores/${storeId}/agent/notes`,
  );
  return res.notes ?? [];
}

export async function createNote(storeId: string, input: NoteInput) {
  return apiClient<{ id: string; status: NoteStatus }>(
    `/stores/${storeId}/agent/notes`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function updateNote(
  storeId: string,
  noteId: string,
  input: Partial<NoteInput>,
) {
  return apiClient<{ id: string; status: NoteStatus }>(
    `/stores/${storeId}/agent/notes/${noteId}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export async function setNoteStatus(
  storeId: string,
  noteId: string,
  status: NoteStatus,
) {
  return apiClient<{ id: string; status: NoteStatus }>(
    `/stores/${storeId}/agent/notes/${noteId}/retire`,
    { method: "POST", body: JSON.stringify({ status }) },
  );
}
