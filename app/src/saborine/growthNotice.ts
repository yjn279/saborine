// 育ち具合が前より上がったことを、その直後だけ知らせるための判断。react-native・expo・
// 端末保存のいずれも読み込まない。前に端末で見た育ち具合(app/src/saborine/growthStorage.ts)
// と、いまの育ち具合を比べるだけで、知らせるかどうかを決める。

export interface GrowthNoticeInput {
  // /api/home がいま返している、いまの育ち具合(0〜1)
  current: number;
  // 前に端末で見た育ち具合。まだ一度も記録が無いときはnull
  previouslySeen: number | null;
}

// 前に見た記録が端末に無いとき、および前より上がっていないときは知らせない。
export function decideGrowthNotice(input: GrowthNoticeInput): boolean {
  if (input.previouslySeen === null) {
    return false;
  }
  return input.current > input.previouslySeen;
}

// 知らせの文面。誰の働きかには触れず、いま育ったことだけを短く伝える。
export function buildGrowthNoticeMessage(): string {
  return "ふたりのおかげで、サボリーヌが少し育ったよ";
}
