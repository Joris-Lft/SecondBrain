import { useState } from "react";
import { useNavigate } from "react-router";
import { SavingsCard } from "@/components/Travel/SavingsCard";
import { TravelCard } from "@/components/Travel/TravelCard";
import { TravelFormModal } from "@/components/Travel/TravelFormModal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { PageLoadingSkeleton } from "@/components/ui/Skeleton";
import { PROJECTS_BASE_PATH, PROJECTS_TITLE } from "@/constants/projects";
import { useAuth } from "@/contexts/auth-context";
import { useTravelBudgetTotals } from "@/hooks/use-travel-budget";
import { emptyBudgetTotals } from "@/types/travel-budget";
import { useAvailableSavings } from "@/hooks/use-travel-savings";
import { useCreateTravel, useTravels } from "@/hooks/use-travels";
import type { Travel, TravelDetailsInput } from "@/types/travels";
import styles from "./ProjetsPage.module.css";

export function ProjetsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: travels = [], isLoading, isError } = useTravels();
  const createTravelMutation = useCreateTravel(user?.id);
  const { data: budgetSummary } = useTravelBudgetTotals();
  const { available: availableSavings } = useAvailableSavings();

  const totalsByTravel = budgetSummary?.totalsByTravel ?? {};

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEmpty = !isLoading && !isError && travels.length === 0;

  const openCreateModal = () => {
    setFormError(null);
    setIsModalVisible(true);
  };

  const closeModal = () => setIsModalVisible(false);

  const handleOpenTravel = (travel: Travel) => {
    void navigate(`${PROJECTS_BASE_PATH}/${travel.id}`);
  };

  const handleSubmit = async (value: TravelDetailsInput) => {
    setFormError(null);
    try {
      const travel = await createTravelMutation.mutateAsync(value);
      closeModal();
      void navigate(`${PROJECTS_BASE_PATH}/${travel.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Enregistrement impossible";
      setFormError(message);
      throw error;
    }
  };

  return (
    <PageShell>
      <PageHeader
        title={PROJECTS_TITLE}
        align="center"
        actions={
          <Button pill onClick={openCreateModal}>
            Nouveau projet
          </Button>
        }
      />

      {formError && <p className={styles.errorBanner}>{formError}</p>}

      <div className={styles.savings}>
        <SavingsCard />
      </div>

      {isLoading ? (
        <PageLoadingSkeleton />
      ) : isError ? (
        <EmptyState>Impossible de charger les projets</EmptyState>
      ) : isEmpty ? (
        <EmptyState>Aucun projet pour le moment</EmptyState>
      ) : (
        <div className={styles.grid}>
          {travels.map((travel) => (
            <TravelCard
              key={travel.id}
              travel={travel}
              budget={{
                totals: totalsByTravel[travel.id] ?? emptyBudgetTotals(),
                saved: availableSavings,
              }}
              onOpen={handleOpenTravel}
            />
          ))}
        </div>
      )}

      <TravelFormModal
        isVisible={isModalVisible}
        onClose={closeModal}
        onSubmit={handleSubmit}
        isSubmitting={createTravelMutation.isPending}
      />
    </PageShell>
  );
}
