// 週の区切り = 日曜21時(日本時間)を境にした週の始まりと終わり(計画「自分で決めたこと」3番)。
// 日本時間は夏時間が無いため、UTC+9の固定加算だけで扱う。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const WEEK_BOUNDARY_HOUR = 21;

export interface WeekRange {
  start: Date;
  end: Date;
}

// 指定した時刻が属する週の始まり(直近の日曜21:00 JST。ちょうどその時刻を含む)を返す。
export function getWeekStart(at: Date): Date {
  // 日本時間の壁時計を、日曜21:00が真夜中0:00に来るようずらしてから
  // 日単位で週の始まりを求め、最後にずらしを戻す。
  const jst = at.getTime() + JST_OFFSET_MS;
  const shifted = jst - WEEK_BOUNDARY_HOUR * HOUR_MS;
  const shiftedDayStart = Math.floor(shifted / DAY_MS) * DAY_MS;
  const daysSinceSunday = new Date(shiftedDayStart).getUTCDay();
  const weekStartShifted = shiftedDayStart - daysSinceSunday * DAY_MS;
  const weekStartJst = weekStartShifted + WEEK_BOUNDARY_HOUR * HOUR_MS;
  return new Date(weekStartJst - JST_OFFSET_MS);
}

// 指定した時刻が属する週の範囲を返す。endは次の週の始まりで、その週には含まれない。
export function getWeekRange(at: Date): WeekRange {
  const start = getWeekStart(at);
  return { start, end: new Date(start.getTime() + WEEK_MS) };
}

export interface MonthRange {
  start: Date;
  end: Date;
  daysInMonth: number;
}

// 月の区切り = 日本時間のカレンダー月(1日0:00〜翌月1日0:00)。進化判定の「当月」はこの区切りを使う。
export function getMonthRange(at: Date): MonthRange {
  const jst = new Date(at.getTime() + JST_OFFSET_MS);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth();
  const startJstMs = Date.UTC(year, month, 1);
  const endJstMs = Date.UTC(year, month + 1, 1);
  return {
    start: new Date(startJstMs - JST_OFFSET_MS),
    end: new Date(endJstMs - JST_OFFSET_MS),
    daysInMonth: Math.round((endJstMs - startJstMs) / DAY_MS),
  };
}

// 直前に閉じた月の範囲。月が変わった直後の予定実行(scheduled.ts)の進化判定から使う。
export function getPreviousMonthRange(at: Date): MonthRange {
  return getMonthRange(new Date(getMonthRange(at).start.getTime() - 1));
}

// 指定した時刻が(日本時間で)月の最初の日かどうか。月末判定の予定実行を、月が変わった日にだけ動かす。
export function isFirstDayOfMonthJst(at: Date): boolean {
  return new Date(at.getTime() + JST_OFFSET_MS).getUTCDate() === 1;
}

// 指定した時刻の日本時間での暦日("YYYY-MM-DD")。進化判定で記録・ありがとうを日単位で数えるのに使う。
export function jstCalendarDay(at: Date): string {
  return new Date(at.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

// 指定した時刻の日本時間での通し日数(エポックからの経過日数)。日本時間の午前0時ちょうどに1増える。
// 促しのセリフを日替わりで選ぶのに使う。
export function jstDayNumber(at: Date): number {
  return Math.floor((at.getTime() + JST_OFFSET_MS) / DAY_MS);
}
