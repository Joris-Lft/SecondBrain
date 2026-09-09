import { ChevronRight, PiggyBank } from "lucide-react";
import { Link } from "react-router";
import { Card } from "@/components/ui/Card";
import { PROJECTS_BASE_PATH, SAVINGS_LABEL } from "@/constants/projects";
import { useAvailableSavings } from "@/hooks/use-travel-savings";
import { formatCurrency } from "@/utils/format";
import styles from "./SavingsCard.module.css";

export function SavingsCard() {
  const { available } = useAvailableSavings();

  return (
    <Card padded className={styles.card}>
      <div className={styles.titleBlock}>
        <span className={styles.title}>
          <PiggyBank size={18} />
          {SAVINGS_LABEL}
        </span>
        <span className={styles.total}>{formatCurrency(available)}</span>
      </div>

      <Link to={`${PROJECTS_BASE_PATH}/cagnotte`} className={styles.link}>
        Historique des versements
        <ChevronRight size={16} />
      </Link>
    </Card>
  );
}
