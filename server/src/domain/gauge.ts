// 息ぴったりゲージ = 直近7日の min(A,B) ÷ max(A,B)。
// 0〜1の割合だけを返し、回数(A・B)は呼び出し側に一切渡さない(docs/mvp.md:142)。
// 直近7日にどちらの記録も無い場合(max=0)は、不均衡が生じようがないため
// 満点(1)を返す。
export function calcBalanceGauge(a: number, b: number): number {
  const max = Math.max(a, b);
  if (max === 0) {
    return 1;
  }
  return Math.min(a, b) / max;
}
