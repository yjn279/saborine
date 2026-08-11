// 身分証を手放すとき(本人の意思によるペア解除・アカウント削除、または401で
// サーバーから拒まれたとき)に呼ぶ。身分証と招待の自動提示の端末保存を
// まとめて消すことで、次にこの端末で登録する相手に前の関係の進み具合を
// 持ち越さないようにする。deps越しに渡すことで、react-native・expoの
// いずれも読み込まずに動きだけを試験できる。

export interface ForgetIdentityDeps {
  clearIdentity: () => Promise<void>;
  clearInvitePromptState: () => Promise<void>;
}

export async function forgetIdentity(deps: ForgetIdentityDeps): Promise<void> {
  await Promise.all([deps.clearIdentity(), deps.clearInvitePromptState()]);
}
