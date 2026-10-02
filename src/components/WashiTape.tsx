import { cls } from "./cls";
import styles from "./primitives.module.css";

export type TapeCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "loose";

const cornerClass: Record<TapeCorner, string | undefined> = {
  "top-left": styles.tapeTopLeft,
  "top-right": styles.tapeTopRight,
  "bottom-left": styles.tapeBottomLeft,
  "bottom-right": styles.tapeBottomRight,
  "top-center": styles.tapeTopCenter,
  loose: styles.tapeLoose,
};

export function WashiTape({
  corners,
  className,
}: {
  corners: readonly TapeCorner[];
  className?: string;
}) {
  return (
    <>
      {corners.map((corner) => (
        <span
          key={corner}
          className={cls(styles.tapeStrip, cornerClass[corner], className)}
          data-washi-tape={corner}
          data-decorative-filter=""
          aria-hidden="true"
        />
      ))}
    </>
  );
}
