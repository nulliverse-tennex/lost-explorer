import type { Metadata } from "next";
import { Day4MapFragment } from "@/components/clues/Day4MapFragment";
import { Day5Napkin } from "@/components/clues/Day5Napkin";
import { PaperFilters } from "@/components/PaperFilters";
import type { DailyGameState } from "@/domain/game";
import type { Puzzle } from "@/domain/puzzle";

export const metadata: Metadata = {
  title: "Day 4-5 artefacts — The Lost Explorer",
  robots: { index: false, follow: false },
};

type Fixture = {
  city: string;
  country: string;
  day4: Puzzle["day4"];
  day5: Puzzle["day5"];
};

const georgian: Fixture = {
  city: "Tbilisi",
  country: "Georgia",
  day4: {
    mapYear: 1900,
    historicalEntity: "the Russian Empire",
    historicalSourceUrl: "https://en.wikipedia.org/wiki/Tiflis_Governorate",
  },
  day5: {
    language: "Georgian",
    languageCode: "ka",
    helpPhrase: "დახმარება ხომ არ გჭირდება?",
    helpPhraseTranslation: "Do you need help?",
  },
};

const fixtures: Record<string, Fixture> = {
  ka: georgian,
  ja: {
    city: "Kyoto",
    country: "Japan",
    day4: {
      mapYear: 1870,
      historicalEntity: "the Empire of Japan",
      historicalSourceUrl: "https://en.wikipedia.org/wiki/Empire_of_Japan",
    },
    day5: {
      language: "Japanese",
      languageCode: "ja",
      helpPhrase: "助けが必要ですか？",
      helpPhraseTranslation: "Do you need help?",
    },
  },
  ar: {
    city: "Fez",
    country: "Morocco",
    day4: {
      mapYear: 1930,
      historicalEntity: "the French Protectorate in Morocco",
      historicalSourceUrl:
        "https://en.wikipedia.org/wiki/French_protectorate_in_Morocco",
    },
    day5: {
      language: "Arabic",
      languageCode: "ar",
      helpPhrase: "هل تحتاج مساعدة؟",
      helpPhraseTranslation: "Do you need help?",
    },
  },
  hi: {
    city: "Jaipur",
    country: "India",
    day4: {
      mapYear: 1920,
      historicalEntity: "British India",
      historicalSourceUrl: "https://en.wikipedia.org/wiki/Jaipur_State",
    },
    day5: {
      language: "Hindi",
      languageCode: "hi",
      helpPhrase: "क्या आपको मदद चाहिए?",
      helpPhraseTranslation: "Do you need help?",
    },
  },
  ca: {
    city: "Barcelona",
    country: "Spain",
    day4: {
      mapYear: 1930,
      historicalEntity: "the Second Spanish Republic",
      historicalSourceUrl:
        "https://en.wikipedia.org/wiki/Second_Spanish_Republic",
    },
    day5: {
      language: "Catalan",
      languageCode: "ca",
      helpPhrase: "Necessites ajuda?",
      helpPhraseTranslation: "Do you need help?",
    },
  },
};

type GameStatus = DailyGameState["status"];

const statuses: readonly GameStatus[] = ["in_progress", "won", "lost"];

function parseStatus(raw: string | undefined): GameStatus {
  return statuses.find((status) => status === raw) ?? "in_progress";
}

function buildPuzzle(fixture: Fixture): Puzzle {
  return {
    id: `demo-${fixture.day5.languageCode}`,
    city: fixture.city,
    country: fixture.country,
    countryCode: "ZZ",
    geonameId: 1,
    coordinates: { lat: 0, lng: 0 },
    publishDate: "2026-01-01",
    day1: {
      landscape: "hilly",
      metroPopulationMillions: 1.5,
      populationSource: {
        name: "demo",
        url: "https://example.com/",
        asOfYear: 2026,
      },
    },
    day2: {
      referenceCity: "Istanbul",
      referenceCityCountry: "Turkey",
      referenceCityCoordinates: { lat: 41.01384, lng: 28.94966 },
      distanceKm: 1350,
      recognisability: "global",
    },
    day3: { flagColours: ["red", "white"] },
    day4: fixture.day4,
    day5: fixture.day5,
  };
}

export default function Day45Page({
  searchParams,
}: {
  searchParams: { lang?: string; status?: string };
}) {
  const fixture = fixtures[searchParams.lang ?? "ka"] ?? georgian;
  const status = parseStatus(searchParams.status);
  const puzzle = buildPuzzle(fixture);

  return (
    <main className="stage mx-auto flex max-w-2xl flex-col gap-8 px-5 py-8">
      <PaperFilters />

      <header className="flex flex-col gap-2">
        <p className="face-stamp text-step--2 text-ink-faint">
          Field Kit &middot; Days Four &amp; Five
        </p>
        <h1 className="face-display text-step-3 text-ink">
          {fixture.day5.language}
        </h1>
        <p className="face-ui text-step--2 text-ink-faint" data-demo-status="">
          status: {status}
        </p>
      </header>

      <Day4MapFragment puzzle={puzzle} />
      <Day5Napkin puzzle={puzzle} status={status} delayIndex={1} />
    </main>
  );
}
