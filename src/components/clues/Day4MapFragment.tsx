import { renderDay4 } from "@/domain/clueText";
import type { Puzzle } from "@/domain/puzzle";
import { cls } from "../cls";
import { PaperCard } from "../PaperCard";
import { RubberStamp } from "../RubberStamp";
import styles from "./clues.module.css";
import day45 from "./day45.module.css";

export function Day4MapFragment({
  puzzle,
  delayIndex = 0,
}: {
  puzzle: Puzzle;
  delayIndex?: number;
}) {
  const { mapYear } = puzzle.day4;

  return (
    <PaperCard
      tilt={-1.6}
      torn="bottom"
      tape={["top-left", "top-right"]}
      delayIndex={delayIndex}
    >
      <div className={styles.artefact} data-clue="day4">
        <p className={cls("face-stamp", styles.eyebrow)}>
          Day Four &middot; An old map
        </p>

        <div className={day45.scrap} data-map-scrap="">
          <span className={day45.creases} aria-hidden="true" />

          <div className={day45.scrapHead}>
            <span className={cls("face-stamp", day45.sheetLabel)}>
              Survey sheet &middot; sheet IV
            </span>
            <RubberStamp
              variant="day"
              rotate={-4.5}
              className={day45.dateStamp}
            >
              <span data-map-year="">{mapYear}</span>
            </RubberStamp>
          </div>

          <p className={cls("face-stamp", day45.scrapFoot)} aria-hidden="true">
            scale 1:250 000 &middot; borders as surveyed
          </p>
        </div>

        <p className={cls("face-journal", styles.narration)}>
          {renderDay4(puzzle)}
        </p>
      </div>
    </PaperCard>
  );
}
