import type { ArcCellState } from "@/utils/arc-table";

/** Libellés humains d'un état de case de l'arc, partagés par la case et son popover. */
export const CELL_STATE_LABELS: Record<ArcCellState, string> = {
  done: "fait",
  missed: "non fait",
  future: "à venir",
  inactive: "habitude pas encore créée",
};
