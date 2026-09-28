// CSS selectors for Coupang pages, tried in order. When Coupang changes its markup,
// open a product page in the browser, inspect the price, and add the new selector at the front.

export const PRODUCT = {
  title: ['h1.prod-buy-header__title', '.prod-buy-header__title', 'h1.product-title', 'h1'],
  salePrice: [
    '.prod-sale-price .total-price strong',
    '.prod-coupon-price .total-price strong',
    '.total-price strong',
    '.price-container .final-price-amount',
    '.final-price .price-amount',
    '.sales-price-amount',
  ],
  originalPrice: [
    '.prod-origin-price .origin-price',
    '.origin-price',
    '.price-container .original-price-amount',
    '.original-price .price-amount',
    '.base-price',
  ],
  discountRate: [
    '.prod-origin-price .discount-rate',
    '.discount-rate',
    '.original-price .discount-percentage',
    '.discount-percentage',
  ],
  image: ['.prod-image__detail', 'img.prod-image__detail', '.product-image img', '.twc-w-full img'],
  soldOut: ['.oos-label', '.prod-not-find-known__buy__button', '.out-of-stock', '.sold-out'],
  rocket: ['img[src*="rocket"]', '.badge.rocket', '[class*="rocket"]'],
};

export const LIST = {
  item: ['li.search-product', 'li.baby-product', 'li[class*="ProductUnit"]', 'li'],
};
