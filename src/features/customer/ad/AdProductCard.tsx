import type { CSSProperties } from 'react';
import type { MenuItem } from '../../../../shared/domain';
import { formatINR } from '../../../../shared/domain';
import { itemIngredientLine } from '../menuFacts';
import { brewCardStickerScale } from './brewCardStickers';
import { menuItemImageProps } from './menuItemImage';

export function AdProductCard({
  item,
  onOpen,
  onAddToCart,
  cornerSticker,
}: {
  item: MenuItem;
  onOpen: (item: MenuItem) => void;
  onAddToCart: (item: MenuItem) => void;
  /** Daily Brew — sticker on photo corner */
  cornerSticker?: string;
}) {
  const subtitle = itemIngredientLine(item);

  return (
    <article className={`ad-brew-card${item.isAvailable ? '' : ' is-sold'}`}>
      <div className="ad-brew-card-body">
        <button
          type="button"
          className="ad-brew-photo-hit"
          onClick={() => onOpen(item)}
          disabled={!item.isAvailable}
          aria-label={`View ${item.name}`}
        >
          <span className="ad-brew-photo">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                {...menuItemImageProps(item.id, 'card')}
              />
            ) : null}
          </span>
          {cornerSticker ? (
            <img
              className="ad-brew-card-sticker"
              src={cornerSticker}
              alt=""
              width={120}
              height={120}
              decoding="async"
              aria-hidden
              style={
                {
                  '--brew-sticker-scale': brewCardStickerScale(cornerSticker),
                } as CSSProperties
              }
            />
          ) : null}
        </button>
        <div className="ad-brew-meta">
          <button
            type="button"
            className="ad-brew-title-hit"
            onClick={() => onOpen(item)}
            disabled={!item.isAvailable}
          >
            <span className="ad-brew-name">{item.name}</span>
            {subtitle ? <span className="ad-brew-desc">{subtitle}</span> : null}
          </button>
          <div className="ad-brew-foot">
            <span className="ad-brew-price">{formatINR(item.price)}</span>
            <button
              type="button"
              className="ad-brew-add"
              onClick={(event) => {
                event.stopPropagation();
                onAddToCart(item);
              }}
              disabled={!item.isAvailable}
            >
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
