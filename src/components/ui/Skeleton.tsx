import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

type SkeletonVariant = "text" | "title" | "block" | "circle" | "noteCard" | "habitRow" | "chart" | "tableRow";

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: CSSProperties;
}

function joinClasses(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Skeleton({
  variant = "block",
  width,
  height,
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      className={joinClasses(styles.skeleton, styles[variant], className)}
      style={{ width, height, ...style }}
      aria-hidden
    />
  );
}

export function NotesPageSkeleton() {
  return (
    <div className={`${styles.grid} ${styles.noteGrid}`}>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} variant="noteCard" />
      ))}
    </div>
  );
}

export function HabitListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.stack}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} variant="habitRow" />
      ))}
    </div>
  );
}

export function PageLoadingSkeleton({ message }: { message?: string }) {
  return (
    <div className={styles.centered} role="status">
      <Skeleton variant="circle" width={40} height={40} />
      {message && <Skeleton variant="text" width="60%" />}
    </div>
  );
}
