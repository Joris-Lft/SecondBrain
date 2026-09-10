import { useCallback, useMemo, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { NoteCard } from "@/components/Note/NoteCard";
import { NoteFormModal } from "@/components/Note/NoteFormModal";
import { NoteGraphModal } from "@/components/Note/NoteGraphModal";
import { TagFilter } from "@/components/Tag/Tag";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { NotesPageSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/contexts/auth-context";
import type { NoteLinkCandidate } from "@/hooks/use-note-links";
import { useNoteLinks } from "@/hooks/use-note-links";
import {
  useCreateNote,
  useDeleteNote,
  useNoteTagOptions,
  useNotes,
  useUpdateNote,
} from "@/hooks/use-notes";
import type { Note, NoteFormInput } from "@/types/notes";
import { filterNotesByTags } from "@/utils/tags";
import { deriveNoteTitle, sortNotesByCreatedAt, titleKey } from "@/utils/notes";
import { backlinksBrokenByRename, countResolvedLinks } from "@/utils/wikilinks";
import styles from "./NotesPage.module.css";

interface TitleDriftPrompt {
  oldTitle: string;
  newTitle: string;
  sources: NoteLinkCandidate[];
}

export function NotesPage() {
  const { user } = useAuth();
  const { data: notes = [], isLoading, isError } = useNotes(user?.email);
  const availableTags = useNoteTagOptions(notes);
  const createNoteMutation = useCreateNote(user?.id, user?.email);
  const updateNoteMutation = useUpdateNote(user?.id, user?.email);
  const deleteNoteMutation = useDeleteNote(user?.email);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const noteLinks = useNoteLinks(notes);
  const { index, resolve, backlinksOf, titleOf } = noteLinks;

  const filteredNotes = useMemo(
    () => filterNotesByTags(notes, selectedTags),
    [notes, selectedTags],
  );

  // Précalculé une fois : sinon chaque carte reconstruit un Set à chaque rendu.
  const linkCounts = useMemo(
    () => new Map(notes.map((note) => [note.id, countResolvedLinks(index, note.id)])),
    [notes, index],
  );
  const visibleNotes = sortNotesByCreatedAt(filteredNotes);

  /** Pile de navigation entre notes liées ; le dernier id est la note affichée. */
  const [noteIdStack, setNoteIdStack] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [driftPrompt, setDriftPrompt] = useState<TitleDriftPrompt | null>(null);
  const [isConfirmingDrift, setIsConfirmingDrift] = useState(false);
  const driftDeciderRef = useRef<((confirmed: boolean) => void) | null>(null);

  // Pile nettoyée des notes disparues (supprimées, ou sorties du périmètre de
  // la requête) : pas besoin d'effet correctif, l'état invalide n'existe pas.
  const liveStack = useMemo(
    () => noteIdStack.filter((id) => notes.some((note) => note.id === id)),
    [noteIdStack, notes],
  );
  const openedNoteId = liveStack.at(-1);
  const previousNoteId = liveStack.at(-2);

  // Dérivée des données live : la note affichée reste à jour après un
  // enregistrement, contrairement à un instantané conservé en state.
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === openedNoteId),
    [notes, openedNoteId],
  );

  // La confirmation en attente compte comme un envoi en cours : sans ça le
  // bouton « Enregistrer » reste actif sous la modale de confirmation.
  const isSubmitting =
    isConfirmingDrift ||
    createNoteMutation.isPending ||
    updateNoteMutation.isPending ||
    deleteNoteMutation.isPending;
  const hasNotes = notes.length > 0;
  const hasFilteredNotes = visibleNotes.length > 0;
  const isEmpty = !isLoading && !isError && !hasNotes;
  const isFilterEmpty =
    !isLoading && !isError && hasNotes && selectedTags.length > 0 && !hasFilteredNotes;

  const navigateToNote = useCallback(
    (noteId: string) => {
      setFormError(null);
      setIsCreating(false);
      setNoteIdStack((stack) => {
        // Revenir sur une note déjà dans la pile la tronque au lieu d'empiler :
        // un aller-retour A→B→A→B… ne doit pas gonfler indéfiniment.
        const existing = stack.indexOf(noteId);
        if (existing !== -1) return stack.slice(0, existing + 1);
        return [...stack, noteId];
      });
    },
    [setFormError, setIsCreating, setNoteIdStack],
  );

  const wikiLinks = useMemo(
    () => ({
      resolve: (target: string) => resolve(target, openedNoteId),
      onNavigate: navigateToNote,
    }),
    [resolve, openedNoteId, navigateToNote],
  );

  const openCreateModal = () => {
    setFormError(null);
    setNoteIdStack([]);
    setIsCreating(true);
  };

  const openNote = (note: Note) => {
    setFormError(null);
    setIsCreating(false);
    setNoteIdStack([note.id]);
  };

  const goBack = () => setNoteIdStack(liveStack.slice(0, -1));

  const closeModal = () => {
    setNoteIdStack([]);
    setIsCreating(false);
  };

  const resolveDrift = (confirmed: boolean) => {
    driftDeciderRef.current?.(confirmed);
    driftDeciderRef.current = null;
    setIsConfirmingDrift(false);
    setDriftPrompt(null);
  };

  /** Prévient avant de casser les liens entrants en changeant le titre dérivé. */
  const confirmTitleDrift = (prompt: TitleDriftPrompt) =>
    new Promise<boolean>((resolvePromise) => {
      // Une confirmation déjà en attente est abandonnée plutôt qu'écrasée :
      // sinon sa promesse ne serait jamais résolue.
      driftDeciderRef.current?.(false);
      driftDeciderRef.current = resolvePromise;
      setIsConfirmingDrift(true);
      setDriftPrompt(prompt);
    });

  /**
   * Exécuté par la modale AVANT l'upload des images : annuler ici ne doit pas
   * laisser d'images orphelines chez l'hébergeur.
   */
  const confirmBeforeSubmit = async (content: string) => {
    if (!selectedNote) return true;

    const oldTitle = deriveNoteTitle(selectedNote);
    const newTitle = deriveNoteTitle({
      content,
      noteNumber: selectedNote.noteNumber,
    });
    if (titleKey(oldTitle) === titleKey(newTitle)) return true;

    // Seuls les liens écrits par titre cassent ; `[[#42]]` survit au renommage.
    const brokenSourceIds = backlinksBrokenByRename(
      index,
      selectedNote.id,
      oldTitle,
    );
    if (brokenSourceIds.length === 0) return true;

    return confirmTitleDrift({
      oldTitle,
      newTitle,
      sources: brokenSourceIds.map((id) => ({
        id,
        title: titleOf(id),
        noteNumber: 0,
      })),
    });
  };

  const handleSubmit = async (value: NoteFormInput) => {
    setFormError(null);

    try {
      if (selectedNote) {
        await updateNoteMutation.mutateAsync({ ...value, id: selectedNote.id });
        // Retour à la note d'où l'on venait, plutôt que fermeture sèche.
        setNoteIdStack(liveStack.slice(0, -1));
      } else {
        await createNoteMutation.mutateAsync(value);
        closeModal();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Enregistrement impossible";
      setFormError(message);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    setFormError(null);

    try {
      await deleteNoteMutation.mutateAsync(selectedNote.id);
      // Retour à la note d'où l'on venait, s'il y en a une.
      setNoteIdStack(liveStack.slice(0, -1));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Suppression impossible";
      setFormError(message);
      throw error;
    }
  };

  const isModalVisible = isCreating || !!selectedNote;

  return (
    <PageShell>
      <PageHeader
        title="Notes"
        align="center"
        actions={
          <>
            {hasNotes && (
              <Button
                pill
                variant="secondary"
                onClick={() => setIsGraphOpen(true)}
              >
                <Share2 size={16} aria-hidden /> Graphe
              </Button>
            )}
            <Button pill onClick={openCreateModal}>
              Nouvelle note
            </Button>
          </>
        }
      />

      {formError && <p className={styles.errorBanner}>{formError}</p>}

      {isLoading ? (
        <NotesPageSkeleton />
      ) : isError ? (
        <EmptyState>Impossible de charger les notes</EmptyState>
      ) : isEmpty ? (
        <EmptyState>Aucune note pour le moment</EmptyState>
      ) : (
        <>
          <TagFilter
            tags={availableTags}
            selectedTags={selectedTags}
            onChange={setSelectedTags}
          />

          {isFilterEmpty ? (
            <EmptyState>Aucune note ne correspond aux tags sélectionnés</EmptyState>
          ) : (
            <div className={styles.noteList}>
              {visibleNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onOpen={openNote}
                  resolveWikiLink={resolve}
                  linkCount={linkCounts.get(note.id) ?? 0}
                />
              ))}
            </div>
          )}
        </>
      )}

      {isModalVisible && user?.id && (
        <NoteFormModal
          isVisible={isModalVisible}
          initialNote={selectedNote}
          availableTags={availableTags}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onBeforeSubmit={confirmBeforeSubmit}
          onDelete={selectedNote ? handleDelete : undefined}
          isSubmitting={isSubmitting}
          isDeleting={deleteNoteMutation.isPending}
          wikiLinks={wikiLinks}
          backlinks={selectedNote ? backlinksOf(selectedNote.id) : undefined}
          noteCandidates={noteLinks.candidates}
          onNavigateToNote={navigateToNote}
          onBack={previousNoteId ? goBack : undefined}
          backLabel={previousNoteId ? titleOf(previousNoteId) : undefined}
        />
      )}

      {isGraphOpen && (
        <NoteGraphModal
          // Le graphe montre toujours toutes les notes, jamais le sous-ensemble filtré.
          notes={notes}
          links={noteLinks}
          onSelectNote={(noteId) => {
            setIsGraphOpen(false);
            setIsCreating(false);
            setNoteIdStack([noteId]);
          }}
          onSelectTag={(tag) => {
            setIsGraphOpen(false);
            setSelectedTags([tag]);
          }}
          onClose={() => setIsGraphOpen(false)}
        />
      )}

      <ConfirmModal
        open={!!driftPrompt}
        onClose={() => resolveDrift(false)}
        onConfirm={() => resolveDrift(true)}
        confirmLabel="Enregistrer quand même"
        cancelLabel="Annuler"
        message={
          driftPrompt && (
            <>
              Le titre de cette note va changer :<br />
              <strong>« {driftPrompt.oldTitle} »</strong> →{" "}
              <strong>« {driftPrompt.newTitle} »</strong>
              <br />
              <br />
              {driftPrompt.sources.length === 1
                ? "1 note pointe encore vers l'ancien titre"
                : `${driftPrompt.sources.length} notes pointent encore vers l'ancien titre`}{" "}
              et {driftPrompt.sources.length === 1 ? "son lien sera cassé" : "leurs liens seront cassés"} :
              <br />
              {driftPrompt.sources.map((source) => source.title).join(", ")}
            </>
          )
        }
      />
    </PageShell>
  );
}
