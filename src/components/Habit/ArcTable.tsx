import { useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ARC_END, ARC_START } from "@/constants/arc";
import { useAuth } from "@/contexts/auth-context";
import { useArcTable } from "@/hooks/use-habits";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArcCellPopover } from "./ArcCellPopover";
import { CELL_STATE_LABELS } from "./arc-cell-state-labels";
import { completionKey } from "@/utils/arc-table";
import type { ArcCell, ArcSection, ArcTableModel } from "@/utils/arc-table";
import type { HabitFrequency } from "@/types/habits";
import styles from "./ArcTable.module.css";

const SECTION_TITLES: Record<HabitFrequency, string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
};

/** Largeur d'une case, en jours d'arc : la géométrie vit dans le CSS. */
function spanWidth(span: number): string {
  return `calc(var(--day-w) * ${span} + var(--gap) * ${span - 1})`;
}

function formatBound(day: string): string {
  return format(parseISO(day), "dd/MM");
}

function formatScore(score: number | null): string {
  return score === null ? "—" : `${score} %`;
}

/** Résumé de ligne pour les lecteurs d'écran : une seule annonce plutôt que le
 *  nom puis, une par une, la centaine de cases qui suivent. */
function rowSummary(name: string, score: number | null): string {
  return score === null
    ? `${name} : aucune période close`
    : `${name} : ${score} % de réussite sur l'arc`;
}

function scoreLabel(score: number | null): string {
  return score === null ? "Score : aucune période close" : `Score : ${score} %`;
}

/** Case sélectionnée : de quoi rouvrir son popover de rattrapage. */
interface SelectedCell {
  habitId: string;
  habitName: string;
  frequency: HabitFrequency;
  cell: ArcCell & { state: "done" | "missed" };
  anchor: DOMRect;
  /** Bouton d'origine : reçoit le focus quand le popover se referme. */
  trigger: HTMLButtonElement;
}

interface CellProps {
  cell: ArcCell;
  rowName: string;
  frequency: HabitFrequency;
  habitId: string;
  /** Clé (`completionKey`) de la case dont le popover est actuellement ouvert. */
  openCellKey: string | null;
  onSelect: (selection: SelectedCell) => void;
}

function Cell({ cell, rowName, frequency, habitId, openCellKey, onSelect }: CellProps) {
  const title = `${cell.label} · ${CELL_STATE_LABELS[cell.state]}`;

  // `future` et `inactive` ne portent aucune écriture possible : la case reste
  // un simple repère visuel, jamais un bouton.
  if (cell.state !== "done" && cell.state !== "missed") {
    return (
      <span
        className={`${styles.cell} ${styles[cell.state]}`}
        style={{ width: spanWidth(cell.span) }}
        title={title}
      />
    );
  }

  // Capturé dans une variable locale : une fois dans la fermeture `onClick`,
  // TypeScript ne conserve plus l'affinement de `cell.state` fait ci-dessus.
  const state = cell.state;

  return (
    <button
      type="button"
      className={`${styles.cell} ${styles[state]} ${styles.clickable}`}
      style={{ width: spanWidth(cell.span) }}
      aria-label={`${rowName}, ${cell.label}, ${CELL_STATE_LABELS[state]}`}
      aria-haspopup="dialog"
      aria-expanded={openCellKey === completionKey(habitId, cell.periodKey)}
      onClick={(event) =>
        onSelect({
          habitId,
          habitName: rowName,
          frequency,
          cell: { ...cell, state },
          anchor: event.currentTarget.getBoundingClientRect(),
          trigger: event.currentTarget,
        })
      }
    />
  );
}

function Section({
  section,
  openCellKey,
  onSelectCell,
}: {
  section: ArcSection;
  openCellKey: string | null;
  onSelectCell: (selection: SelectedCell) => void;
}) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>{SECTION_TITLES[section.frequency]}</p>

      {section.rows.map((row) => (
        <div key={row.habitId} className={styles.row}>
          <span className={styles.srOnly}>{rowSummary(row.name, row.score)}</span>
          <span className={styles.name} title={row.name}>
            {row.name}
          </span>
          <span className={styles.score} aria-label={scoreLabel(row.score)}>
            {formatScore(row.score)}
          </span>
          <span className={styles.cells}>
            {row.cells.map((cell) => (
              <Cell
                key={cell.periodKey}
                cell={cell}
                rowName={row.name}
                frequency={section.frequency}
                habitId={row.habitId}
                openCellKey={openCellKey}
                onSelect={onSelectCell}
              />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Amène la colonne du jour dans le champ de vision au premier affichage : sur
 * mobile, une trentaine de jours seulement tiennent à l'écran, et l'arc s'ouvre
 * sinon sur son premier jour.
 */
function useScrollToToday(todayIndex: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || hasScrolled.current || todayIndex < 0) return;

    hasScrolled.current = true;

    // Les largeurs vivent dans le CSS : on les relit plutôt que de les
    // dupliquer ici, où elles se désaligneraient au premier ajustement.
    const computed = getComputedStyle(element.firstElementChild ?? element);
    const px = (name: string) => parseFloat(computed.getPropertyValue(name)) || 0;

    const offset =
      px("--name-w") +
      px("--score-w") +
      (px("--day-w") + px("--gap")) * todayIndex;

    // Le jour se cale aux deux tiers de la fenêtre : la suite de l'arc reste
    // visible, et l'historique récent aussi.
    element.scrollLeft = offset - element.clientWidth * 0.66;
  }, [todayIndex]);

  return scrollRef;
}

function Grid({
  table,
  openCellKey,
  onSelectCell,
}: {
  table: ArcTableModel;
  openCellKey: string | null;
  onSelectCell: (selection: SelectedCell) => void;
}) {
  const scrollRef = useScrollToToday(table.todayIndex);

  return (
    <div className={styles.scroll} ref={scrollRef}>
      <div className={styles.grid}>
        {/* Un trait continu plutôt qu'une case surlignée par ligne : sur une
            vingtaine de lignes, il se suit bien mieux. */}
        {table.todayIndex >= 0 && (
          <span
            className={styles.todayLine}
            style={{
              left: `calc(var(--name-w) + var(--score-w) + (var(--day-w) + var(--gap)) * ${table.todayIndex})`,
            }}
          />
        )}

        <div className={styles.monthRow} aria-hidden>
          <span className={styles.monthSpacer} />
          {table.months.map((month) => (
            <span
              key={month.key}
              className={styles.month}
              // `+ var(--gap)` : la case suivante commence après la gouttière.
              style={{ width: `calc(${spanWidth(month.span)} + var(--gap))` }}
            >
              <span className={styles.monthLabel}>{month.label}</span>
            </span>
          ))}
        </div>

        {table.sections.map((section) => (
          <Section
            key={section.frequency}
            section={section}
            openCellKey={openCellKey}
            onSelectCell={onSelectCell}
          />
        ))}
      </div>
    </div>
  );
}

/** Le winter arc en tableau : une colonne par jour, une ligne par habitude. */
export function ArcTable() {
  const { user } = useAuth();
  const { table, isLoading, isLoadingError } = useArcTable(user?.email);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  // Identité stable : sans elle, le popover réabonne ses quatre écouteurs
  // (Échap, clic extérieur, scroll, resize) à chaque rendu d'`ArcTable`.
  const closePopover = useCallback(() => setSelectedCell(null), []);

  if (!isLoading && !isLoadingError && table?.sections.length === 0) return null;

  const openCellKey = selectedCell
    ? completionKey(selectedCell.habitId, selectedCell.cell.periodKey)
    : null;

  return (
    <section className={styles.container}>
      <div className={styles.card}>
        <div className={styles.head}>
          <h2 className={styles.title}>Winter arc</h2>
          <p className={styles.subtitle}>
            {formatBound(ARC_START)} → {formatBound(ARC_END)} · une colonne par jour
          </p>
        </div>

        {isLoading ? (
          <div className={styles.head}>
            <Skeleton variant="block" height={220} />
          </div>
        ) : isLoadingError || !table ? (
          <p className={styles.error} role="alert">
            Impossible de charger l&apos;historique de l&apos;arc.
          </p>
        ) : (
          <>
            <Grid table={table} openCellKey={openCellKey} onSelectCell={setSelectedCell} />

            <p className={styles.legend}>
              <span className={styles.swatch} />
              <span>non fait</span>
              <span className={`${styles.swatch} ${styles.done}`} />
              <span>fait</span>
              <span className={`${styles.swatch} ${styles.future}`} />
              <span>à venir</span>
              <span className={`${styles.swatch} ${styles.inactive}`} />
              <span>pas encore créée</span>
              <span>· le trait marque aujourd&apos;hui</span>
              <span>· le % ignore la période en cours</span>
            </p>
          </>
        )}
      </div>

      {selectedCell && (
        <ArcCellPopover
          key={openCellKey}
          habitId={selectedCell.habitId}
          habitName={selectedCell.habitName}
          frequency={selectedCell.frequency}
          cell={selectedCell.cell}
          anchor={selectedCell.anchor}
          trigger={selectedCell.trigger}
          userId={user?.id}
          userEmail={user?.email}
          onClose={closePopover}
        />
      )}
    </section>
  );
}
