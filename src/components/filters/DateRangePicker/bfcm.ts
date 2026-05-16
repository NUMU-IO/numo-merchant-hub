/**
 * Black Friday / Cyber Monday window math.
 *
 * Black Friday = the Friday after US Thanksgiving (4th Thursday of November).
 * Cyber Monday = the following Monday.
 * Merchants treat "BFCM" as Black Friday 00:00 → Cyber Monday 23:59:59.
 */

function fourthThursdayOfNovember(year: number): Date {
  const nov1 = new Date(year, 10, 1);
  // 4 = Thursday in JS getDay().
  const offset = (4 - nov1.getDay() + 7) % 7;
  const firstThursday = 1 + offset;
  return new Date(year, 10, firstThursday + 21);
}

export interface BfcmWindow {
  start: Date;
  end: Date;
}

export function bfcmForYear(year: number): BfcmWindow {
  const thanksgiving = fourthThursdayOfNovember(year);
  const blackFriday = new Date(year, 10, thanksgiving.getDate() + 1);
  blackFriday.setHours(0, 0, 0, 0);
  const cyberMonday = new Date(year, 10, thanksgiving.getDate() + 4);
  cyberMonday.setHours(23, 59, 59, 999);
  return { start: blackFriday, end: cyberMonday };
}

/** Most-recent fully-elapsed BFCM window relative to `now`. */
export function lastBfcm(now: Date): BfcmWindow {
  const thisYear = bfcmForYear(now.getFullYear());
  if (now.getTime() > thisYear.end.getTime()) return thisYear;
  return bfcmForYear(now.getFullYear() - 1);
}
