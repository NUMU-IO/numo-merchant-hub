/**
 * TanStack Query hooks for merchant notes (Layer-B authoring).
 * Server state lives here; the page stays declarative.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createNote,
  listNotes,
  type MerchantNote,
  type NoteInput,
  type NoteStatus,
  setNoteStatus,
  updateNote,
} from "./api";

const keys = {
  all: (storeId: string) => ["agent-notes", storeId] as const,
};

export function useNotes(storeId: string | undefined) {
  return useQuery<MerchantNote[]>({
    queryKey: keys.all(storeId ?? ""),
    queryFn: () => listNotes(storeId as string),
    enabled: !!storeId,
  });
}

export function useCreateNote(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteInput) => createNote(storeId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all(storeId) }),
  });
}

export function useUpdateNote(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<NoteInput> }) =>
      updateNote(storeId, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all(storeId) }),
  });
}

export function useSetNoteStatus(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: NoteStatus }) =>
      setNoteStatus(storeId, id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all(storeId) }),
  });
}
