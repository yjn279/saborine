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
