import type { CSSProperties, ReactNode } from "react";
import { cls } from "./cls";
import styles from "./primitives.module.css";
import { TornEdge, type TornEdges } from "./TornEdge";
import { WashiTape, type TapeCorner } from "./WashiTape";

type CardStyle = CSSProperties &
  Record<"--card-tilt" | "--card-delay", string>;

export function PaperCard({
  tilt = -0.9,
  tape,
  torn,
  delayIndex = 0,
  className,
  children,
}: {
  tilt?: number;
  tape?: readonly TapeCorner[];
  torn?: TornEdges;
  delayIndex?: number;
  className?: string;
  children: ReactNode;
}) {
  const style: CardStyle = {
    "--card-tilt": `${tilt}deg`,
    "--card-delay": `calc(${delayIndex} * var(--stagger))`,
  };

  return (
    <div
      className={cls(styles.card, torn && styles.cardTorn, className)}
      style={style}
      data-paper-card={torn ?? "clean"}
      data-animated=""
    >
      {tape ? <WashiTape corners={tape} /> : null}
      {torn ? (
        <TornEdge edges={torn} className={styles.cardSheet}>
          {children}
        </TornEdge>
      ) : (
        <div className={styles.cardSheet}>{children}</div>
      )}
    </div>
  );
}
