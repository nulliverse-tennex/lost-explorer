import type { Puzzle } from './puzzle';

export function populationDescription(millions: number): string {
  if (millions < 0.2) return 'small';
  if (millions < 0.5) return 'fairly small';
  if (millions < 1) return 'medium-sized';
  if (millions < 2) return 'fairly busy';
  if (millions < 5) return 'big';
  if (millions < 10) return 'huge';
  return 'enormous';
}

export function formatPopulation(millions: number): string {
  if (millions >= 2) {
    const rounded = Math.round(millions);
    return `approximately ${rounded} million`;
  }

  const rounded = Math.round(millions * 10) / 10;
  return `${rounded} million`;
}

export function formatDistance(km: number): string {
  let rounded: number;

  if (km < 500) {
    rounded = Math.round(km / 10) * 10;
  } else if (km < 2000) {
    rounded = Math.round(km / 50) * 50;
  } else {
    rounded = Math.round(km / 100) * 100;
  }

  return `${rounded} km`;
}

function formatColourList(colours: string[]): string {
  if (colours.length === 1) {
    return colours[0];
  }
  if (colours.length === 2) {
    return `${colours[0]} and ${colours[1]}`;
  }

  const allButLast = colours.slice(0, -1).join(', ');
  return `${allButLast} and ${colours[colours.length - 1]}`;
}

export function renderDay1(puzzle: Puzzle): string {
  const pop = formatPopulation(puzzle.day1.metroPopulationMillions);
  const desc = populationDescription(puzzle.day1.metroPopulationMillions);

  return `I've had a look around. ${puzzle.day1.landscape}.

This feels like a ${desc} city — around ${pop} live here.`;
}

export function renderDay2(puzzle: Puzzle): string {
  const distance = formatDistance(puzzle.day2.distanceKm);

  return `I found a sign. It says ${puzzle.day2.referenceCity} is about ${distance} away.`;
}

export function renderDay3(puzzle: Puzzle): string {
  const colourList = formatColourList(puzzle.day3.flagColours);

  return `I saw a flag in the distance. It definitely had ${colourList} in it — and no other colours.`;
}

export function renderDay4(puzzle: Puzzle): string {
  return `I found an old map dated ${puzzle.day4.mapYear}. Apparently this place was part of ${puzzle.day4.historicalEntity} at the time.`;
}

export function renderDay5(puzzle: Puzzle): string {
  return `Someone finally noticed I was lost. They looked at me and said:

"${puzzle.day5.helpPhrase}"

FINAL GUESS`;
}
