import { renderDay3 } from "@/domain/clueText";
import type { Puzzle } from "@/domain/puzzle";
import { cls } from "../cls";
import { PaperCard } from "../PaperCard";
import { TornEdge } from "../TornEdge";
import styles from "./clues.module.css";
import { flagSvgUrl } from "./flagAsset";

export function Day3FlagCloth({
  puzzle,
  delayIndex = 0,
}: {
  puzzle: Puzzle;
  delayIndex?: number;
}) {
  return (
    <PaperCard tilt={-0.7} tape={["top-center"]} delayIndex={delayIndex}>
      <div className={styles.artefact} data-clue="day3">
        <p className={cls("face-stamp", styles.eyebrow)}>
          Day Three &middot; Cloth, caught on a wire
        </p>

        <div className={styles.clothMount}>
          <div className={styles.cloth} aria-hidden="true">
            <TornEdge edges="both" className={styles.clothWindow}>
              {/* alt is empty on purpose: a described flag would name the
                  country outright and end the puzzle for screen-reader users. */}
              <img
                className={styles.clothFlag}
                src={flagSvgUrl(puzzle.countryCode)}
                alt=""
                aria-hidden="true"
                width={200}
                height={150}
                data-flag-fragment=""
              />
              <span className={styles.clothWeave} aria-hidden="true" />
            </TornEdge>
          </div>
        </div>

        <p className={cls("face-journal", styles.narration)}>
          {renderDay3(puzzle)}
        </p>
      </div>
    </PaperCard>
  );
}
