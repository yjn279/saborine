// 記録が成立した直後にサボリーヌが見せるひとことを決める。react-native・expo・
// 端末保存のいずれも読み込まない。

export interface RecordReactionInput {
  // 記録した家事の名前(プリセットまたは自由入力)
  choreType: string;
  // 記録の直前、サボリーヌがだらしな姿だったか
  wasSloppy: boolean;
}

export function buildRecordReactionMessage(input: RecordReactionInput): string {
  if (input.wasSloppy) {
    return `${input.choreType}、うけとったよ!しゃきっと めが さめてきた!`;
  }
  return `${input.choreType}、うけとったよ!ありがとう!`;
}
