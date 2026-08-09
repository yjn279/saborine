// 成長ポイント = (A + B) + 2 × min(A, B)。
// A・Bは、ある期間(週または月)にそれぞれの記録に届いたごはん(ありがとう)の数。
// ふたり分そろったごはんほど価値が高くなり、片方だけが集めるより
// 均等に集めたほうがよく育つ(docs/mvp.md:136)。
export function calcGrowthPoints(a: number, b: number): number {
  return a + b + 2 * Math.min(a, b);
}
