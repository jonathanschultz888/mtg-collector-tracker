import { MTG_SETS, STORE_LISTINGS } from '../data/mtgCatalog';

export function detectPostalRegion(postalCode) {
  const clean = (postalCode || '').trim().toUpperCase();
  if (/^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/.test(clean)) {
    const firstLetter = clean[0];
    let province = 'CA';
    if (['H', 'J', 'G'].includes(firstLetter)) province = 'QC';
    else if (['K', 'L', 'M', 'N', 'P'].includes(firstLetter)) province = 'ON';
    else if (firstLetter === 'V') province = 'BC';
    else if (firstLetter === 'T') province = 'AB';
    return { country: 'CA', province, formatted: clean };
  }
  if (/^\d{5}(-\d{4})?$/.test(clean)) {
    return { country: 'US', province: 'US', formatted: clean };
  }
  return { country: 'CA', province: 'QC', formatted: clean || 'H2X 1Y4' };
}

export async function fetchUsdToCadRate() {
  try {
    const cached = localStorage.getItem('mtg_fx_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.ts < 3600 * 1000 && parsed.rate) {
        return { rate: parsed.rate, live: true };
      }
    }
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error('FX fetch failed');
    const data = await res.json();
    const rate = data?.rates?.CAD;
    if (typeof rate === 'number' && rate > 1) {
      localStorage.setItem('mtg_fx_cache', JSON.stringify({ rate, ts: Date.now() }));
      return { rate, live: true };
    }
  } catch {
    // fallback
  }
  return { rate: 1.40, live: false };
}

export async function fetchSetChaseData(setCodes) {
  const results = {};
  const uniqueCodes = [...new Set(setCodes)];

  await Promise.all(
    uniqueCodes.map(async (code) => {
      const fallback = MTG_SETS[code] || {
        name: code.toUpperCase(),
        fallbackChaseCount: 20,
        topChase: 'Chase Foil',
        topChaseCad: 80,
      };
      try {
        const cacheKey = `mtg_scryfall_${code}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.ts < 6 * 3600 * 1000) {
            results[code] = parsed.data;
            return;
          }
        }
        const res = await fetch(
          `https://api.scryfall.com/cards/search?q=set:${code}+usd>=10&order=usd`
        );
        if (!res.ok) throw new Error('Scryfall error');
        const json = await res.json();
        const topCard = json.data?.[0];
        const data = {
          chaseCount: json.total_cards || fallback.fallbackChaseCount,
          topChase: topCard ? topCard.name : fallback.topChase,
          topChaseUsd: topCard?.prices?.usd ? parseFloat(topCard.prices.usd) : null,
          live: true,
        };
        localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
        results[code] = data;
      } catch {
        results[code] = {
          chaseCount: fallback.fallbackChaseCount,
          topChase: fallback.topChase,
          topChaseUsd: null,
          live: false,
        };
      }
    })
  );

  return results;
}

export function estimateShippingCad(listing, userRegion, fxRate) {
  const { shipping, storeCountry, storeRegion } = listing;
  if (userRegion.country === 'CA') {
    if (storeCountry === 'CA') {
      // Slight discount if same province (e.g. QC->QC or ON->ON)
      const sameProvinceDiscount = storeRegion === userRegion.province ? 1.5 : 0;
      return Math.max(5.99, +(shipping.caBase - sameProvinceDiscount).toFixed(2));
    }
    // US store shipping to Canada (converted to CAD if needed, base is already estimated in CAD)
    return +shipping.caBase.toFixed(2);
  } else {
    // User in US
    if (storeCountry === 'US') {
      return +(shipping.usBase * fxRate).toFixed(2);
    }
    return +shipping.usBase.toFixed(2);
  }
}

export async function runMarketScan({ postalCode, priceGoalCad }) {
  const userRegion = detectPostalRegion(postalCode);
  let fxRate = 1.40;
  let fxLive = false;
  let liveServerItems = null;

  try {
    const apiRes = await fetch(
      `/api/scan?postalCode=${encodeURIComponent(postalCode)}&priceGoalCad=${encodeURIComponent(priceGoalCad)}`
    );
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData?.fxRate) {
        fxRate = apiData.fxRate;
        fxLive = true;
      }
      if (Array.isArray(apiData?.liveItems) && apiData.liveItems.length > 0) {
        liveServerItems = apiData.liveItems.map((item) => {
          const matchedCode =
            Object.keys(MTG_SETS).find((code) =>
              item.title.toLowerCase().includes(MTG_SETS[code].name.split(':')[0].toLowerCase())
            ) || 'fdn';
          return {
            ...item,
            setCode: matchedCode,
            historicalLowCad: +(item.basePrice * 0.92).toFixed(2),
            promo: null,
          };
        });
      }
    }
  } catch {
    // Fallback to client-side FX + catalog
  }

  if (!fxLive) {
    const fx = await fetchUsdToCadRate();
    fxRate = fx.rate;
    fxLive = fx.live;
  }

  const inStockListings = liveServerItems || STORE_LISTINGS.filter((l) => l.inStock === true);
  const setCodes = inStockListings.map((l) => l.setCode);
  const chaseMap = await fetchSetChaseData(setCodes);

  const enriched = inStockListings.map((listing) => {
    const setInfo = MTG_SETS[listing.setCode];
    const chase = chaseMap[listing.setCode];

    const basePriceCad =
      listing.currency === 'USD'
        ? +(listing.basePrice * fxRate).toFixed(2)
        : +listing.basePrice.toFixed(2);

    let promoDiscountCad = 0;
    if (listing.promo) {
      if (listing.promo.discountPct) {
        promoDiscountCad = +(basePriceCad * (listing.promo.discountPct / 100)).toFixed(2);
      } else if (listing.promo.discountFlatCad) {
        promoDiscountCad = +listing.promo.discountFlatCad.toFixed(2);
      }
    }

    const effectivePackPriceCad = Math.max(0, +(basePriceCad - promoDiscountCad).toFixed(2));
    const shippingCad = estimateShippingCad(listing, userRegion, fxRate);
    const totalLandedCad = +(effectivePackPriceCad + shippingCad).toFixed(2);

    // Use the whole Price Goal as a session budget to hit store Free Shipping / Promo thresholds
    const maxQty = Math.max(1, Math.floor(priceGoalCad / Math.max(1, effectivePackPriceCad)));
    const bundleSubtotalCad = +(maxQty * effectivePackPriceCad).toFixed(2);
    const freeShippingUnlocked = bundleSubtotalCad >= listing.shipping.freeOverCad;
    const effectiveBundleShippingCad = freeShippingUnlocked ? 0 : shippingCad;
    const bundleTotalLandedCad = +(bundleSubtotalCad + effectiveBundleShippingCad).toFixed(2);
    const amountToFreeShipping = freeShippingUnlocked
      ? 0
      : +(listing.shipping.freeOverCad - bundleSubtotalCad).toFixed(2);

    // Historical low comparison
    const pctAboveLow = +(
      ((effectivePackPriceCad - listing.historicalLowCad) / listing.historicalLowCad) *
      100
    ).toFixed(1);

    // Bang for your buck score (0 - 99), heavily weighting Free Shipping / Promo threshold unlocks
    const lowScore = Math.min(35, (listing.historicalLowCad / Math.max(1, effectivePackPriceCad)) * 33);
    const chaseScore = Math.min(35, (chase.chaseCount / 45) * 35);
    const shippingScore = freeShippingUnlocked ? 18 : Math.max(0, 14 - shippingCad * 0.6);
    const promoBonus = (promoDiscountCad > 0 ? 5 : 0) + (freeShippingUnlocked ? 6 : 0);
    const bangScore = Math.min(99, Math.round(lowScore + chaseScore + shippingScore + promoBonus));

    const meetsGoal = effectivePackPriceCad <= priceGoalCad;

    return {
      ...listing,
      setName: listing.title || setInfo.name,
      basePriceCad,
      promoDiscountCad,
      effectivePackPriceCad,
      shippingCad,
      totalLandedCad,
      maxQty,
      bundleSubtotalCad,
      freeShippingUnlocked,
      effectiveBundleShippingCad,
      bundleTotalLandedCad,
      amountToFreeShipping,
      pctAboveLow,
      chaseCount: chase.chaseCount,
      topChase: chase.topChase,
      topChaseCad: chase.topChaseUsd ? +(chase.topChaseUsd * fxRate).toFixed(0) : setInfo.topChaseCad,
      scryfallLive: chase.live,
      bangScore,
      meetsGoal,
    };
  });

  // Filter by price goal first; if fewer than 10 meet the goal, still show top 10 sorted with goal-meeters first
  const sortedAll = [...enriched].sort((a, b) => {
    if (a.meetsGoal !== b.meetsGoal) return a.meetsGoal ? -1 : 1;
    return b.bangScore - a.bangScore;
  });

  const withinGoal = enriched.filter((item) => item.meetsGoal);
  const poolForPicks = withinGoal.length > 0 ? withinGoal : enriched;

  const bestOverall = [...poolForPicks].sort((a, b) => b.bangScore - a.bangScore)[0] || null;
  const bestBudget = [...poolForPicks].sort((a, b) => a.totalLandedCad - b.totalLandedCad)[0] || null;
  const promoPool = poolForPicks.filter((item) => item.promo !== null);
  const bestPromotion =
    [...promoPool].sort((a, b) => b.promoDiscountCad - a.promoDiscountCad || b.bangScore - a.bangScore)[0] ||
    null;

  return {
    scannedAt: new Date().toISOString(),
    userRegion,
    fxRate,
    fxLive,
    priceGoalCad,
    withinGoalCount: withinGoal.length,
    top10: sortedAll.slice(0, 10),
    bestOverall,
    bestBudget,
    bestPromotion,
  };
}
