/** Corner stickers on Daily Brew cards (one per slot, cycles if more items). */
export const BREW_CARD_STICKERS = [
  '/ad/brew-sticker-1.png',
  '/ad/brew-sticker-2.png',
  '/ad/brew-sticker-3.png',
  '/ad/brew-sticker-4.png',
  '/ad/brew-sticker-5.png',
  '/ad/brew-sticker-6.png',
] as const;

export function brewCardStickerForIndex(index: number): string {
  return BREW_CARD_STICKERS[index % BREW_CARD_STICKERS.length] ?? BREW_CARD_STICKERS[0];
}

/** Visual scale — some PNGs have tighter crop / larger figure at the same CSS width. */
const BREW_CARD_STICKER_SCALE: Partial<Record<(typeof BREW_CARD_STICKERS)[number], number>> = {
  '/ad/brew-sticker-1.png': 0.72,
};

export function brewCardStickerScale(src: string): number {
  return BREW_CARD_STICKER_SCALE[src as (typeof BREW_CARD_STICKERS)[number]] ?? 1;
}
