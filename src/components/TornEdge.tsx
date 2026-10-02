import type { ReactNode } from "react";
import { cls } from "./cls";
import styles from "./primitives.module.css";

export type TornEdges = "top" | "bottom" | "both";

const edgeClass: Record<TornEdges, string | undefined> = {
  top: styles.tornTop,
  bottom: styles.tornBottom,
  both: styles.tornBoth,
};

export function TornEdge({
  edges,
  className,
  children,
}: {
  edges: TornEdges;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cls(styles.torn, edgeClass[edges], className)}
      data-torn-edge={edges}
    >
      {children}
    </div>
  );
}
