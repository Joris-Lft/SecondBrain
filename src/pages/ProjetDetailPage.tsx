import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Pencil,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { ActivitiesSection } from "@/components/Travel/ActivitiesSection";
import { BudgetProgress } from "@/components/Travel/BudgetProgress";
import { BudgetSection } from "@/components/Travel/BudgetSection";
import { TravelFormModal } from "@/components/Travel/TravelFormModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Markdown } from "@/components/ui/Markdown";
import { PageShell } from "@/components/ui/PageShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PageLoadingSkeleton } from "@/components/ui/Skeleton";
import { PROJECTS_BASE_PATH, PROJECTS_TITLE } from "@/constants/projects";
import { useTravelBudget } from "@/hooks/use-travel-budget";
import { useAvailableSavings } from "@/hooks/use-travel-savings";
import {
  useDeleteTravel,
  useTravel,
  useUpdateTravel,
} from "@/hooks/use-travels";
import { sumBudgetTotals } from "@/types/travel-budget";
import type { TravelDetailsInput } from "@/types/travels";
import { formatDate } from "@/utils/format";
import styles from "./ProjetDetailPage.module.css";

type TravelTab = "apercu" | "budget" | "activites";

function buildTravelTabs(isVoyage: boolean): { value: TravelTab; label: string }[] {
  const tabs: { value: TravelTab; label: string }[] = [
    { value: "apercu", label: "Aperçu" },
    { value: "budget", label: "Budget" },
  ];
  if (isVoyage) tabs.push({ value: "activites", label: "Activités" });
  return tabs;
}

function formatDateRange(start: string, end: string): string | null {
  if (start && end) return `${formatDate(start)} → ${formatDate(end)}`;
  if (start) return `À partir du ${formatDate(start)}`;
  if (end) return `Jusqu'au ${formatDate(end)}`;
  return null;
}

export function ProjetDetailPage() {
  const { travelId } = useParams<{ travelId: string }>();
  const navigate = useNavigate();
  const { data: travel, isLoading, isError } = useTravel(travelId);
  const updateTravelMutation = useUpdateTravel();
  const deleteTravelMutation = useDeleteTravel();
  const { data: budgetLines = [] } = useTravelBudget(travelId);
  const { available: availableSavings } = useAvailableSavings();

  const budgetTotals = useMemo(
    () => sumBudgetTotals(budgetLines),
    [budgetLines],
  );

  const [isEditVisible, setIsEditVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TravelTab>("apercu");
  const [mapFocusId, setMapFocusId] = useState<string | undefined>();

  const handleSubmit = async (value: TravelDetailsInput) => {
    if (!travel) return;
    await updateTravelMutation.mutateAsync({ ...value, id: travel.id });
    setIsEditVisible(false);
  };

  const handleDelete = async () => {
    if (!travel) return;
    await deleteTravelMutation.mutateAsync(travel.id);
    setIsEditVisible(false);
    void navigate(PROJECTS_BASE_PATH, { replace: true });
  };

  const dateRange = travel ? formatDateRange(travel.startDate, travel.endDate) : null;
  const hasInfos =
    travel &&
    (travel.isVoyage
      ? travel.destination || dateRange || travel.description
      : travel.description);

  // Onglet effectif : si l'onglet sélectionné n'existe plus (ex. un voyage
  // repassé en projet classique masque « Activités »), on retombe sur Aperçu.
  const tabs = travel ? buildTravelTabs(travel.isVoyage) : [];
  const currentTab: TravelTab = tabs.some((tab) => tab.value === activeTab)
    ? activeTab
    : "apercu";

  return (
    <PageShell>
      <Link to={PROJECTS_BASE_PATH} className={styles.back}>
        <ArrowLeft size={18} />
        <span>{PROJECTS_TITLE}</span>
      </Link>

      {isLoading ? (
        <PageLoadingSkeleton />
      ) : isError || !travel ? (
        <EmptyState>Projet introuvable</EmptyState>
      ) : (
        <div className={styles.content}>
          <div className={styles.cover}>
            {travel.coverUrl ? (
              <img src={travel.coverUrl} alt="" className={styles.coverImage} />
            ) : (
              <div className={styles.coverFallback} aria-hidden>
                <MapPin size={36} />
              </div>
            )}
            <Button
              className={styles.editButton}
              variant="secondary"
              size="sm"
              pill
              onClick={() => setIsEditVisible(true)}
            >
              <Pencil size={15} />
              Modifier
            </Button>
          </div>

          <h1 className={styles.title}>{travel.name}</h1>

          {travel.isVoyage && (travel.destination || dateRange) && (
            <div className={styles.metaRow}>
              {travel.destination && (
                <span className={styles.metaItem}>
                  <MapPin size={16} />
                  {travel.destination}
                </span>
              )}
              {dateRange && (
                <span className={styles.metaItem}>
                  <CalendarDays size={16} />
                  {dateRange}
                </span>
              )}
            </div>
          )}

          <div className={styles.tabs}>
            <SegmentedControl
              value={currentTab}
              options={tabs}
              onChange={setActiveTab}
              ariaLabel="Sections du projet"
            />
          </div>

          {currentTab === "apercu" ? (
            <div className={styles.overview}>
              {budgetTotals.total > 0 && (
                <Card padded>
                  <h2 className={styles.sectionTitle}>Reste à payer</h2>
                  <BudgetProgress totals={budgetTotals} saved={availableSavings} />
                </Card>
              )}
              {travel.description ? (
                <Card padded>
                  <Markdown>{travel.description}</Markdown>
                </Card>
              ) : !hasInfos ? (
                <EmptyState>
                  {travel.isVoyage
                    ? "Ajoute une destination, des dates et une description avec « Modifier »."
                    : "Ajoute une description avec « Modifier »."}
                </EmptyState>
              ) : null}
            </div>
          ) : currentTab === "budget" ? (
            <BudgetSection
              travelId={travel.id}
              onShowOnMap={
                travel.isVoyage
                  ? (line) => {
                      setMapFocusId(line.id);
                      setActiveTab("activites");
                    }
                  : undefined
              }
            />
          ) : (
            <ActivitiesSection travelId={travel.id} focusId={mapFocusId} />
          )}
        </div>
      )}

      {travel && (
        <TravelFormModal
          isVisible={isEditVisible}
          travel={travel}
          onClose={() => setIsEditVisible(false)}
          onSubmit={handleSubmit}
          onDelete={handleDelete}
          isSubmitting={updateTravelMutation.isPending}
          isDeleting={deleteTravelMutation.isPending}
        />
      )}
    </PageShell>
  );
}
