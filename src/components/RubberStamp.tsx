import type { CSSProperties, ReactNode } from "react";
import { cls } from "./cls";
import styles from "./primitives.module.css";

export type StampVariant = "day" | "wrong" | "found" | "lost";

type StampStyle = CSSProperties & Record<"--stamp-rot", string>;

const variantClass: Record<StampVariant, string | undefined> = {
  day: styles.stampDay,
  wrong: styles.stampWrong,
  found: styles.stampFound,
  lost: styles.stampLost,
};

export function RubberStamp({
  variant,
  rotate,
  className,
  children,
}: {
  variant: StampVariant;
  rotate?: number;
  className?: string;
  children: ReactNode;
}) {
  const style: StampStyle | undefined =
    rotate === undefined ? undefined : { "--stamp-rot": `${rotate}deg` };

  return (
    <span
      className={cls(
        "ink-layer",
        "face-display",
        styles.stamp,
        variantClass[variant],
        className,
      )}
      style={style}
      data-stamp={variant}
      data-animated=""
    >
      <span
        className={styles.stampEdge}
        data-decorative-filter=""
        aria-hidden="true"
      />
      <span className={styles.stampInk}>{children}</span>
    </span>
  );
}
