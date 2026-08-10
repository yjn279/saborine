// 利用規約・プライバシーポリシーのような、見出しと段落が並ぶだけの文書を表す型。
export interface LegalSection {
  // 導入部などで見出しを持たない節ではundefinedにする。
  heading?: string;
  paragraphs: readonly string[];
}

export interface LegalDocument {
  title: string;
  sections: readonly LegalSection[];
}
