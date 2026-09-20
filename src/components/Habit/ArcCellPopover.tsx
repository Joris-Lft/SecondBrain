import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { useToggleArcCell } from "@/hooks/use-habits";
import { CELL_STATE_LABELS } from "./arc-cell-state-labels";
import type { ArcCell } from "@/utils/arc-table";
import type { HabitFrequency } from "@/types/habits";
import styles from "./ArcCellPopover.module.css";

/** Marge minimale au bord de la fenêtre, et espace entre la case et le popover. */
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 6;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Position {
  top: number;
  left: number;
}

/**
 * Place le popover contre la case cliquée sans jamais déborder du viewport :
 * bascule au-dessus si la place manque en dessous, sinon se cale au plus près
 * du bord. `resizeSignal` déclenche un nouveau calcul quand le contenu change
 * de taille sans que `anchor` bouge (l'apparition du message d'erreur).
 */
function useAnchoredPosition(
  anchor: DOMRect,
  panelRef: React.RefObject<HTMLDivElement | null>,
  resizeSignal: unknown,
) {
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const { width, height } = panel.getBoundingClientRect();
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);

    let top = anchor.bottom + ANCHOR_GAP;
    if (top > maxTop) {
      const above = anchor.top - height - ANCHOR_GAP;
      // Le repli au-dessus n'est retenu que s'il tient vraiment dans la
      // fenêtre : rabattu de force au bord par le clamp final, il finirait
      // sinon à cheval sur la case cliquée plutôt qu'au-dessus.
      if (above >= VIEWPORT_MARGIN) top = above;
    }

    const left = anchor.left + anchor.width / 2 - width / 2;

    setPosition({
      top: Math.min(Math.max(top, VIEWPORT_MARGIN), maxTop),
      left: Math.min(Math.max(left, VIEWPORT_MARGIN), maxLeft),
    });
  }, [anchor, panelRef, resizeSignal]);

  return position;
}

/**
 * Ferme le popover sur Échap, tap/clic extérieur, défilement ou
 * redimensionnement, et piège `Tab` à l'intérieur du panneau.
 */
function useCloseOnOutsideInteraction(
  panelRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    // `pointerdown` plutôt que `mousedown` : couvre aussi le tap tactile.
    const handlePointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    // Capture plutôt que bulles : l'arc défile dans un conteneur interne, et
    // l'évènement `scroll` n'y remonte pas jusqu'à `window` autrement.
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [panelRef, onClose]);
}

/**
 * Déplace le focus sur le premier élément du panneau à l'ouverture, et le
 * restitue sur la case cliquée à la fermeture — quelle qu'en soit la cause
 * (Échap, clic extérieur, succès de la bascule) : tous ces chemins démontent
 * ce composant, donc le nettoyage de cet effet suffit à couvrir les trois.
 */
function useFocusManagement(
  panelRef: React.RefObject<HTMLDivElement | null>,
  trigger: HTMLButtonElement,
) {
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    return () => {
      if (trigger.isConnected) trigger.focus();
    };
  }, [panelRef, trigger]);
}

interface ArcCellPopoverProps {
  habitId: string;
  habitName: string;
  frequency: HabitFrequency;
  cell: ArcCell & { state: "done" | "missed" };
  /** Position de la case cliquée au moment du clic, en coordonnées viewport. */
  anchor: DOMRect;
  /** Bouton d'origine : reçoit le focus à la fermeture du popover. */
  trigger: HTMLButtonElement;
  userId: string | undefined;
  userEmail: string | undefined;
  onClose: () => void;
}

/**
 * Popover de rattrapage d'une case passée de l'arc : la case est trop petite
 * pour porter elle-même une bascule fiable (6 px de large, glissée au doigt
 * pendant le défilement), donc le clic ouvre ce panneau, et seul son bouton
 * déclenche l'écriture.
 */
export function ArcCellPopover({
  habitId,
  habitName,
  frequency,
  cell,
  anchor,
  trigger,
  userId,
  userEmail,
  onClose,
}: ArcCellPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const toggle = useToggleArcCell(userId, userEmail, frequency);

  const position = useAnchoredPosition(anchor, panelRef, toggle.isError);
  useCloseOnOutsideInteraction(panelRef, onClose);
  useFocusManagement(panelRef, trigger);

  const isDone = cell.state === "done";

  const handleToggle = () => {
    toggle.mutate(
      { habitId, periodKey: cell.periodKey, completed: isDone },
      { onSuccess: onClose },
    );
  };

  return createPortal(
    <div
      ref={panelRef}
      className={styles.popover}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${habitName}, ${cell.label}`}
    >
      <p className={styles.habit}>{habitName}</p>
      <p className={styles.date}>{cell.label}</p>
      <p className={styles.state}>État actuel : {CELL_STATE_LABELS[cell.state]}</p>

      <Button size="sm" loading={toggle.isPending} onClick={handleToggle}>
        {isDone ? "Marquer non fait" : "Marquer fait"}
      </Button>

      {toggle.isError && (
        <p className={styles.error} role="alert">
          Impossible d&apos;enregistrer la coche. Réessayez.
        </p>
      )}
    </div>,
    document.body,
  );
}
