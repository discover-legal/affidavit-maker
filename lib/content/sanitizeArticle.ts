const AVAILABILITY_NOTICE = `## What discover.legal Currently Offers

The launch product prepares affidavit drafts and, in supported divorce jurisdictions, a petition and proposed decree draft. It does not generate every court form or file for you. Review current local court instructions and consider a licensed lawyer for legal advice or complex matters.`;

/**
 * Historical articles contain useful educational material alongside outdated
 * product promotions. Replace every product-branded section with the current,
 * launch-scoped availability statement before it can be rendered or indexed.
 */
export function sanitizeArticlePromotions(content: string): string {
  return content
    .replace(
      /## (?:[^\n]*discover\.legal[^\n]*|Where this site fits|Ready to (?:Create|Start|Prepare)[^\n]*)\n[\s\S]*?(?=\n## |\s*$)/gi,
      AVAILABILITY_NOTICE,
    )
    .replace(
      /\[([^\]]+)\]\(#cta\)/g,
      '**[View currently available document drafts →](/)**',
    );
}
