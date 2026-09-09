import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Link } from "react-router";
import { DepositModal } from "@/components/Travel/DepositModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageShell } from "@/components/ui/PageShell";
import {
  PROJECTS_BASE_PATH,
  PROJECTS_TITLE,
  SAVINGS_LABEL,
} from "@/constants/projects";
import { useAuth } from "@/contexts/auth-context";
import {
  useAvailableSavings,
  useCreateDeposit,
  useDeleteDeposit,
  useDeposits,
  useUpdateDeposit,
} from "@/hooks/use-travel-savings";
import type { Deposit, DepositFormValue } from "@/types/travel-savings";
import { formatCurrency, formatDate } from "@/utils/format";
import styles from "./CagnottePage.module.css";

export function CagnottePage() {
  const { user } = useAuth();
  const { data: deposits = [], isLoading, isError } = useDeposits();
  const { total, spent, available } = useAvailableSavings();
  const createDeposit = useCreateDeposit();
  const updateDeposit = useUpdateDeposit();
  const deleteDeposit = useDeleteDeposit();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selected, setSelected] = useState<Deposit | undefined>();

  const authorName = (user?.Name as string) || user?.email || "";
  // Un versement perso porte l'email de son propriétaire ; la cagnotte commune
  // se reconnaît à un user_id vide.
  // Tous les versements portent désormais l'email de leur auteur : le vide
  // ne servait qu'à marquer l'ancienne cagnotte commune.
  const userId = user?.email ?? "";

  const openCreate = () => {
    setSelected(undefined);
    setIsModalVisible(true);
  };

  const openEdit = (deposit: Deposit) => {
    setSelected(deposit);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setSelected(undefined);
  };

  const handleSubmit = async (value: DepositFormValue) => {
    if (selected) {
      await updateDeposit.mutateAsync({
        ...value,
        author: selected.author,
        userId: selected.userId,
        id: selected.id,
      });
    } else {
      await createDeposit.mutateAsync({ ...value, author: authorName, userId });
    }
    closeModal();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteDeposit.mutateAsync(selected.id);
    closeModal();
  };

  return (
    <PageShell>
      <Link to={PROJECTS_BASE_PATH} className={styles.back}>
        <ArrowLeft size={18} />
        <span>{PROJECTS_TITLE}</span>
      </Link>

      <div className={styles.content}>
        <Card padded className={styles.summary}>
          <span className={styles.summaryLabel}>{SAVINGS_LABEL}</span>
          <span className={styles.summaryTotal}>{formatCurrency(available)}</span>
          {spent > 0 && (
            <span className={styles.summaryBreakdown}>
              {formatCurrency(total)} versés · {formatCurrency(spent)} dépensés
            </span>
          )}
        </Card>

        <div className={styles.addRow}>
          <Button pill size="sm" onClick={openCreate}>
            <Plus size={16} />
            Ajouter un versement
          </Button>
        </div>

        {isLoading ? (
          <p className={styles.status}>Chargement…</p>
        ) : isError ? (
          <EmptyState>Impossible de charger la cagnotte</EmptyState>
        ) : deposits.length === 0 ? (
          <EmptyState>Aucun versement pour le moment</EmptyState>
        ) : (
          <ul className={styles.list}>
            {deposits.map((deposit) => (
              <li key={deposit.id}>
                <button
                  type="button"
                  className={styles.deposit}
                  onClick={() => openEdit(deposit)}
                >
                  <span className={styles.depositMain}>
                    <span className={styles.depositAuthor}>
                      {deposit.author}
                    </span>
                    <span className={styles.depositMeta}>
                      {formatDate(deposit.date)}
                      {deposit.note ? ` · ${deposit.note}` : ""}
                    </span>
                  </span>
                  <span className={styles.depositAmount}>
                    +{formatCurrency(deposit.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DepositModal
        isVisible={isModalVisible}
        initialDeposit={selected}
        authorName={authorName}
        onClose={closeModal}
        onSubmit={handleSubmit}
        onDelete={selected ? handleDelete : undefined}
        isSubmitting={createDeposit.isPending || updateDeposit.isPending}
        isDeleting={deleteDeposit.isPending}
      />
    </PageShell>
  );
}
