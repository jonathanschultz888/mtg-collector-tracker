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

async function verifyProductPageStock(store, product) {
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

    return {
      id: `${store.domain}-${full.id}`,
      inStock: true,
      title: full.title,
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

async function fetchStoreInStock(store) {
  try {
    const url = `https://${store.domain}/search/suggest.json?q=collector+booster+pack&resources[type]=product&resources[limit]=10&resources[options][unavailable_products]=hide`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MTGTracker/1.0)' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const candidates = (data?.resources?.results?.products || []).filter(
      (p) =>
        /collector\s+booster/i.test(p.title) &&
        !/display|box|case|bundle|pre.?order|gift|omega/i.test(p.title)
    );

    const verified = await Promise.all(
      candidates.map((p) => verifyProductPageStock(store, p))
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

  try {
    const [fxRes, ...storeResults] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/USD'),
      ...SHOPIFY_STORES.map(fetchStoreInStock),
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
