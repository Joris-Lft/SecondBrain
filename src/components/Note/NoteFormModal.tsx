import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, CornerUpLeft } from "lucide-react";
import type { Note, NoteFormInput } from "@/types/notes";
import { TagList, TagSelect } from "@/components/Tag/Tag";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Textarea } from "@/components/ui/Input";
import { Markdown } from "@/components/ui/Markdown";
import type { WikiLinkOptions } from "@/components/ui/WikiLink";
import { Modal, ModalActions } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { NoteLinkCandidate } from "@/hooks/use-note-links";
import {
  optionId,
  useWikiLinkAutocomplete,
} from "@/hooks/use-wikilink-autocomplete";
import { WikiLinkSuggestions } from "./WikiLinkSuggestions";
import { isImageAttachment } from "@/utils/attachments";
import { deriveNoteTitle } from "@/utils/notes";
import { mergeOptions, resolveOptionLabel } from "@/utils/options";
import { uploadImageFiles } from "@/utils/upload-image";
import styles from "./NoteFormModal.module.css";

interface NoteFormModalProps {
  isVisible: boolean;
  initialNote?: Note;
  availableTags?: string[];
  onClose: () => void;
  /** Retourner `false` annule l'enregistrement et laisse la modale en édition. */
  onSubmit: (value: NoteFormInput) => void | boolean | Promise<void | boolean>;
  /**
   * Validation demandée AVANT l'upload des images (retourner `false` annule) :
   * annuler après coup laisserait des images orphelines chez l'hébergeur.
   */
  onBeforeSubmit?: (content: string) => boolean | Promise<boolean>;
  onDelete?: () => void | Promise<void>;
  isSubmitting?: boolean;
  isDeleting?: boolean;
  /** Active les liens `[[...]]` dans le rendu markdown de la note. */
  wikiLinks?: WikiLinkOptions;
  /** Notes qui pointent vers celle-ci. */
  backlinks?: NoteLinkCandidate[];
  /** Notes proposées par l'autocomplétion `[[`. */
  noteCandidates?: NoteLinkCandidate[];
  onNavigateToNote?: (noteId: string) => void;
  /** Retour à la note précédente de la pile de navigation. */
  onBack?: () => void;
  backLabel?: string;
}

type PendingImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type ModalMode = "view" | "edit";

function NoteFormModalContent({
  initialNote,
  availableTags = [],
  onClose,
  onSubmit,
  onBeforeSubmit,
  onDelete,
  isSubmitting = false,
  isDeleting = false,
  wikiLinks,
  backlinks = [],
  noteCandidates = [],
  onNavigateToNote,
  onBack,
  backLabel,
}: Omit<NoteFormModalProps, "isVisible">) {
  const isExistingNote = !!initialNote;
  const [mode, setMode] = useState<ModalMode>(isExistingNote ? "view" : "edit");
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const [content, setContent] = useState(() => initialNote?.content ?? "");
  const [keptAttachmentUrls, setKeptAttachmentUrls] = useState<string[]>(() =>
    initialNote ? initialNote.attachments.map((a) => a.url) : [],
  );
  const [tags, setTags] = useState<string[]>(() => initialNote?.tags ?? []);
  /** Tags créés pendant l'édition : proposés tout de suite, écrits sur la note à l'enregistrement. */
  const [createdTags, setCreatedTags] = useState<string[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsId = `${useId()}-wikilinks`;
  const autocomplete = useWikiLinkAutocomplete({
    value: content,
    onChange: setContent,
    textareaRef,
    candidates: noteCandidates,
    currentNoteId: initialNote?.id,
  });

  const tagOptions = mergeOptions(
    availableTags,
    initialNote?.tags ?? [],
    createdTags,
  );

  const handleCreateTag = (label: string) => {
    const tag = resolveOptionLabel(tagOptions, label);
    if (!tag) return;

    if (!tagOptions.includes(tag)) setCreatedTags((prev) => [...prev, tag]);
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  };

  useEffect(() => {
    return () => {
      pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [pendingImages]);

  const handleClose = () => {
    pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    onClose();
  };

  const handleCancelEdit = () => {
    if (isExistingNote) {
      setContent(initialNote.content);
      setKeptAttachmentUrls(initialNote.attachments.map((a) => a.url));
      setTags(initialNote.tags);
      setCreatedTags([]);
      pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setPendingImages([]);
      setError(null);
      setMode("view");
      return;
    }

    handleClose();
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (files.length === 0) return;

    const next = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingImages((prev) => [...prev, ...next]);
    event.target.value = "";
  };

  const removePendingImage = (id: string) => {
    setPendingImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((image) => image.id !== id);
    });
  };

  const removeKeptAttachment = (url: string) => {
    setKeptAttachmentUrls((prev) => prev.filter((item) => item !== url));
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("Veuillez saisir le contenu de la note");
      return;
    }

    try {
      setError(null);

      // Avant tout upload : une annulation ici ne coûte rien.
      if (onBeforeSubmit && (await onBeforeSubmit(content.trim())) === false) {
        return;
      }

      const uploadedUrls = await uploadImageFiles(
        pendingImages.map((image) => image.file),
      );

      const result = await onSubmit({
        content: content.trim(),
        attachmentUrls: [...keptAttachmentUrls, ...uploadedUrls],
        tags,
      });

      // L'appelant a annulé (ex. confirmation de changement de titre refusée).
      if (result === false) return;

      pendingImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : isExistingNote
            ? "Impossible de modifier la note"
            : "Impossible de créer la note";
      setError(message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;

    try {
      setError(null);
      await onDelete();
      setIsDeleteModalVisible(false);
    } catch (deleteError) {
      setIsDeleteModalVisible(false);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer la note",
      );
    }
  };

  const formattedDate = initialNote?.createdAt
    ? new Date(initialNote.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  const imageAttachments =
    initialNote?.attachments.filter(isImageAttachment) ?? [];

  const title =
    mode === "view"
      ? initialNote
        ? deriveNoteTitle(initialNote)
        : "Note"
      : isExistingNote
        ? "Modifier la note"
        : "Nouvelle note";

  const noteBadge =
    mode === "view" && initialNote && initialNote.noteNumber > 0 ? (
      <span className={styles.noteNumber}>#{initialNote.noteNumber}</span>
    ) : undefined;

  return (
    <>
    <Modal
      open
      portal
      variant="drawer"
      onClose={handleClose}
      title={title}
      titleId="note-modal-title"
      titleExtra={noteBadge}
      footer={
        mode === "view" && initialNote ? (
          <>
            <Button variant="secondary" fullWidth onClick={handleClose}>
              Fermer
            </Button>
            <Button fullWidth onClick={() => setMode("edit")}>
              Modifier
            </Button>
          </>
        ) : (
          <ModalActions
            cancelLabel={isExistingNote ? "Retour" : "Annuler"}
            submitLabel={
              isSubmitting
                ? isExistingNote
                  ? "Enregistrement..."
                  : "Création..."
                : isExistingNote
                  ? "Enregistrer"
                  : "Créer"
            }
            onCancel={handleCancelEdit}
            onSubmit={() => void handleSubmit()}
            loading={isSubmitting}
            submitDisabled={isSubmitting || isDeleting}
            onDelete={
              isExistingNote && onDelete
                ? () => setIsDeleteModalVisible(true)
                : undefined
            }
            deleteLoading={isDeleting}
          />
        )
      }
    >
      {mode === "view" && initialNote ? (
        <div className={styles.readBody}>
          {onBack && (
            <button type="button" className={styles.backRow} onClick={onBack}>
              <ChevronLeft size={14} aria-hidden />
              {backLabel ? `Retour à « ${backLabel} »` : "Retour"}
            </button>
          )}

          {formattedDate && (
            <time className={styles.readMeta} dateTime={initialNote.createdAt}>
              {formattedDate}
            </time>
          )}

          {initialNote.content ? (
            <Markdown className={styles.readContent} wikiLinks={wikiLinks}>
              {initialNote.content}
            </Markdown>
          ) : (
            <p className={styles.readContent}>—</p>
          )}

          {initialNote.tags.length > 0 && (
            <TagList tags={initialNote.tags} />
          )}

          {imageAttachments.length > 0 && (
            <div className={styles.readGallery}>
              {imageAttachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.readImageLink}
                >
                  <img
                    src={attachment.url}
                    alt={attachment.filename}
                    className={styles.readImage}
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          )}

          {backlinks.length > 0 && onNavigateToNote && (
            <section className={styles.backlinks}>
              <h3 className={styles.backlinksTitle}>
                <CornerUpLeft size={14} aria-hidden />
                Liens entrants ({backlinks.length})
              </h3>
              <ul className={styles.backlinksList}>
                {backlinks.map((source) => (
                  <li key={source.id}>
                    <button
                      type="button"
                      className={styles.backlinkItem}
                      onClick={() => onNavigateToNote(source.id)}
                    >
                      {source.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <>
          <FormField
            label="Contenu"
            htmlFor="note-content"
            hint="Markdown supporté. Tapez « [[ » pour lier une autre note."
            error={error}
          >
            <Textarea
              id="note-content"
              ref={textareaRef}
              placeholder="Écrivez votre note..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (error) setError(null);
                autocomplete.syncFromCaret();
              }}
              onKeyUp={autocomplete.syncFromCaret}
              onClick={autocomplete.syncFromCaret}
              onBlur={autocomplete.close}
              onKeyDown={autocomplete.handleKeyDown}
              rows={5}
              role="combobox"
              aria-expanded={autocomplete.isOpen}
              aria-controls={autocomplete.isOpen ? suggestionsId : undefined}
              aria-activedescendant={
                autocomplete.isOpen
                  ? optionId(suggestionsId, autocomplete.activeIndex)
                  : undefined
              }
              aria-autocomplete="list"
            />
          </FormField>

          {autocomplete.isOpen && (
            <WikiLinkSuggestions
              id={suggestionsId}
              suggestions={autocomplete.suggestions}
              activeIndex={autocomplete.activeIndex}
              onHighlight={autocomplete.setActiveIndex}
              onSelect={autocomplete.insert}
            />
          )}

          <div className={styles.imagesSection}>
            <span className={styles.sectionLabel}>Images</span>
            <p className={styles.hint}>
              Formats acceptés : JPG, PNG, GIF, WebP…
            </p>

            <label className={styles.fileInputLabel}>
              Ajouter des images
              <input
                type="file"
                accept="image/*"
                multiple
                className={styles.fileInput}
                onChange={handleImageSelect}
                disabled={isSubmitting}
              />
            </label>

            {(keptAttachmentUrls.length > 0 || pendingImages.length > 0) && (
              <div className={styles.imagePreviewGrid}>
                {keptAttachmentUrls.map((url) => (
                  <div key={url} className={styles.imagePreviewItem}>
                    <img src={url} alt="" className={styles.imagePreview} />
                    <button
                      type="button"
                      className={styles.removeImageButton}
                      onClick={() => removeKeptAttachment(url)}
                      aria-label="Retirer l'image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {pendingImages.map((image) => (
                  <div key={image.id} className={styles.imagePreviewItem}>
                    <img
                      src={image.previewUrl}
                      alt=""
                      className={styles.imagePreview}
                    />
                    <button
                      type="button"
                      className={styles.removeImageButton}
                      onClick={() => removePendingImage(image.id)}
                      aria-label="Retirer l'image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <FormField
            label="Tags"
            hint="Sélectionnez un tag existant ou créez le vôtre"
          >
            <TagSelect
              options={tagOptions}
              value={tags}
              onChange={setTags}
              disabled={isSubmitting}
              onCreate={handleCreateTag}
            />
          </FormField>

        </>
      )}
    </Modal>

      {isExistingNote && onDelete && (
        <ConfirmModal
          open={isDeleteModalVisible}
          loading={isDeleting}
          onClose={() => setIsDeleteModalVisible(false)}
          onConfirm={() => void handleConfirmDelete()}
          message="Voulez-vous vraiment supprimer cette note ? Cette action est irréversible."
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
        />
      )}
    </>
  );
}

export function NoteFormModal({
  isVisible,
  initialNote,
  ...props
}: NoteFormModalProps) {
  if (!isVisible) return null;

  return (
    <NoteFormModalContent
      key={initialNote?.id ?? "new-note"}
      initialNote={initialNote}
      {...props}
    />
  );
}
