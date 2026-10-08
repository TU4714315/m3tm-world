/** Lightweight public-news language guard. Arabic and Persian share most of
 * U+0600–U+06FF, so a block-only regex incorrectly labels Persian as Arabic. */
const ARABIC_BLOCK = /[\u0600-\u06FF]/;
const PERSIAN_SPECIFIC = /[\u067E\u0686\u0698\u06AF\u06A9\u06CC]/;

export function isLikelyArabicText(value: unknown): boolean {
  const text = typeof value === 'string' ? value.trim() : '';
  return Boolean(text) && ARABIC_BLOCK.test(text) && !PERSIAN_SPECIFIC.test(text);
}

export function isArabicNews(language: unknown, title: unknown): boolean {
  if (typeof language === 'string' && language && language !== 'ar') return false;
  return isLikelyArabicText(title);
}
