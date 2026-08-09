// だらしなモード = ふたりとも記録が3日途切れたら真。どちらか1回の記録で即座に偽に戻る(docs/mvp.md:144)。
// 誰が途切れさせたかは問わない(片方の最終記録時刻だけを見て責めない)ため、
// 「両者とも3日以上記録が無い」ことだけを条件にする。
const SLOPPY_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

// lastRecordAtがnullの場合は、まだ一度も記録していないとみなし、
// 常に「3日以上途切れている」側として扱う。
export function isSloppyMode(
  lastRecordAtA: Date | null,
  lastRecordAtB: Date | null,
  now: Date,
): boolean {
  return isStale(lastRecordAtA, now) && isStale(lastRecordAtB, now);
}

function isStale(lastRecordAt: Date | null, now: Date): boolean {
  if (lastRecordAt === null) {
    return true;
  }
  return now.getTime() - lastRecordAt.getTime() >= SLOPPY_THRESHOLD_MS;
}
