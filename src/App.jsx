import React, { useState, useEffect } from 'react';
import {
  Crown,
  Tag,
  Wallet,
  Search,
  MapPin,
  DollarSign,
  ExternalLink,
  Sparkles,
  TrendingDown,
  User,
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { runMarketScan } from './utils/scanner';

function HighlightCard({ title, subtitle, item, icon: Icon, accentClass, badgeText }) {
  if (!item) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between">
        <div className="flex items-center gap-2.5 text-slate-400">
          <Icon className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        </div>
        <p className="mt-4 text-sm text-slate-500">No packs matched this category under your current Price Goal.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border bg-slate-900/90 p-5 flex flex-col justify-between shadow-lg ${accentClass}`}>
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200">
            {badgeText}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>

        <h3 className="mt-3 text-lg font-bold text-white leading-snug">{item.setName}</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {item.storeName} ({item.storeCountry}) · {item.sourceTag}
        </p>

        {item.promo && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-medium">
            <Tag className="w-3.5 h-3.5" />
            {item.promo.label} (-${item.promoDiscountCad.toFixed(2)} CAD)
          </div>
        )}
        {item.freeShippingUnlocked ? (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Free Shipping Unlocked ({item.maxQty}x packs = ${item.bundleSubtotalCad.toFixed(2)} CAD)
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-slate-400">
            Session ({item.maxQty}x): ${item.bundleSubtotalCad.toFixed(2)} · ${item.amountToFreeShipping.toFixed(2)} away from Free Ship (${item.shipping.freeOverCad})
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-end justify-between">
        <div>
          <div className="text-xs text-slate-400">
            {item.maxQty > 1 ? `Bundle (${item.maxQty}x) Landed` : 'Total Landed (incl. ship)'}
          </div>
          <div className="text-2xl font-extrabold text-white">
            ${item.bundleTotalLandedCad.toFixed(2)} <span className="text-xs font-normal text-slate-400">CAD</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Pack ${item.effectivePackPriceCad.toFixed(2)} ea + Ship ${item.effectiveBundleShippingCad.toFixed(2)}
          </div>
        </div>
        <a
          href={item.storeUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
        >
          Buy <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mtg_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginInput, setLoginInput] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [postalCode, setPostalCode] = useState(() => {
    const savedUser = localStorage.getItem('mtg_current_user');
    if (savedUser) {
      const u = JSON.parse(savedUser);
      const userPostal = localStorage.getItem(`mtg_postal_${u.username}`);
      if (userPostal) return userPostal;
    }
    return localStorage.getItem('mtg_guest_postal') || 'H2X 1Y4';
  });

  const [priceGoalCad, setPriceGoalCad] = useState(50);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const handleScan = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      if (user) {
        localStorage.setItem(`mtg_postal_${user.username}`, postalCode);
      } else {
        localStorage.setItem('mtg_guest_postal', postalCode);
      }
      const res = await runMarketScan({
        postalCode,
        priceGoalCad: Number(priceGoalCad) || 50,
      });
      setScanResult(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleScan();
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const clean = loginInput.trim();
    if (!clean) return;
    const newUser = { username: clean };
    setUser(newUser);
    localStorage.setItem('mtg_current_user', JSON.stringify(newUser));
    const savedPostal = localStorage.getItem(`mtg_postal_${clean}`);
    if (savedPostal) {
      setPostalCode(savedPostal);
    } else {
      localStorage.setItem(`mtg_postal_${clean}`, postalCode);
    }
    setLoginInput('');
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('mtg_current_user');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                MTG Collector Booster Tracker
              </h1>
              <p className="text-xs text-slate-400">
                CA & US Price Scanner · All prices in CAD · Live Scryfall EV & FX
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {scanResult && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                <span>1 USD = {scanResult.fxRate.toFixed(2)} CAD</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    scanResult.fxLive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                  title={scanResult.fxLive ? 'Live FX Rate' : 'Fallback FX Rate'}
                />
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-white">{user.username}</span>
                <button
                  onClick={handleLogout}
                  className="ml-1 text-slate-400 hover:text-white"
                  title="Log out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition"
              >
                <User className="w-3.5 h-3.5 text-amber-400" />
                Log in to save postal code
              </button>
            )}
          </div>
        </div>

        {/* Scan Controls Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
          <form
            onSubmit={handleScan}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800"
          >
            <div className="sm:col-span-5 flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="w-full">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Ship To Postal / ZIP ("Me")
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                  placeholder="e.g. H2X 1Y4 or 10001"
                  className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none"
                />
              </div>
              {scanResult && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                  {scanResult.userRegion.province}, {scanResult.userRegion.country}
                </span>
              )}
            </div>

            <div className="sm:col-span-4 flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2">
              <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="w-full">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Session Price Goal (Max CAD)
                </label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  step="1"
                  value={priceGoalCad}
                  onChange={(e) => setPriceGoalCad(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none"
                />
              </div>
              <span className="text-xs text-slate-400 font-medium">CAD</span>
            </div>

            <div className="sm:col-span-3 flex items-stretch">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-sm transition cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Scanning...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" /> Run Scan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Top 3 Highlight Cards */}
        {scanResult && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Top Picks Under ${scanResult.priceGoalCad.toFixed(2)} CAD
              </h2>
              <span className="text-xs text-slate-500">
                {scanResult.withinGoalCount} of {scanResult.top10.length} top packs meet your goal
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <HighlightCard
                title="Best Overall"
                subtitle="Highest Bang-for-Your-Buck score (low price + high-value pulls)"
                item={scanResult.bestOverall}
                icon={Crown}
                accentClass="border-amber-500/40 shadow-amber-500/5"
                badgeText={scanResult.bestOverall ? `Score ${scanResult.bestOverall.bangScore}/99` : ''}
              />
              <HighlightCard
                title="Best Budget"
                subtitle="Lowest total landed cost (pack + shipping to you)"
                item={scanResult.bestBudget}
                icon={Wallet}
                accentClass="border-emerald-500/40 shadow-emerald-500/5"
                badgeText="Lowest Landed"
              />
              <HighlightCard
                title="Best Promotion"
                subtitle="Best active store promo that meets your price goal"
                item={scanResult.bestPromotion}
                icon={Tag}
                accentClass="border-violet-500/40 shadow-violet-500/5"
                badgeText={
                  scanResult.bestPromotion
                    ? `Save $${scanResult.bestPromotion.promoDiscountCad.toFixed(2)}`
                    : 'No Promo'
                }
              />
            </div>
          </section>
        )}

        {/* Top 10 Ranked Table */}
        {scanResult && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white">
                  Top 10 Best-Priced Collector Boosters (CAD)
                </h2>
                <p className="text-xs text-slate-400">
                  Ranked by Bang-for-Your-Buck: proximity to historical low, $14+ CAD chase cards in set, and shipping to{' '}
                  <span className="text-slate-200 font-semibold">{scanResult.userRegion.formatted}</span>.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-800/80">
              {scanResult.top10.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/30 transition"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-amber-400 shrink-0">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-white text-sm sm:text-base">{item.setName}</h3>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {item.storeName} · {item.storeCountry}
                        </span>
                        {item.meetsGoal ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Meets Goal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/15 text-rose-300">
                            <AlertCircle className="w-3 h-3" /> Over Goal
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                          {item.pctAboveLow <= 3
                            ? 'Near Historical Low'
                            : `+${item.pctAboveLow}% vs Low ($${item.historicalLowCad.toFixed(2)})`}
                        </span>
                        <span>
                          <strong className="text-slate-200">{item.chaseCount}</strong> high-value cards ($14+ CAD)
                        </span>
                        <span>
                          Top Chase: <strong className="text-slate-200">{item.topChase}</strong> (~${item.topChaseCad} CAD)
                        </span>
                      </div>

                      {item.promo && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-violet-300 font-medium">
                          <Tag className="w-3 h-3" /> {item.promo.label}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-5 pl-11 lg:pl-0">
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] text-slate-400">Bang Score</div>
                      <div className="text-sm font-bold text-amber-400">{item.bangScore} / 99</div>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-[11px] text-slate-400">
                        {item.maxQty}x Pack (${item.effectivePackPriceCad.toFixed(2)} ea) + Ship ${item.effectiveBundleShippingCad.toFixed(2)}
                      </div>
                      <div className="text-lg font-extrabold text-white">
                        ${item.bundleTotalLandedCad.toFixed(2)}{' '}
                        <span className="text-xs font-normal text-slate-400">CAD</span>
                      </div>
                      {item.freeShippingUnlocked && (
                        <div className="text-[10px] font-semibold text-emerald-400">Free Shipping Unlocked!</div>
                      )}
                    </div>

                    <a
                      href={item.storeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition shrink-0"
                    >
                      Store <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Simple Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Sign In</h3>
            <p className="text-xs text-slate-400 mt-1">
              Enter a username or email to remember your postal code across sessions.
            </p>
            <form onSubmit={handleLogin} className="mt-4 space-y-3">
              <input
                type="text"
                required
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="e.g. alex@mtg.ca"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                >
                  Save & Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
