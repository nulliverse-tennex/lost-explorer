import { formatDistance, renderDay2 } from "@/domain/clueText";
import type { Puzzle } from "@/domain/puzzle";
import { cls } from "../cls";
import { PaperCard } from "../PaperCard";
import { WashiTape } from "../WashiTape";
import styles from "./clues.module.css";

export function Day2Sign({
  puzzle,
  delayIndex = 0,
}: {
  puzzle: Puzzle;
  delayIndex?: number;
}) {
  const { referenceCity, distanceKm } = puzzle.day2;

  return (
    <PaperCard tilt={1.3} delayIndex={delayIndex}>
      <div className={styles.artefact} data-clue="day2">
        <p className={cls("face-stamp", styles.eyebrow)}>
          Day Two &middot; A sign by the road
        </p>

        {/* Plate is aria-hidden because it restates the narration verbatim —
            one accessible source, no double announcement. Still real DOM text. */}
        <div className={styles.signMount}>
          <div className={styles.signPlate} data-sign-plate="" aria-hidden="true">
            <WashiTape corners={["top-left", "bottom-right"]} />
            <span className={cls(styles.signRivet, styles.signRivetLeft)} />
            <span className={cls(styles.signRivet, styles.signRivetRight)} />

            <span className={cls("face-stamp", styles.signCity)}>
              {referenceCity}
            </span>
            <span className={styles.signRule} />
            <span className={cls("face-stamp", styles.signDistance)}>
              <span className={styles.signArrow}>&#9654;</span>
              {formatDistance(distanceKm)}
            </span>
          </div>
        </div>

        <p className={cls("face-journal", styles.narration)}>
          {renderDay2(puzzle)}
        </p>
      </div>
    </PaperCard>
  );
}
