const SHOPIFY_STORES = [
  {
    name: '401 Games',
    domain: 'store.401games.ca',
    country: 'CA',
    region: 'ON',
    shipping: { caBase: 8.95, usBase: 22.0, freeOverCad: 150 },
  },
  {
    name: 'Hobbiesville',
    domain: 'hobbiesville.com',
    country: 'CA',
    region: 'ON',
    shipping: { caBase: 9.99, usBase: 19.99, freeOverCad: 175 },
  },
  {
    name: 'House of Cards',
    domain: 'houseofcards.ca',
    country: 'CA',
    region: 'BC',
    shipping: { caBase: 11.99, usBase: 24.0, freeOverCad: 200 },
  },
];

function classifyProduct(title) {
  const t = (title || '').toLowerCase();
  if (/pre.?order|case\b|deck\b|commander deck|starter|sleeves|playmat|binder|box topper/i.test(t)) {
    return null;
  }
  if (/collector.*(box|display)/i.test(t)) return 'collector_box';
  if (/collector\s+booster/i.test(t)) return 'collector_pack';
  if (/bundle/i.test(t)) return 'bundle';
  if (/(booster\s+box|draft\s+box|set\s+box|play\s+box|display)/i.test(t)) return 'booster_box';
  if (/booster\s+pack/i.test(t) && !/collector|box topper/i.test(t)) return 'regular_pack';
  return null;
}

function getSearchQueries(productType) {
  switch (productType) {
    case 'collector_pack':
      return ['mtg collector booster pack'];
    case 'regular_pack':
      return ['mtg booster pack'];
    case 'bundle':
      return ['mtg bundle'];
    case 'booster_box':
      return ['mtg booster box'];
    case 'collector_box':
      return ['mtg collector booster box'];
    case 'any':
    default:
      return ['mtg collector booster', 'mtg booster pack', 'mtg booster box', 'mtg bundle'];
  }
}

async function verifyProductPageStock(store, product, productType) {
  try {
    const handle = product.url.split('/products/')[1]?.split('?')[0];
    if (!handle) return null;
    const res = await fetch(`https://${store.domain}/products/${handle}.js`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MTGTracker/1.0)' },
    });
    if (!res.ok) return null;
    const full = await res.json();
    const availableVariant = (full.variants || []).find((v) => v.available === true);
    if (!full.available || !availableVariant) return null;

    const category = classifyProduct(full.title);
    if (!category) return null;
    if (productType !== 'any' && category !== productType) return null;

    const rawImg = full.featured_image || full.images?.[0] || null;
    const imageUrl = rawImg
      ? rawImg.startsWith('//')
        ? `https:${rawImg}`
        : rawImg
      : null;

    return {
      id: `${store.domain}-${full.id}`,
      inStock: true,
      category,
      title: full.title,
      imageUrl,
      storeName: store.name,
      storeCountry: store.country,
      storeRegion: store.region,
      storeUrl: `https://${store.domain}/products/${handle}`,
      basePrice: +(availableVariant.price / 100).toFixed(2),
      currency: 'CAD',
      shipping: store.shipping,
      sourceTag: store.domain,
      liveStockVerified: true,
    };
  } catch {
    return null;
  }
}

async function fetchStoreInStock(store, productType) {
  try {
    const queries = getSearchQueries(productType);
    const seenIds = new Set();
    const allCandidates = [];

    for (const q of queries) {
      const url = `https://${store.domain}/search/suggest.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=8&resources[options][unavailable_products]=hide`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MTGTracker/1.0)' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const products = data?.resources?.results?.products || [];
      for (const p of products) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          const cat = classifyProduct(p.title);
          if (cat && (productType === 'any' || cat === productType)) {
            allCandidates.push(p);
          }
        }
      }
    }

    const verified = await Promise.all(
      allCandidates.slice(0, 12).map((p) => verifyProductPageStock(store, p, productType))
    );
    return verified.filter(Boolean);
  } catch {
    return [];
  }
}

export async function handler(event) {
  const params = event.queryStringParameters || {};
  const postalCode = params.postalCode || 'H2X 1Y4';
  const priceGoalCad = parseFloat(params.priceGoalCad || '50');
  const productType = params.productType || 'collector_pack';

  try {
    const [fxRes, ...storeResults] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/USD'),
      ...SHOPIFY_STORES.map((s) => fetchStoreInStock(s, productType)),
    ]);
    const fxData = await fxRes.json();
    const fxRate = fxData?.rates?.CAD || 1.4;
    const liveItems = storeResults.flat();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        ok: true,
        postalCode,
        priceGoalCad,
        productType,
        fxRate,
        liveItems,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
}
