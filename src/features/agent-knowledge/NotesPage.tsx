/**
 * NotesPage — the merchant's own notes/FAQ surface (spec 002, FR-004a).
 *
 * Notes the merchant writes here are indexed into their private Layer-B knowledge
 * so the NUMU Agent can answer questions about THEIR store ("what's my return
 * policy?"). Fully RTL-aware and bilingual (EN / Egyptian Arabic).
 */
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

import type { MerchantNote, NoteInput } from "./api";
import { NoteEditor } from "./NoteEditor";
import {
  useCreateNote,
  useNotes,
  useSetNoteStatus,
  useUpdateNote,
} from "./store";

function currentStoreId(): string {
  return localStorage.getItem("numu-current-store") ?? "";
}

export function NotesPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const storeId = currentStoreId();

  const { data: notes = [], isLoading } = useNotes(storeId);
  const createNote = useCreateNote(storeId);
  const updateNote = useUpdateNote(storeId);
  const setStatus = useSetNoteStatus(storeId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<MerchantNote | undefined>();

  const onSubmit = (input: NoteInput) => {
    if (editing) {
      updateNote.mutate({ id: editing.id, input }, { onSuccess: () => setEditorOpen(false) });
    } else {
      createNote.mutate(input, { onSuccess: () => setEditorOpen(false) });
    }
  };

  return (
    <div className="space-y-6 p-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("agentNotes.heading")}</h1>
          <p className="text-sm text-muted-foreground">{t("agentNotes.subheading")}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined);
            setEditorOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          {t("agentNotes.new")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : notes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("agentNotes.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{note.title}</CardTitle>
                <Badge variant={note.status === "published" ? "default" : "secondary"}>
                  {t(`agentNotes.status.${note.status}`)}
                </Badge>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(note);
                    setEditorOpen(true);
                  }}
                >
                  {t("common.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setStatus.mutate({
                      id: note.id,
                      status: note.status === "published" ? "retired" : "published",
                    })
                  }
                >
                  {note.status === "published"
                    ? t("agentNotes.retire")
                    : t("agentNotes.restore")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NoteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editing}
        saving={createNote.isPending || updateNote.isPending}
        onSubmit={onSubmit}
      />
    </div>
  );
}

export default NotesPage;
