// 息ぴったりゲージ = 直近7日の min(A,B) ÷ max(A,B)。
// 0〜1の割合だけを返し、回数(A・B)は呼び出し側に一切渡さない(docs/mvp.md)。
// 直近7日にどちらの記録も無い場合(max=0)は空(0)を返す。息が合うも合わないも、
// まだ何も起きていないためである。ここで満点を返すと、始めた時点で満タンの帯が
// 出て、そこから減る一方になり、育てる手応えが生まれない。
export function calcBalanceGauge(a: number, b: number): number {
  const max = Math.max(a, b);
  if (max === 0) {
    return 0;
  }
  return Math.min(a, b) / max;
}
