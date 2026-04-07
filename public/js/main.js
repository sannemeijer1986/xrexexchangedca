(() => {
  const STATE_CONFIGS = {
    flow: {
      storageKey: 'xrexexchange.dcaFlowState.v1',
      min: 1,
      max: 4,
      labels: {
        1: 'State 1',
        2: 'State 2',
        3: 'State 3',
        4: 'State 4',
      },
    },
    financeIntro: {
      storageKey: 'xrexexchange.financeIntroState.v1',
      min: 1,
      max: 2,
      /** Default on load (build badge can still switch to state 1). */
      initial: 1,
      labels: {
        1: 'State 1 (first view)',
        2: 'State 2 (compact)',
      },
    },
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const states = {};

  /** Set by initMyPlansPanel — refreshes plan cards when Flow progress changes */
  let syncMyPlansFlowUi = () => {};

  const syncTopChromeHeight = () => {
    const topChrome = document.querySelector('.top-chrome');
    if (!topChrome) return;
    document.documentElement.style.setProperty('--top-chrome-height', `${topChrome.offsetHeight}px`);
  };

  const syncFinanceSummaryVisibility = () => {
    const flowState = states.flow ?? 1;
    const shouldHide = flowState <= 1;
    document.querySelectorAll('.finance-summary__pnl, .finance-summary__meta-row').forEach((el) => {
      el.classList.toggle('is-hidden', shouldHide);
      el.hidden = shouldHide;
    });

    const isFlowOne = flowState === 1;
    const topEl = document.querySelector('.finance-summary__top');
    if (topEl) {
      topEl.hidden = isFlowOne;
      topEl.classList.toggle('is-hidden', isFlowOne);
    }
    const actionsEl = document.querySelector('.finance-summary__actions');
    if (actionsEl) {
      actionsEl.classList.toggle('finance-summary__actions--full-radius', isFlowOne);
    }

  };

  const syncFinanceIntroState = () => {
    const fiCfg = STATE_CONFIGS.financeIntro;
    const introState =
      states.financeIntro
      ?? (typeof fiCfg?.initial === 'number' ? fiCfg.initial : fiCfg.min);
    const first = document.querySelector('[data-finance-intro-state="1"]');
    const compact = document.querySelector('[data-finance-intro-state="2"]');
    if (first) first.hidden = introState !== 1;
    if (compact) compact.hidden = introState !== 2;
  };

  const getLabel = (group, value) => {
    const config = STATE_CONFIGS[group];
    if (!config) return '';
    return config.labels[value] || '';
  };

  const updateGroupUI = (group) => {
    const config = STATE_CONFIGS[group];
    const groupEl = document.querySelector(`[data-state-group="${group}"]`);
    if (!config || !groupEl) return;

    const valueEl = groupEl.querySelector('[data-state-value]');
    const nameEl = groupEl.querySelector('[data-state-name]');
    const downBtn = groupEl.querySelector('[data-state-action="down"]');
    const upBtn = groupEl.querySelector('[data-state-action="up"]');
    const value = states[group];

    if (valueEl) valueEl.textContent = value;
    if (nameEl) {
      const label = getLabel(group, value);
      nameEl.textContent = label;
      nameEl.dataset.stateLabel = label;
    }
    if (downBtn) downBtn.disabled = value <= config.min;
    if (upBtn) upBtn.disabled = value >= config.max;
  };

  const setState = (group, next, opts = {}) => {
    const config = STATE_CONFIGS[group];
    if (!config) return config?.min ?? 1;
    const clamped = clamp(parseInt(next, 10), config.min, config.max);
    if (!opts.force && states[group] === clamped) return clamped;

    states[group] = clamped;
    try {
      if (window.localStorage) {
        window.localStorage.setItem(config.storageKey, String(clamped));
      }
    } catch (_) {
      // ignore storage errors
    }
    updateGroupUI(group);
    if (group === 'flow') {
      const fiCfg = STATE_CONFIGS.financeIntro;
      const introEffective =
        states.financeIntro
        ?? (typeof fiCfg?.initial === 'number' ? fiCfg.initial : fiCfg.min);
      if (clamped > 1 && introEffective !== 2) {
        setState('financeIntro', 2, { force: true });
      }
      syncFinanceSummaryVisibility();
      syncMyPlansFlowUi();
    }
    if (group === 'financeIntro') {
      syncFinanceIntroState();
    }
    return clamped;
  };

  const changeState = (group, delta) => setState(group, states[group] + (delta || 0));

  const initStates = () => {
    Object.keys(STATE_CONFIGS).forEach((group) => {
      const config = STATE_CONFIGS[group];
      const rawInitial = typeof config.initial === 'number' ? config.initial : config.min;
      const clamped = clamp(rawInitial, config.min, config.max);
      states[group] = clamped;
      try {
        if (window.localStorage) {
          window.localStorage.setItem(config.storageKey, String(clamped));
        }
      } catch (_) {
        // ignore storage errors
      }
      updateGroupUI(group);
    });
    syncFinanceSummaryVisibility();
    syncFinanceIntroState();
  };

  const initBadgeControls = () => {
    const badge = document.querySelector('.build-badge');
    if (!badge) return;
    const header = badge.querySelector('.build-badge__header');
    const body = badge.querySelector('.build-badge__body');
    const toggleCollapse = () => {
      const isCollapsed = badge.classList.toggle('is-collapsed');
      if (header) header.setAttribute('aria-expanded', String(!isCollapsed));
      if (body) body.hidden = false;
    };

    if (header) {
      header.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleCollapse();
      });
    }

    badge.addEventListener('click', (event) => {
      if (!badge.classList.contains('is-collapsed')) return;
      if (event.target.closest('[data-state-action]')) return;
      toggleCollapse();
    });

    badge.addEventListener('click', (event) => {
      const button = event.target.closest('[data-state-action]');
      if (!button) return;
      const groupEl = button.closest('[data-state-group]');
      if (!groupEl) return;
      const group = groupEl.getAttribute('data-state-group');
      if (!STATE_CONFIGS[group]) return;

      const action = button.getAttribute('data-state-action');
      if (action === 'down') changeState(group, -1);
      if (action === 'up') changeState(group, 1);
    });
  };

  const initTabs = () => {
    const content = document.querySelector('[data-content]');
    const tabButtons = Array.from(document.querySelectorAll('[data-tab-target]'));
    const tabViews = Array.from(document.querySelectorAll('[data-tab-view]'));
    const openTabTriggers = Array.from(document.querySelectorAll('[data-open-tab]'));

    if (!content || tabViews.length === 0) {
      return { setActiveTab: () => {} };
    }

    const setActiveTab = (tabId) => {
      document.documentElement.dataset.activeTab = tabId;
      tabViews.forEach((view) => {
        const isActive = view.getAttribute('data-tab-view') === tabId;
        view.hidden = !isActive;
      });
      tabButtons.forEach((btn) => {
        const isActive = btn.getAttribute('data-tab-target') === tabId;
        btn.classList.toggle('is-active', isActive);

        const icon = btn.querySelector('img[data-src-active][data-src-inactive]');
        if (icon) {
          const nextSrc = isActive ? icon.dataset.srcActive : icon.dataset.srcInactive;
          if (nextSrc) icon.src = nextSrc;
        }
      });
      content.scrollTop = 0;
      requestAnimationFrame(syncTopChromeHeight);
    };

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => setActiveTab(btn.getAttribute('data-tab-target')));
    });

    const openFinance = () => setActiveTab('finance');
    openTabTriggers.forEach((el) => {
      el.addEventListener('click', openFinance);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFinance();
        }
      });
    });

    setActiveTab('home');
    syncTopChromeHeight();
    window.addEventListener('resize', () => syncTopChromeHeight(), { passive: true });
    return { setActiveTab };
  };

  const initFinanceHeaderTabs = () => {
    const tabButtons = Array.from(document.querySelectorAll('[data-finance-header-tab]'));
    const pages = Array.from(document.querySelectorAll('[data-finance-page]'));
    if (tabButtons.length === 0 || pages.length === 0) {
      return { setFinancePage: () => {} };
    }

    const setPage = (pageId) => {
      document.documentElement.dataset.financePage = pageId;
      tabButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-finance-header-tab') === pageId);
      });
      pages.forEach((page) => {
        page.hidden = page.getAttribute('data-finance-page') !== pageId;
      });
      const content = document.querySelector('[data-content]');
      if (content) content.scrollTop = 0;
    };

    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => setPage(btn.getAttribute('data-finance-header-tab')));
    });

    setPage('auto');
    return { setFinancePage: setPage };
  };

  const initFinanceSectionNav = () => {
    const loanPage = document.querySelector('[data-finance-page="loan"]');
    const nav = loanPage?.querySelector('[data-finance-section-nav]');
    if (!nav) return;

    const buttons = Array.from(nav.querySelectorAll('[data-finance-section]'));
    const views = Array.from(loanPage.querySelectorAll('[data-finance-view]'));

    const setSection = (sectionId) => {
      buttons.forEach((btn) => btn.classList.toggle('is-active', btn.getAttribute('data-finance-section') === sectionId));
      views.forEach((view) => {
        view.hidden = view.getAttribute('data-finance-view') !== sectionId;
      });
    };

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => setSection(btn.getAttribute('data-finance-section')));
    });

    setSection('explore');
  };

  /** Carousel / widget keys → tickers + icons for “historic performance” column (matches plan detail baskets). */
  const PLAN_DISPLAY_ASSETS_BY_KEY = {
    bitcoin: [{ name: 'Bitcoin', ticker: 'BTC', icon: 'assets/icon_currency_btc.svg' }],
    ethereum: [{ name: 'Ethereum', ticker: 'ETH', icon: 'assets/icon_currency_eth.svg' }],
    solana: [{ name: 'Solana', ticker: 'SOL', icon: 'assets/icon_solana.svg' }],
    bigthree: [
      { name: 'Bitcoin', ticker: 'BTC', icon: 'assets/icon_currency_btc.svg' },
      { name: 'Ethereum', ticker: 'ETH', icon: 'assets/icon_currency_eth.svg' },
      { name: 'Solana', ticker: 'SOL', icon: 'assets/icon_solana.svg' },
    ],
    digitalgold: [
      { name: 'Bitcoin', ticker: 'BTC', icon: 'assets/icon_currency_btc.svg' },
      { name: 'Tether Gold', ticker: 'XAUT', icon: 'assets/icon_currency_xaut.svg' },
    ],
    aiessentials: [
      { name: 'Render', ticker: 'RENDER', icon: 'assets/icon_currency_render.svg' },
      { name: 'NEAR', ticker: 'NEAR', icon: 'assets/icon_currency_near.svg' },
      { name: 'Solana', ticker: 'SOL', icon: 'assets/icon_solana.svg' },
    ],
  };
  Object.assign(PLAN_DISPLAY_ASSETS_BY_KEY, {
    btc: PLAN_DISPLAY_ASSETS_BY_KEY.bitcoin,
    eth: PLAN_DISPLAY_ASSETS_BY_KEY.ethereum,
    sol: PLAN_DISPLAY_ASSETS_BY_KEY.solana,
    xaut: [{ name: 'Tether Gold', ticker: 'XAUT', icon: 'assets/icon_currency_xaut.svg' }],
    render: [{ name: 'Render', ticker: 'RENDER', icon: 'assets/icon_currency_render.svg' }],
    near: [{ name: 'NEAR', ticker: 'NEAR', icon: 'assets/icon_currency_near.svg' }],
    link: [{ name: 'Chainlink', ticker: 'LINK', icon: 'assets/icon_currency_link.svg' }],
    xrp: [{ name: 'XRP', ticker: 'XRP', icon: 'assets/icon_currency_xrp.svg' }],
    ondo: [{ name: 'Ondo', ticker: 'ONDO', icon: 'assets/icon_currency_btc.svg' }],
    pol: [{ name: 'Polkadot', ticker: 'POL', icon: 'assets/icon_currency_btc.svg' }],
    ada: [{ name: 'Cardano', ticker: 'ADA', icon: 'assets/icon_currency_btc.svg' }],
    aave: [{ name: 'Aave', ticker: 'AAVE', icon: 'assets/icon_currency_btc.svg' }],
  });

  /** Historic column caption: one asset → "BTC performance"; 2+ → "Comb. performance". */
  const buildHistoricPerformanceCaption = (assets) => {
    const tickers = (assets || [])
      .map((it) => String(it?.ticker || '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (!tickers.length) return 'Price change';
    if (tickers.length === 1) return `Price change`;
    return 'Price change';
  };

  const escReturnMetricAttr = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');

  /**
   * Expand [monthIndex, usd] knots into 60 monthly USD levels (~Jan 2020 → month 59 ≈ late 2024).
   * Piecewise linear; rough crypto / gold shapes for the plan DCA prototype (not live or exact data).
   */
  const expandPrototypeHistoricKnotsToMonthly60 = (knots) => {
    const sorted = [...knots].sort((a, b) => a[0] - b[0]);
    const last = sorted.length - 1;
    const out = new Array(60);
    for (let m = 0; m < 60; m += 1) {
      if (m <= sorted[0][0]) {
        out[m] = sorted[0][1];
        continue;
      }
      if (m >= sorted[last][0]) {
        out[m] = sorted[last][1];
        continue;
      }
      let i = 0;
      while (i < last && m > sorted[i + 1][0]) i += 1;
      const [m0, p0] = sorted[i];
      const [m1, p1] = sorted[i + 1];
      const t = (m - m0) / (m1 - m0);
      out[m] = p0 + t * (p1 - p0);
    }
    return out;
  };

  /** Monthly USD reference series for `updatePlanStrategyHistoricalReturn` (indices 0…59). */
  const PROTOTYPE_HISTORIC_MONTHLY_USD = {
    bitcoin: expandPrototypeHistoricKnotsToMonthly60([
      [0, 8300],
      [2, 5200],
      [5, 9800],
      [10, 13200],
      [14, 29500],
      [18, 58000],
      [22, 33500],
      [26, 47500],
      [28, 59000],
      [32, 36500],
      [36, 16800],
      [40, 23200],
      [44, 30500],
      [48, 42800],
      [52, 53500],
      [56, 62800],
      [59, 69800],
    ]),
    ethereum: expandPrototypeHistoricKnotsToMonthly60([
      [0, 145],
      [2, 88],
      [6, 245],
      [12, 390],
      [16, 1850],
      [20, 4150],
      [24, 2250],
      [28, 3050],
      [32, 1080],
      [36, 1180],
      [40, 1580],
      [44, 1880],
      [48, 2380],
      [52, 2520],
      [56, 2620],
      [59, 2720],
    ]),
    solana: expandPrototypeHistoricKnotsToMonthly60([
      [0, 1.12],
      [4, 1.55],
      [8, 4.5],
      [12, 18],
      [16, 155],
      [20, 218],
      [24, 34],
      [28, 12],
      [32, 8.5],
      [36, 12.5],
      [40, 24],
      [44, 62],
      [48, 108],
      [52, 142],
      [56, 175],
      [59, 198],
    ]),
    digitalgold: expandPrototypeHistoricKnotsToMonthly60([
      [0, 1540],
      [10, 1690],
      [20, 1840],
      [30, 1920],
      [40, 1990],
      [50, 2320],
      [59, 2650],
    ]),
    /** Prototype S&P-style index (same 60-month grid as crypto) for breakdown chart benchmark line. */
    sp500: expandPrototypeHistoricKnotsToMonthly60([
      [0, 100],
      [2, 78],   // early drawdown
      [10, 138], // strong recovery + melt-up
      [18, 172],
      [24, 186],
      [31, 132], // 2022-style pullback
      [38, 158],
      [45, 195],
      [52, 223],
      [59, 246],
    ]),
  };

  const HISTORIC_SIM_MONTHS = 60;

  /** USD index price at integer month — shared by `updatePlanStrategyHistoricalReturn` and breakdown chart. */
  const historicIndexUsdAtMonth = (planKey, m) => {
    const months = HISTORIC_SIM_MONTHS;
    const mm = clamp(m, 0, months - 1);
    const usdAt = (series, idx) => {
      const arr = PROTOTYPE_HISTORIC_MONTHLY_USD[series] || PROTOTYPE_HISTORIC_MONTHLY_USD.bitcoin;
      return arr[idx];
    };
    const pk = String(planKey || 'bitcoin').toLowerCase();
    if (pk === 'bigthree') {
      const btc = usdAt('bitcoin', mm);
      const eth = usdAt('ethereum', mm);
      const sol = usdAt('solana', mm);
      const btc0 = usdAt('bitcoin', 0);
      const eth0 = usdAt('ethereum', 0);
      const sol0 = usdAt('solana', 0);
      return 100 * ((btc / btc0) * 0.45 + (eth / eth0) * 0.35 + (sol / sol0) * 0.2);
    }
    if (pk === 'aiessentials') {
      const btc = usdAt('bitcoin', mm);
      const eth = usdAt('ethereum', mm);
      const sol = usdAt('solana', mm);
      const btc0 = usdAt('bitcoin', 0);
      const eth0 = usdAt('ethereum', 0);
      const sol0 = usdAt('solana', 0);
      return 100 * ((btc / btc0) * 0.2 + (eth / eth0) * 0.3 + (sol / sol0) * 0.5);
    }
    if (pk === 'sp500') return usdAt('sp500', mm);
    const seriesKey = PROTOTYPE_HISTORIC_MONTHLY_USD[pk] ? pk : 'bitcoin';
    return usdAt(seriesKey, mm);
  };

  const historicIndexUsdAtFractionalMonth = (planKey, t) => {
    const months = HISTORIC_SIM_MONTHS;
    const tt = clamp(t, 0, months - 1);
    const m0 = Math.floor(tt);
    const u = tt - m0;
    if (m0 >= months - 1) {
      return historicIndexUsdAtMonth(planKey, months - 1);
    }
    const p0 = historicIndexUsdAtMonth(planKey, m0);
    const p1 = historicIndexUsdAtMonth(planKey, m0 + 1);
    return p0 + u * (p1 - p0);
  };

  const planHistoricFxMultiplier = () => {
    const fxTwdPerUsd = 32;
    const isUsdt = (typeof currencyState !== 'undefined' ? currencyState.plan : 'TWD') === 'USDT';
    return isUsdt ? 1 : fxTwdPerUsd;
  };

  const activeAnchorPlanFromCarouselKey = (activePlan) => {
    const map = {
      btc: 'bitcoin',
      eth: 'ethereum',
      xaut: 'digitalgold',
      sol: 'solana',
      render: 'solana',
      near: 'solana',
      link: 'solana',
      ondo: 'solana',
      pol: 'solana',
      xrp: 'solana',
      aave: 'solana',
      ada: 'solana',
    };
    const key = String(activePlan || 'bitcoin').toLowerCase();
    return map[key] || key;
  };

  /**
   * Month-end DCA series for the breakdown chart: strategy portfolio value, cumulative invested (same as stats row),
   * and S&P prototype DCA portfolio value — all in plan currency (TWD / USDT after fx).
   * @returns {{ strategyValue: number[], sp500Value: number[], investedValue: number[], xYears: string[], yTicks: number[], yMax: number }}
   */
  const computePlanBreakdownChartSeries = ({
    amount,
    planKey,
    freq,
    historicalRangeKey,
  }) => {
    const months = HISTORIC_SIM_MONTHS;
    const rangeMonthsMap = { '5Y': 60, '3Y': 36, '1Y': 12 };
    const simRangeKey = historicalRangeKey || (typeof rangeState !== 'undefined' ? rangeState.plan : '5Y') || '5Y';
    const periodMonths = rangeMonthsMap[simRangeKey] || 60;
    const startMonth = months - periodMonths;
    const fx = planHistoricFxMultiplier();
    const pkLower = String(planKey || 'bitcoin').toLowerCase();
    const activeAnchorPlan = activeAnchorPlanFromCarouselKey(pkLower);

    const occurrencesPerMonth = (() => {
      if (freq === 'daily') return 365.0 / 12.0;
      if (freq === 'weekly') return 52.0 / 12.0;
      return 1.0;
    })();

    const runDcaMonthSeries = (pricePlanKey) => {
      let assetAccum = 0;
      let totalInvested = 0;
      const out = [];
      if (freq === 'monthly') {
        for (let m = startMonth; m < months; m += 1) {
          const priceLocal = historicIndexUsdAtMonth(pricePlanKey, m) * fx;
          if (priceLocal > 0) {
            assetAccum += amount / priceLocal;
            totalInvested += amount;
          }
          const endPrice = historicIndexUsdAtMonth(pricePlanKey, m) * fx;
          const value = assetAccum * endPrice;
          out.push({
            cumInv: totalInvested,
            value,
          });
        }
        return out;
      }
      const numBuys = Math.max(1, Math.round(periodMonths * occurrencesPerMonth));
      const span = months - 1 - startMonth;
      const states = [];
      for (let k = 0; k < numBuys; k += 1) {
        const tt = numBuys === 1 ? startMonth : startMonth + (k / (numBuys - 1)) * span;
        const priceLocal = historicIndexUsdAtFractionalMonth(pricePlanKey, tt) * fx;
        if (priceLocal <= 0) continue;
        assetAccum += amount / priceLocal;
        totalInvested += amount;
        const mark = historicIndexUsdAtFractionalMonth(pricePlanKey, tt) * fx;
        states.push({ t: tt, cumInv: totalInvested, value: assetAccum * mark });
      }
      for (let m = startMonth; m < months; m += 1) {
        const cutoff = m + 1 - 1e-9;
        const last =
          [...states].filter((s) => s.t <= cutoff).pop() || { cumInv: 0, value: 0 };
        out.push({
          cumInv: last.cumInv,
          value: last.value,
        });
      }
      return out;
    };

    const stratRows = runDcaMonthSeries(activeAnchorPlan);
    const spRows = runDcaMonthSeries('sp500');
    const n = stratRows.length;
    if (!n) {
      return {
        strategyValue: [0],
        sp500Value: [0],
        investedValue: [0],
        xYears: [String(2020)],
        yTicks: [0, 1, 2, 3],
        yMax: 3,
      };
    }
    const strategyValue = stratRows.map((r) => r.value);
    const sp500Value = spRows.map((r) => r.value);
    const investedValue = stratRows.map((r) => r.cumInv);

    const baseYear = 2020;
    const xYears = stratRows.map((_, i) => String(baseYear + Math.floor((startMonth + i) / 12)));

    const rawPeak = Math.max(
      1,
      ...strategyValue,
      ...sp500Value,
      ...investedValue,
    );
    // Keep top headroom tight while still using readable "nice" axis steps.
    const padded = rawPeak * 1.02;
    const exp = Math.floor(Math.log10(Math.max(padded, 1)));
    const unit = 10 ** exp;
    const niceSteps = [1, 1.2, 1.5, 1.8, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];
    const yMax =
      niceSteps
        .map((s) => s * unit)
        .find((v) => v >= padded) || (12 * unit);
    const yTicks = [0, Math.round(yMax / 3), Math.round((2 * yMax) / 3), yMax];

    return { strategyValue, sp500Value, investedValue, xYears, yTicks, yMax };
  };

  const BREAKDOWN_CHART_VIEW = { w: 299, h: 177, left: 2.5, right: 262, top: 18, bottom: 150 };

  const formatBreakdownChartYTick = (n) => {
    const abs = Math.abs(n);
    const round1 = (x) => {
      const r = Math.round(x * 10) / 10;
      return Number.isInteger(r) ? r.toString() : r.toString();
    };
    if (abs < 1) return '0';
    if (abs < 10000) return abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (abs < 1000000) return `${round1(abs / 1000)}K`;
    return `${round1(abs / 1000000)}M`;
  };

  const renderPlanBreakdownChartSvg = (svgEl, series) => {
    if (!svgEl || !series) return;
    const { strategyValue, sp500Value, investedValue, xYears, yTicks, yMax } = series;
    const showSp500 = getPrototypeBreakdownSp500Visible();
    const n = strategyValue.length;
    const { w, h, left, right, top, bottom } = BREAKDOWN_CHART_VIEW;
    const xAt = (i) => (n <= 1 ? left : left + (i / (n - 1)) * (right - left));
    const yScaleMax = yMax > 0 ? yMax : 1;
    const yAt = (v) => bottom - (clamp(v, 0, yScaleMax) / yScaleMax) * (bottom - top);

    const pathFrom = (arr) => {
      if (!arr.length) return '';
      return arr
        .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`)
        .join(' ');
    };
    const circlesFor = (arr, color) => {
      if (!arr.length) return '';
      const firstX = xAt(0);
      const firstY = yAt(arr[0]);
      if (arr.length === 1) {
        return `<circle cx="${firstX.toFixed(2)}" cy="${firstY.toFixed(2)}" r="2.5" fill="${color}" />`;
      }
      const lastX = xAt(arr.length - 1);
      const lastY = yAt(arr[arr.length - 1]);
      return [
        `<circle cx="${firstX.toFixed(2)}" cy="${firstY.toFixed(2)}" r="2.5" fill="${color}" />`,
        `<circle cx="${lastX.toFixed(2)}" cy="${lastY.toFixed(2)}" r="2.5" fill="${color}" />`,
      ].join('');
    };

    const yearLabels = [];
    const seenY = new Set();
    for (let i = 0; i < n; i += 1) {
      const y = xYears[i];
      if (!seenY.has(y)) {
        seenY.add(y);
        yearLabels.push({ text: y, x: xAt(i) });
      }
    }

    const yLabelX = right + 4;
    const yLabelsHtml = yTicks
      .map((tick) => {
        const yy = yAt(tick);
        const label = tick <= 0 ? '0' : formatBreakdownChartYTick(tick);
        return `<text x="${yLabelX}" y="${yy + 4}" fill="#58595A" font-size="10" font-weight="600">${label}</text>`;
      })
      .join('');

    const xLabelsHtml = yearLabels
      .map(({ text }, idx) => {
        const nLabels = yearLabels.length;
        const isFirst = idx === 0;
        const isLast = idx === nLabels - 1;
        const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
        const xx = nLabels <= 1 ? left : left + (idx / (nLabels - 1)) * (right - left);
        return `<text x="${xx}" y="${bottom + 14}" fill="#58595A" font-size="11" font-weight="600" text-anchor="${anchor}">${text}</text>`;
      })
      .join('');

    const gridHtml = yTicks
      .map((tick) => {
        const yy = yAt(tick);
        return `<path d="M${left} ${yy}H${right}" stroke="#3C4248" />`;
      })
      .join('');

    svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svgEl.innerHTML = `
      <path d="M${left} ${bottom}H${right}" stroke="#3C4248" />
      <path d="M${right} ${top}V${bottom}" stroke="#3C4248" />
      ${gridHtml}
      <path d="${pathFrom(investedValue)}" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      ${showSp500 ? `<path d="${pathFrom(sp500Value)}" stroke="#275CFD" stroke-width="2" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" />` : ''}
      <path d="${pathFrom(strategyValue)}" stroke="#8FB8FF" stroke-width="2" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      ${circlesFor(investedValue, '#ffffff')}
      ${showSp500 ? circlesFor(sp500Value, '#275CFD') : ''}
      ${circlesFor(strategyValue, '#8FB8FF')}
      ${xLabelsHtml}
      ${yLabelsHtml}
    `;
  };

  /**
   * Same pyramid stack as `plan-detail-panel__product-icon-wrap` (single / 2 / 3 assets), compact size via CSS.
   */
  /**
   * Builds historic return icon markup plus a stable signature. Prefer the signature over
   * `innerHTML` string compare — browsers normalize serialized HTML (attribute order, etc.),
   * so `el.innerHTML !== template` is almost always true after first paint and caused icon flicker
   * on every slider tick.
   */
  const buildReturnMetricProductIconWrap = (assets, fallbackIcon) => {
    const items = (assets || []).slice(0, 3).filter((a) => a && a.icon);
    const fb = fallbackIcon || 'assets/icon_currency_btc.svg';
    const singleClass = 'plan-detail-panel__product-icon plan-return-metric__product-icon';
    let inner;
    let sig;
    if (items.length >= 2) {
      const twoOnly = items.length === 2;
      const mod = twoOnly ? ' plan-detail-panel__icon-stack--two' : '';
      const baseClass = `plan-detail-panel__icon-stack${mod}`;
      const [a, b, c] = [items[0], items[1], items[2]];
      const br = c?.icon
        ? `<img src="${escReturnMetricAttr(c.icon)}" alt="" />`
        : '<span class="plan-detail-panel__icon-stack-placeholder" aria-hidden="true"></span>';
      inner = `<div class="${baseClass}" aria-hidden="true"><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--top"><img src="${escReturnMetricAttr(a.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--bl"><img src="${escReturnMetricAttr(b.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--br">${br}</div></div>`;
      sig = `m${items.length}:${items.map((it) => it.icon).join(':')}`;
    } else {
      const src = items.length === 1 ? items[0].icon : fb;
      inner = `<img class="${singleClass}" src="${escReturnMetricAttr(src)}" alt="" />`;
      sig = `s:${src}`;
    }
    const html = `<div class="plan-detail-panel__product-icon-wrap plan-return-metric__product-icon-wrap" aria-hidden="true">${inner}</div>`;
    return { html, sig };
  };

  const buildReturnMetricProductIconWrapHtml = (assets, fallbackIcon) =>
    buildReturnMetricProductIconWrap(assets, fallbackIcon).html;

  /** Avoid replacing markup when layout is unchanged (prevents icon flicker on slider/input updates). */
  const setReturnMetricIconWrapHtml = (el, html, opts = {}) => {
    if (!el) return;
    const { layoutSig } = opts;
    if (layoutSig !== undefined) {
      if (el.dataset.returnMetricIconSig === layoutSig) return;
      if (layoutSig === '') delete el.dataset.returnMetricIconSig;
      else el.dataset.returnMetricIconSig = layoutSig;
      if (el.innerHTML !== html) el.innerHTML = html;
      return;
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  };

  const RETURN_METRIC_ARROW_HIST_POS = 'assets/icon_northeast_arrow.svg';
  const RETURN_METRIC_ARROW_HIST_NEG = 'assets/icon_dark_negativearrow.svg';

  const setReturnMetricTone = (root, value) => {
    if (!root) return;
    const pos = Number(value) >= 0;
    root.classList.toggle('plan-return-metric__group--loss', !pos);
    const histArrow = root.querySelector('.plan-return-metric__arrow--historic');
    if (histArrow) {
      histArrow.src = pos ? RETURN_METRIC_ARROW_HIST_POS : RETURN_METRIC_ARROW_HIST_NEG;
      histArrow.classList.remove('plan-return-metric__arrow--down');
      return;
    }
    const simArrow = root.querySelector('.plan-return-metric__arrow--simulated');
    if (simArrow) {
      simArrow.classList.toggle('plan-return-metric__arrow--down', !pos);
      return;
    }
    const arrow = root.querySelector('.plan-return-metric__arrow');
    if (arrow) arrow.classList.toggle('plan-return-metric__arrow--down', !pos);
  };

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.detailPanel] — write to plan-detail footer only (do not change main widget)
   * @param {number} [opts.amount] — override slider amount
   * @param {string} [opts.planKey] — override carousel plan (e.g. curated basket)
   * @param {string} [opts.freq] — 'daily' | 'weekly' | 'monthly' (override active freq chip)
   * @param {'1Y'|'3Y'|'5Y'} [opts.historicalRangeKey] — simulation window (defaults to rangeState.plan)
   * @param {{ ticker?: string, icon?: string }[]} [opts.displayAssets] — icons/labels for historic column (plan detail)
   * @param {boolean} [opts.domWrite=true] — when false, only compute and return { returnPct, historicReturnPct, profit, totalInvested }
   */
  const updatePlanStrategyHistoricalReturn = (opts = {}) => {
    const detailPanel = !!opts.detailPanel;
    const domWrite = opts.domWrite !== false;
    const pctEl = detailPanel
      ? document.querySelector('[data-plan-detail-return-pct]')
      : document.querySelector(
          '.plan-strategy__return-metrics-col--strategy.plan-strategy__return-metrics-col--values .plan-strategy__return-pct',
        );
    const absEl = detailPanel
      ? document.querySelector('[data-plan-detail-return-abs]')
      : document.querySelector('.plan-strategy__return-abs');
    const slider = document.querySelector('[data-plan-slider]');
    const freqActive = document.querySelector('[data-plan-freq-item].is-active');
    const carousel = document.querySelector('[data-plan-carousel]');
    if (domWrite) {
      if (!pctEl || !absEl) return;
      if (!detailPanel && (!slider || !freqActive)) return;
    } else if (opts.amount === undefined) {
      return null;
    }

    const amount = opts.amount !== undefined
      ? opts.amount
      : parseInt(slider.getAttribute('aria-valuenow') || '0', 10);
    const freq = (opts.freq || freqActive?.getAttribute('data-plan-freq-item') || 'monthly').toLowerCase();
    const activePlan = opts.planKey
      ? String(opts.planKey).toLowerCase()
      : (carousel?.getAttribute('data-active-plan') || 'bitcoin').toLowerCase();

    const activeAnchorPlan = activeAnchorPlanFromCarouselKey(activePlan);

    // Rough offline DCA estimate: 60 monthly USD levels (prototype historic shapes, Jan 2020 → late 2024).
    // Shorter ranges (3Y / 1Y) start later into the same dataset.
    const rangeMonthsMap = { '5Y': 60, '3Y': 36, '1Y': 12 };
    const simRangeKey =
      opts.historicalRangeKey ||
      (typeof rangeState !== 'undefined' ? rangeState.plan : '5Y') ||
      '5Y';
    const periodMonths = rangeMonthsMap[simRangeKey] || 60;
    const startMonth = HISTORIC_SIM_MONTHS - periodMonths;
    const months = HISTORIC_SIM_MONTHS;

    const formatPct = (n) =>
      `${(isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
    const formatTwdNumber = (n) => {
      const abs = Math.abs(n);
      const round1 = (x) => {
        const r = Math.round(x * 10) / 10;
        return Number.isInteger(r) ? r.toString() : r.toString();
      };
      if (abs < 10000) return abs.toLocaleString('en-US');
      if (abs < 1000000) return `${round1(abs / 1000)}K`;
      return `${round1(abs / 1000000)}M`;
    };

    const fxMultiplier = planHistoricFxMultiplier();

    const occurrencesPerMonth = (() => {
      if (freq === 'daily') return 365.0 / 12.0; // ≈ 30.42
      if (freq === 'weekly') return 52.0 / 12.0; // ≈ 4.33
      return 1.0; // monthly
    })();

    // Return % is independent of `amount` when the set of buy-weights × (1/P) scales together; it is not
    // independent of frequency once buys fall on different prices. Weekly/daily: `amount` per buy, many
    // timestamps across the window. Monthly: one buy per month at month-end closes (integer months).
    let assetAccum = 0;
    let totalInvested = 0;
    if (freq === 'monthly') {
      for (let m = startMonth; m < months; m += 1) {
        const priceLocal = historicIndexUsdAtMonth(activeAnchorPlan, m) * fxMultiplier;
        if (priceLocal <= 0) continue;
        assetAccum += amount / priceLocal;
        totalInvested += amount;
      }
    } else {
      const numBuys = Math.max(1, Math.round(periodMonths * occurrencesPerMonth));
      const span = months - 1 - startMonth;
      for (let k = 0; k < numBuys; k += 1) {
        const t = numBuys === 1 ? startMonth : startMonth + (k / (numBuys - 1)) * span;
        const priceLocal = historicIndexUsdAtFractionalMonth(activeAnchorPlan, t) * fxMultiplier;
        if (priceLocal <= 0) continue;
        assetAccum += amount / priceLocal;
        totalInvested += amount;
      }
    }

    const endPriceLocal = historicIndexUsdAtMonth(activeAnchorPlan, months - 1) * fxMultiplier;
    const startPriceLocal = historicIndexUsdAtMonth(activeAnchorPlan, startMonth) * fxMultiplier;
    const finalValue = assetAccum * endPriceLocal;
    const profit = finalValue - totalInvested;

    const returnPct = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
    const historicReturnPct = startPriceLocal > 0
      ? ((endPriceLocal - startPriceLocal) / startPriceLocal) * 100
      : 0;

    if (!domWrite) {
      return { returnPct, historicReturnPct, profit, totalInvested };
    }

    const displayAssets =
      Array.isArray(opts.displayAssets) && opts.displayAssets.length
        ? opts.displayAssets
        : (PLAN_DISPLAY_ASSETS_BY_KEY[activePlan]
          || PLAN_DISPLAY_ASSETS_BY_KEY[activeAnchorPlan]
          || PLAN_DISPLAY_ASSETS_BY_KEY.bitcoin);
    const historicCaption = buildHistoricPerformanceCaption(displayAssets);
    const { html: iconsHtml, sig: iconsSig } = buildReturnMetricProductIconWrap(
      displayAssets,
      'assets/icon_currency_btc.svg',
    );

    absEl.textContent = `${profit >= 0 ? '+' : '-'}${formatTwdNumber(profit)}`;
    pctEl.textContent = `${formatPct(returnPct)} return`;

    const strategyGroup = detailPanel
      ? document.querySelector(
          '.plan-detail-panel__return-metrics-col--strategy.plan-detail-panel__return-metrics-col--values',
        )
      : document.querySelector(
          '.plan-strategy__return-metrics-col--strategy.plan-strategy__return-metrics-col--values',
        );
    const historicGroup = detailPanel
      ? document.querySelector('[data-plan-detail-historic-performance-tone]')
      : document.querySelector(
          '.plan-strategy__return-metrics-col--historic.plan-strategy__return-metrics-col--values',
        );
    setReturnMetricTone(strategyGroup, profit);
    setReturnMetricTone(historicGroup, historicReturnPct);

    if (detailPanel) {
      const histPctEl = document.querySelector('[data-plan-detail-return-historic-pct]');
      const autoHistPctEl = document.querySelector('[data-plan-detail-alloc-auto-historic-pct]');
      const iconWrap = document.querySelector('[data-plan-detail-return-asset-icons]');
      const capHist = document.querySelector('[data-plan-detail-return-historic-caption]');
      const capStrat = document.querySelector('[data-plan-detail-return-strategy-caption]');
      const histText = formatPct(historicReturnPct);
      if (histPctEl) histPctEl.textContent = histText;
      if (autoHistPctEl) autoHistPctEl.textContent = histText;
      setReturnMetricIconWrapHtml(iconWrap, iconsHtml, { layoutSig: iconsSig });
      if (capHist) capHist.textContent = historicCaption;
      if (capStrat) capStrat.textContent = 'Return';
    } else {
      const histPctEl = document.querySelector('[data-plan-return-historic-pct]');
      const iconWrap = document.querySelector('[data-plan-return-asset-icons]');
      const capHist = document.querySelector('[data-plan-return-historic-caption]');
      const capStrat = document.querySelector('[data-plan-return-strategy-caption]');
      if (histPctEl) histPctEl.textContent = formatPct(historicReturnPct);
      setReturnMetricIconWrapHtml(iconWrap, iconsHtml, { layoutSig: iconsSig });
      if (capHist) capHist.textContent = historicCaption;
      if (capStrat) capStrat.textContent = 'Return';
    }
  };

  const initPlanStrategySlider = () => {
    const slider = document.querySelector('[data-plan-slider]');
    const fill = document.querySelector('[data-plan-slider-fill]');
    const thumb = document.querySelector('[data-plan-slider-thumb]');
    const amountEl = document.querySelector('[data-plan-amount]');
    if (!slider || !fill || !thumb || !amountEl) return;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const formatNumber = (n) => n.toLocaleString('en-US');

    // Read bounds live from DOM so currency switches take effect immediately
    const getMin = () => parseInt(slider.getAttribute('data-min') || '500', 10);
    const getMax = () => parseInt(slider.getAttribute('data-max') || '100000', 10);

    let value = clamp(parseInt(slider.getAttribute('aria-valuenow') || '10000', 10), getMin(), getMax());

    const pctFromValue = (v) => {
      const mn = getMin(); const mx = getMax();
      if (mx === mn) return 0;
      if (v <= mn) return 0;
      return (v - mn) / (mx - mn);
    };
    const stepForPct = (pct) => {
      const isUsdt = (typeof currencyState !== 'undefined' ? currencyState.plan : 'TWD') === 'USDT';
      if (isUsdt) {
        if (pct < 1 / 3) return 5;
        if (pct < 2 / 3) return 25;
        return 100;
      }
      if (pct < 1 / 3) return 500;
      if (pct < 2 / 3) return 1000;
      return 5000;
    };
    const roundToStep = (v, step) => Math.round(v / step) * step;

    const setValue = (next, pctHint) => {
      const mn = getMin(); const mx = getMax();
      const pctRaw = typeof pctHint === 'number' ? pctHint : pctFromValue(next);
      const step = stepForPct(pctRaw);
      value = clamp(roundToStep(next, step), mn, mx);
      const pct = pctFromValue(value);
      fill.style.width = `${pct * 100}%`;
      thumb.style.left = `calc(${pct * 100}% - ${pct * 24}px)`;
      amountEl.textContent = formatNumber(value);
      slider.setAttribute('aria-valuenow', String(value));
      updatePlanStrategyHistoricalReturn();
    };

    const setFromClientX = (clientX) => {
      const mn = getMin(); const mx = getMax();
      const rect = slider.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const pct = rect.width === 0 ? 0 : x / rect.width;
      const raw = mn + pct * (mx - mn);
      setValue(raw, pct);
    };

    const onPointerDown = (e) => {
      slider.setPointerCapture(e.pointerId);
      setFromClientX(e.clientX);
    };
    const onPointerMove = (e) => {
      if (!slider.hasPointerCapture(e.pointerId)) return;
      setFromClientX(e.clientX);
    };
    const onPointerUp = (e) => {
      if (slider.hasPointerCapture(e.pointerId)) slider.releasePointerCapture(e.pointerId);
    };

    slider.addEventListener('pointerdown', onPointerDown);
    slider.addEventListener('pointermove', onPointerMove);
    slider.addEventListener('pointerup', onPointerUp);
    slider.addEventListener('pointercancel', onPointerUp);

    // Keyboard support
    slider.tabIndex = 0;
    slider.addEventListener('keydown', (e) => {
      const mn = getMin(); const mx = getMax();
      const step = stepForPct(pctFromValue(value));
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setValue(value - step);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setValue(value + step);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setValue(mn);
      } else if (e.key === 'End') {
        e.preventDefault();
        setValue(mx);
      }
    });

    setValue(value);

    // Expose a re-render function for currency switches
    slider._planSliderSetValue = setValue;
  };

  const initPlanStrategyFreq = () => {
    const container = document.querySelector('[data-plan-freq]');
    const items = container?.querySelectorAll('[data-plan-freq-item]');
    if (!container || !items?.length) return;

    items.forEach((btn) => {
      btn.addEventListener('click', () => {
        items.forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');
        updatePlanStrategyHistoricalReturn();
      });
    });

    updatePlanStrategyHistoricalReturn();
  };

  const initPlanStrategyCarousel = () => {
    const carousel = document.querySelector('[data-plan-carousel]');
    const prevBtn = document.querySelector('[data-plan-carousel-prev]');
    const nextBtn = document.querySelector('[data-plan-carousel-next]');
    const titleEl = document.querySelector('[data-plan-hero-title]');
    const subEl = document.querySelector('[data-plan-hero-sub]');
    const slides = carousel?.querySelectorAll('[data-plan-carousel-item]');
    if (!carousel || !slides?.length || !titleEl || !subEl || typeof window.Swiper === 'undefined') return;

    const updateHeroFromIndex = (index) => {
      const slide = slides[index];
      if (!slide) return;
      titleEl.textContent = slide.getAttribute('data-title') || '';
      subEl.textContent = slide.getAttribute('data-subtitle') || '';
      carousel.setAttribute('data-active-plan', (slide.getAttribute('data-plan-key') || 'bitcoin').toLowerCase());
      updatePlanStrategyHistoricalReturn();
    };

    const initialIndex = Math.max(
      0,
      Array.from(slides).findIndex((s) => (s.getAttribute('data-title') || '').toLowerCase() === 'bitcoin')
    );

    const swiper = new window.Swiper(carousel, {
      slidesPerView: 'auto',
      centeredSlides: true,
      spaceBetween: 12,
      loop: false,
      rewind: true,
      watchOverflow: false,
      speed: 280,
      grabCursor: true,
      initialSlide: initialIndex,
      navigation: {
        prevEl: prevBtn || undefined,
        nextEl: nextBtn || undefined,
      },
      on: {
        init() {
          updateHeroFromIndex(this.realIndex);
        },
        slideChange() {
          updateHeroFromIndex(this.realIndex);
        },
      },
    });

    updateHeroFromIndex(swiper.realIndex || initialIndex);
  };

  const initLimitsPanel = () => {
    const panel = document.querySelector('[data-limits-panel]');
    const container = document.querySelector('.phone-container');
    if (!panel) return;
    const openButtons = document.querySelectorAll('[data-limits-open]');
    const closeButtons = panel.querySelectorAll('[data-limits-close]');

    const setOpen = (nextOpen) => {
      if (nextOpen) {
        panel.hidden = false;
        if (container) {
          container.classList.remove('is-limits-open');
          container.classList.remove('is-limits-fading');
        }
        const scrollBody = panel.querySelector('.limits-panel__body');
        if (scrollBody) scrollBody.scrollTop = 0;
        requestAnimationFrame(() => {
          panel.classList.add('is-open');
        });
        setTimeout(() => {
          if (container && panel.classList.contains('is-open')) {
            container.classList.add('is-limits-fading');
          }
        }, 80);
        setTimeout(() => {
          if (container && panel.classList.contains('is-open')) {
            container.classList.add('is-limits-open');
          }
        }, 350);
      } else {
        panel.classList.remove('is-open');
        if (container) {
          container.classList.add('is-limits-fading');
          container.classList.remove('is-limits-open');
          requestAnimationFrame(() => {
            container.classList.remove('is-limits-fading');
          });
        }
        const onEnd = () => {
          if (!panel.classList.contains('is-open')) {
            panel.hidden = true;
          }
          panel.removeEventListener('transitionend', onEnd);
        };
        panel.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 400);
      }
    };

    openButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (container && container.classList.contains('is-menu-open')) {
          container.classList.remove('is-menu-open');
          setTimeout(() => setOpen(true), 220);
        } else {
          setOpen(true);
        }
      });
    });
    closeButtons.forEach((button) => {
      button.addEventListener('click', () => setOpen(false));
    });
  };

  // ─── Currency + range state ───────────────────────────────────────────────────
  const currencyState = { summary: 'TWD', plan: 'TWD' };
  if (currencyState.summary === 'USDT') currencyState.summary = 'USD';
  const rangeState = { plan: '5Y', curated: '5Y', spotlight: '5Y', breakdown: '5Y', widgetBreakdown: '5Y' };

  // Feature flag: keep the "Set end condition" step implemented but bypass it for this prototype iteration.
  // Flip to true to restore flow: Plan -> Set end condition -> Funding.
  const ENABLE_PLAN_END_CONDITION_STEP = false;

  const FINANCE_SUMMARY_NEXT_BUY_FALLBACK = 'Wed, Apr 15';
  /** Set when user confirms plan overview; cleared on prototype Reset */
  let financeSummaryConfirmedNextBuy = '';
  /** Set when user confirms plan overview; cleared on prototype Reset */
  let financeSummaryConfirmedReserved = null;
  /** Snapshot of the latest submitted plan used by "My plans". */
  /** Snapshot of the latest submitted plan used by "My plans". */
  let myPlansSubmittedPlan = null;

  // Static FX for prototype: 1 USD ≈ 32 TWD
  const FX_USD_TWD = 32;

  const normalizeFxCurrency = (cur) => {
    const c = String(cur || '').trim().toUpperCase();
    if (c === 'USDT') return 'USD';
    return c || 'USD';
  };

  const parseMoneyWithCurrency = (text) => {
    const t = String(text || '').trim();
    if (!t || t === '—' || t === '- -') return null;
    const m = t.match(/(-?\d[\d,]*)(?:\.(\d+))?\s*([A-Za-z]{3,5})\s*$/);
    if (!m) return null;
    const intPart = (m[1] || '').replace(/,/g, '');
    const fracPart = m[2] ? `.${m[2]}` : '';
    const amount = parseFloat(`${intPart}${fracPart}`);
    if (!Number.isFinite(amount)) return null;
    const currency = normalizeFxCurrency(m[3]);
    return { amount, currency };
  };

  const convertFx = (amount, from, to) => {
    const f = normalizeFxCurrency(from);
    const t = normalizeFxCurrency(to);
    if (!Number.isFinite(amount)) return 0;
    if (f === t) return amount;
    if (f === 'USD' && t === 'TWD') return amount * FX_USD_TWD;
    if (f === 'TWD' && t === 'USD') return amount / FX_USD_TWD;
    return amount;
  };

  const formatMoney = (amount, cur) => {
    const n = Number.isFinite(amount) ? amount : 0;
    const c = normalizeFxCurrency(cur);
    return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
  };

  /** Compact "Mar 15 · ~12:00" / "Mon · ~12:00" from plan-detail schedule line */
  const formatFinanceNextBuyCompact = (schedText) => {
    const sched = String(schedText || '').trim();
    if (!sched) return '';
    const parts = sched.split('·').map((t) => t.trim()).filter(Boolean);
    const tail = parts.length > 1 ? parts.slice(1).join(' · ') : parts[0] || '';
    const timeMatch = tail.match(/at\s+~?\s*(\d{1,2}:\d{2})/i);
    const timeStr = timeMatch ? `~${timeMatch[1]}` : '~12:00';
    const dayMatch = tail.match(/(\d{1,2})(?:st|nd|rd|th)/i);
    if (!dayMatch && tail) {
      return tail.replace(/\s+at\s+/i, ' · ').replace(/\s+/g, ' ').trim();
    }
    const day = dayMatch ? parseInt(dayMatch[1], 10) : 15;
    const t = new Date();
    if (t.getDate() >= day) t.setMonth(t.getMonth() + 1);
    t.setDate(day);
    const mon = t.toLocaleString('en-US', { month: 'short' });
    return `${mon} ${day} · ${timeStr}`;
  };

  const applyFinanceSummaryMeta = () => {
    const shortenWeekday = (s) => {
      const t = String(s || '').trim();
      if (!t || t.toLowerCase() === 'today') return t;
      const m = t.match(/^([A-Za-z]+),\s*(.+)$/);
      if (!m) return t;
      const wk = m[1] || '';
      const rest = m[2] || '';
      return `${wk.slice(0, 3)}, ${rest}`;
    };

    const suf = currencyState.summary;
    const fallbackAmt = formatMoney(0, suf);
    const reservedAmt = financeSummaryConfirmedReserved
      ? formatMoney(convertFx(financeSummaryConfirmedReserved.amount, financeSummaryConfirmedReserved.currency, suf), suf)
      : fallbackAmt;
    document.querySelectorAll('[data-finance-summary-reserved]').forEach((el) => {
      const t = el.querySelector('.finance-summary__stat-value-text');
      if (t) t.textContent = reservedAmt;
      else el.textContent = reservedAmt;
    });
    document.querySelectorAll('[data-finance-summary-invested]').forEach((el) => {
      const t = el.querySelector('.finance-summary__stat-value-text');
      if (t) t.textContent = fallbackAmt;
      else el.textContent = fallbackAmt;
    });

    // Keep "My plans" summary strip in sync with Finance summary.
    document.querySelectorAll('[data-my-plans-summary-reserved-text]').forEach((el) => {
      el.textContent = reservedAmt;
    });
    document.querySelectorAll('[data-my-plans-summary-invested-text]').forEach((el) => {
      el.textContent = fallbackAmt;
    });

    const nbRaw = financeSummaryConfirmedNextBuy.trim() || FINANCE_SUMMARY_NEXT_BUY_FALLBACK;
    const nb = shortenWeekday(nbRaw);
    document.querySelectorAll('[data-finance-summary-next-buy]').forEach((el) => {
      el.textContent = nb;
    });
  };

  const initPrototypeReset = () => {
    const resetBtn = document.querySelector('[data-prototype-reset]');
    if (!resetBtn) return;
    resetBtn.addEventListener('click', () => {
      Object.keys(STATE_CONFIGS).forEach((group) => {
        setState(group, STATE_CONFIGS[group].min, { force: true });
      });
      const sp500Toggle = document.querySelector('[data-prototype-breakdown-sp500]');
      if (sp500Toggle) {
          sp500Toggle.checked = false;
        sp500Toggle.dispatchEvent(new Event('change'));
      }
      const firstBuyTodayToggle = document.querySelector('[data-prototype-show-first-buy-today]');
      if (firstBuyTodayToggle) {
        firstBuyTodayToggle.checked = false;
        firstBuyTodayToggle.dispatchEvent(new Event('change'));
      }
      const smartAllocSelect = document.querySelector('[data-prototype-smart-allocation]');
      if (smartAllocSelect) {
        smartAllocSelect.value = 'smart';
        smartAllocSelect.dispatchEvent(new Event('change'));
      }
      financeSummaryConfirmedNextBuy = '';
      financeSummaryConfirmedReserved = null;
      myPlansSubmittedPlan = null;
      applyFinanceSummaryMeta();
      syncPrototypeFinanceCurrencySelectorVisible();
    });
  };

  const initPrototypeStartOverlay = () => {
    const overlay = document.querySelector('[data-proto-start-overlay]');
    if (!overlay) return;
    const beginBtn = overlay.querySelector('[data-proto-start-begin]');
    const resetBtn = overlay.querySelector('[data-proto-start-reset]');
    const promoTrigger = document.querySelector('[data-prototype-promo-intro-sheet]');
    let didAutoOpenPromo = false;

    const close = () => {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');

      if (!didAutoOpenPromo) {
        didAutoOpenPromo = true;
        setTimeout(() => {
          promoTrigger?.click();
        }, 400);
      }
    };

    // Overlay is visible by default (HTML). Allow keyboard users to start immediately.
    requestAnimationFrame(() => beginBtn?.focus());
    beginBtn?.addEventListener('click', close);

    resetBtn?.addEventListener('click', () => {
      // Reuse the existing prototype reset behavior, then keep overlay open.
      Object.keys(STATE_CONFIGS).forEach((group) => {
        setState(group, STATE_CONFIGS[group].min, { force: true });
      });
      const sp500Toggle = document.querySelector('[data-prototype-breakdown-sp500]');
      if (sp500Toggle) {
        sp500Toggle.checked = false;
        sp500Toggle.dispatchEvent(new Event('change'));
      }
      const firstBuyTodayToggle = document.querySelector('[data-prototype-show-first-buy-today]');
      if (firstBuyTodayToggle) {
        firstBuyTodayToggle.checked = false;
        firstBuyTodayToggle.dispatchEvent(new Event('change'));
      }
      const smartAllocSelect = document.querySelector('[data-prototype-smart-allocation]');
      if (smartAllocSelect) {
        smartAllocSelect.value = 'smart';
        smartAllocSelect.dispatchEvent(new Event('change'));
      }
      financeSummaryConfirmedNextBuy = '';
      financeSummaryConfirmedReserved = null;
      myPlansSubmittedPlan = null;
      applyFinanceSummaryMeta();
    });
  };

  const curatedReturns = {
    bigthree:    { '5Y': '45.23%', '3Y': '28.15%', '1Y': '18.42%' },
    digitalgold: { '5Y': '35.23%', '3Y': '22.10%', '1Y': '12.35%' },
    aiessentials:{ '5Y': '52.23%', '3Y': '31.45%', '1Y': '22.18%' },
  };

  const spotlightReturns = {
    btc:    { '5Y': '121.23%', '3Y': '82.40%', '1Y': '52.10%' },
    eth:    { '5Y': '121.23%', '3Y': '51.30%', '1Y': '38.50%' },
    xaut:   { '5Y': '121.23%', '3Y': '44.20%', '1Y': '28.30%' },
    link:   { '5Y': '121.23%', '3Y': '71.40%', '1Y': '35.60%' },
    render: { '5Y': '121.23%', '3Y': '92.50%', '1Y': '65.20%' },
    near:   { '5Y': '121.23%', '3Y': '63.10%', '1Y': '41.80%' },
    ondo:   { '5Y': '121.23%', '3Y': '58.30%', '1Y': '32.40%' },
    pol:    { '5Y': '121.23%', '3Y': '39.70%', '1Y': '22.10%' },
    xrp:    { '5Y': '121.23%', '3Y': '55.80%', '1Y': '44.20%' },
    sol:    { '5Y': '121.23%', '3Y': '91.20%', '1Y': '62.30%' },
    aave:   { '5Y': '121.23%', '3Y': '67.40%', '1Y': '38.90%' },
    ada:    { '5Y': '121.23%', '3Y': '41.30%', '1Y': '19.50%' },
  };

  const updateCuratedReturnsUI = () => {
    const range = rangeState.curated;
    document.querySelectorAll('[data-curated-key]').forEach((card) => {
      const key = card.getAttribute('data-curated-key');
      const pctEl = card.querySelector('.curated-portfolios__return-pct');
      if (pctEl && curatedReturns[key]) pctEl.textContent = curatedReturns[key][range] || '';
    });
  };

  const updateSpotlightReturnsUI = () => {
    const range = rangeState.spotlight;
    document.querySelectorAll('[data-spotlight-key]').forEach((pill) => {
      const key = pill.getAttribute('data-spotlight-key');
      const pctEl = pill.querySelector('.crypto-pill__pct');
      if (pctEl && spotlightReturns[key]) pctEl.textContent = spotlightReturns[key][range] || '';
    });
  };

  const updateSummaryCurrencyUI = () => {
    const cur = currencyState.summary;
    document.querySelectorAll('[data-summary-currency-label]').forEach((el) => { el.textContent = cur; });
    document.querySelectorAll('[data-summary-selector-label]').forEach((el) => { el.textContent = cur; });
    applyFinanceSummaryMeta();
  };

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.fromPlanDetailPanel] — currency sheet opened from plan *detail* pill:
   *   clear that panel’s Auto-invest only (0 / empty); main Finance slider stays (clamped to new min/max).
   *   When false (Finance → Auto-invest page): main slider → currency defaults (300 USDT / 10,000 TWD).
   */
  const updatePlanCurrencyUI = (opts = {}) => {
    const fromPlanDetailPanel = !!opts.fromPlanDetailPanel;
    const cur = currencyState.plan;
    const isUsdt = cur === 'USDT';
    const defaultVal = isUsdt ? 300 : 10000;

    // Labels
    document.querySelectorAll('[data-plan-currency-label]').forEach((el) => { el.textContent = cur; });
    document.querySelectorAll('[data-plan-return-currency]').forEach((el) => { el.textContent = ` ${cur}`; });

    // Amount icon
    const amountIcon = document.querySelector('[data-plan-amount-icon]');
    if (amountIcon) {
      amountIcon.src = isUsdt ? 'assets/icon_currency_usdt.svg' : 'assets/icon_currency_TWD.svg';
    }

    const slider = document.querySelector('[data-plan-slider]');
    const detailInp = document.querySelector('[data-plan-detail-amount-input]');

    if (slider) {
      const min = isUsdt ? 15 : 500;
      const max = isUsdt ? 3000 : 100000;
      slider.setAttribute('data-min', String(min));
      slider.setAttribute('data-max', String(max));
      slider.setAttribute('aria-valuemin', String(min));
      slider.setAttribute('aria-valuemax', String(max));

      if (fromPlanDetailPanel) {
        // Deeper plan-detail page only: reset Auto-invest *field* to empty; keep main widget amount
        const curVal = parseInt(slider.getAttribute('aria-valuenow') || '0', 10);
        if (curVal > 0) {
          const clamped = Math.min(max, Math.max(min, curVal));
          if (typeof slider._planSliderSetValue === 'function') {
            slider._planSliderSetValue(clamped);
          } else {
            slider.setAttribute('aria-valuenow', String(clamped));
            updatePlanStrategyHistoricalReturn();
          }
        }
        if (detailInp) detailInp.value = '';
      } else {
        // Finance → Auto-invest: restore defaults on main slider + sync detail if present
        if (typeof slider._planSliderSetValue === 'function') {
          slider._planSliderSetValue(defaultVal);
        } else {
          slider.setAttribute('aria-valuenow', String(defaultVal));
          const amtEl = document.querySelector('[data-plan-amount]');
          if (amtEl) amtEl.textContent = defaultVal.toLocaleString('en-US');
          updatePlanStrategyHistoricalReturn();
        }
        if (detailInp) detailInp.value = defaultVal.toLocaleString('en-US');
      }
    } else {
      updatePlanStrategyHistoricalReturn();
    }

    document.dispatchEvent(
      new CustomEvent('plan-investment-currency-updated', { detail: { fromPlanDetailPanel } }),
    );
  };

  const initCurrencySheet = () => {
    const sheet = document.querySelector('[data-currency-sheet]');
    if (!sheet) return;

    const panel = sheet.querySelector('.currency-sheet__panel');
    const titleEl = sheet.querySelector('[data-currency-sheet-title]');
    const descEl = sheet.querySelector('[data-currency-sheet-desc]');
    const altRow = sheet.querySelector('[data-currency-sheet-alt-row]');
    const altIcon = altRow?.querySelector('[data-currency-sheet-alt-icon]');
    const altName = altRow?.querySelector('.currency-sheet__item-name');
    const altDesc = altRow?.querySelector('.currency-sheet__item-desc');

    const PLAN_SECOND_ROW = {
      value: 'USDT',
      icon: 'assets/icon_currency_usdt.svg',
      name: 'USDT',
      desc: 'USD Tether',
    };
    const SUMMARY_SECOND_ROW = {
      value: 'USD',
      icon: 'assets/icon_currency_USD.svg',
      name: 'USD',
      desc: 'US Dollar',
    };

    const applySecondCurrencyRow = (cfg) => {
      if (!altRow) return;
      altRow.setAttribute('data-currency-sheet-option', cfg.value);
      if (altIcon) altIcon.setAttribute('src', cfg.icon);
      if (altName) altName.textContent = cfg.name;
      if (altDesc) altDesc.textContent = cfg.desc;
    };

    let options = sheet.querySelectorAll('[data-currency-sheet-option]');

    let currentContext = null;
    /** Investment currency opened from plan detail pill → clear detail Auto-invest only. */
    let planCurrencyOpenedFromDetailPanel = false;

    const setSelected = (value) => {
      options.forEach((opt) => {
        opt.classList.toggle('is-selected', opt.getAttribute('data-currency-sheet-option') === value);
      });
    };

    const open = (context) => {
      currentContext = context;
      const isSummary = context === 'summary';
      if (titleEl) titleEl.textContent = isSummary ? 'Display currency' : 'Investment currency';
      if (descEl) descEl.hidden = !isSummary;
      if (isSummary) {
        applySecondCurrencyRow(SUMMARY_SECOND_ROW);
        if (currencyState.summary === 'USDT') currencyState.summary = 'USD';
      } else {
        applySecondCurrencyRow(PLAN_SECOND_ROW);
      }
      options = sheet.querySelectorAll('[data-currency-sheet-option]');
      setSelected(currencyState[context]);
      sheet.hidden = false;
      requestAnimationFrame(() => {
        sheet.classList.add('is-open');
      });
    };

    const close = () => {
      sheet.classList.remove('is-open');
      const onEnd = () => {
        if (!sheet.classList.contains('is-open')) sheet.hidden = true;
        panel.removeEventListener('transitionend', onEnd);
        sheet.removeEventListener('transitionend', onEnd);
      };
      panel.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 290);
    };

    // Open triggers
    document.querySelectorAll('[data-currency-sheet-trigger]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ctx = btn.getAttribute('data-currency-sheet-trigger');
        planCurrencyOpenedFromDetailPanel = ctx === 'plan' && !!btn.closest('.plan-detail-panel');
        open(ctx);
      });
    });

    // Close triggers
    sheet.querySelectorAll('[data-currency-sheet-close]').forEach((btn) => {
      btn.addEventListener('click', close);
    });

    // Option selection
    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        const value = opt.getAttribute('data-currency-sheet-option');
        if (!currentContext) return;
        currencyState[currentContext] = value;
        setSelected(value);
        if (currentContext === 'summary') updateSummaryCurrencyUI();
        if (currentContext === 'plan') {
          updatePlanCurrencyUI({ fromPlanDetailPanel: planCurrencyOpenedFromDetailPanel });
        }
        close();
      });
    });
  };

  const initPromoIntroSheet = (opts = {}) => {
    const sheet = document.querySelector('[data-promo-intro-sheet]');
    if (!sheet) return;
    const panel = sheet.querySelector('.currency-sheet__panel');
    const goFinanceAutoInvest =
      typeof opts.goFinanceAutoInvest === 'function' ? opts.goFinanceAutoInvest : () => {};

    const open = () => {
      sheet.hidden = false;
      requestAnimationFrame(() => {
        sheet.classList.add('is-open');
      });
    };

    const close = () => {
      sheet.classList.remove('is-open');
      const onEnd = () => {
        if (!sheet.classList.contains('is-open')) sheet.hidden = true;
        panel.removeEventListener('transitionend', onEnd);
      };
      panel.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 290);
    };

    document.querySelector('[data-prototype-promo-intro-sheet]')?.addEventListener('click', open);
    sheet.querySelectorAll('[data-promo-intro-sheet-close]').forEach((btn) => {
      btn.addEventListener('click', close);
    });
    sheet.querySelector('[data-promo-intro-sheet-not-now]')?.addEventListener('click', close);
    sheet.querySelector('[data-promo-intro-sheet-primary]')?.addEventListener('click', () => {
      close();
      goFinanceAutoInvest();
    });
  };

  const updateRangeUI = (context, range) => {
    document.querySelectorAll(`[data-range-label="${context}"]`).forEach((el) => {
      el.textContent = range;
    });
    const startedAgo = `If you'd started ${range} ago ≈`;
    const breakdownOutcome = `${range} simulated outcome ≈`;
    if (context === 'plan') {
      document.querySelectorAll('[data-plan-return-title]').forEach((el) => {
        el.textContent = startedAgo;
      });
      document.querySelectorAll('[data-plan-detail-historic-performance-label]').forEach((el) => {
        // Multi-asset alloc header uses the --below label for combined historic performance.
        // Single-asset uses --header and the alloc-row tone (so --below is hidden by CSS).
        if (el.classList.contains('plan-detail-panel__historic-performance-label--below')) {
          el.textContent = `Past ${range}`;
        } else {
          el.textContent = `Past ${range}`;
        }
      });
    }
    if (context === 'breakdown' || context === 'widgetBreakdown') {
      document.querySelectorAll('[data-plan-breakdown-profit-range-label]').forEach((el) => {
        el.textContent = breakdownOutcome;
      });
    }
  };

  const initRangeSheet = () => {
    const sheet = document.querySelector('[data-range-sheet]');
    if (!sheet) return;

    const panel = sheet.querySelector('.currency-sheet__panel');
    const options = sheet.querySelectorAll('[data-range-sheet-option]');
    let currentContext = 'plan';

    const setSelected = (value) => {
      options.forEach((opt) => {
        opt.classList.toggle('is-selected', opt.getAttribute('data-range-sheet-option') === value);
      });
    };

    const open = (context) => {
      currentContext = context;
      setSelected(rangeState[context]);
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add('is-open'));
    };

    const close = () => {
      sheet.classList.remove('is-open');
      const onEnd = () => {
        if (!sheet.classList.contains('is-open')) sheet.hidden = true;
        panel.removeEventListener('transitionend', onEnd);
      };
      panel.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 290);
    };

    document.querySelectorAll('[data-range-sheet-trigger]').forEach((btn) => {
      btn.addEventListener('click', () => open(btn.getAttribute('data-range-sheet-trigger')));
    });

    sheet.querySelectorAll('[data-range-sheet-close]').forEach((btn) => {
      btn.addEventListener('click', close);
    });

    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        const value = opt.getAttribute('data-range-sheet-option');
        rangeState[currentContext] = value;
        setSelected(value);
        updateRangeUI(currentContext, value);
        if (currentContext === 'plan') updatePlanStrategyHistoricalReturn();
        if (currentContext === 'curated') updateCuratedReturnsUI();
        if (currentContext === 'spotlight') updateSpotlightReturnsUI();
        document.dispatchEvent(
          new CustomEvent('range-sheet-confirmed', { detail: { context: currentContext, value } }),
        );
        close();
      });
    });
  };

  const initPlanBufferAutofillSheet = () => {
    const sheet = document.querySelector('[data-plan-buffer-autofill-sheet]');
    if (!sheet) return;
    const panel = sheet.querySelector('.currency-sheet__panel');
    const openTriggers = document.querySelectorAll('[data-plan-buffer-autofill-info]');

    const open = () => {
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add('is-open'));
    };

    const close = () => {
      sheet.classList.remove('is-open');
      const onEnd = () => {
        if (!sheet.classList.contains('is-open')) sheet.hidden = true;
        panel?.removeEventListener('transitionend', onEnd);
      };
      panel?.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 290);
    };

    openTriggers.forEach((btn) => btn.addEventListener('click', open));
    sheet.querySelectorAll('[data-plan-buffer-autofill-sheet-close]').forEach((btn) => btn.addEventListener('click', close));
  };

  const initSmartAllocInfoSheet = () => {
    const sheet = document.querySelector('[data-smart-alloc-info-sheet]');
    if (!sheet) return;
    const panel = sheet.querySelector('.currency-sheet__panel');

    const open = () => {
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add('is-open'));
    };

    const close = () => {
      sheet.classList.remove('is-open');
      const onEnd = () => {
        if (!sheet.classList.contains('is-open')) sheet.hidden = true;
        panel?.removeEventListener('transitionend', onEnd);
      };
      panel?.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 290);
    };

    document.querySelectorAll('[data-smart-alloc-info-trigger]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        open();
      });
    });
    sheet.querySelectorAll('[data-smart-alloc-info-sheet-close]').forEach((btn) => {
      btn.addEventListener('click', close);
    });
  };

  const initScheduleBuyNowInfoSheet = () => {
    const sheet = document.querySelector('[data-schedule-buy-now-info-sheet]');
    if (!sheet) return;
    const panel = sheet.querySelector('.currency-sheet__panel');

    const reveal = () => {
      sheetOpenWithInstantBackdrop(sheet);
    };

    const open = () => {
      reveal();
    };

    const closeBuyNowInfoSheet = () => {
      // Standalone sheet: same close as top-up — backdrop fades with the panel (no --backdrop-handoff nested swap).
      sheet.classList.remove('is-open');
      const onEnd = () => {
        if (!sheet.classList.contains('is-open')) sheet.hidden = true;
        panel.removeEventListener('transitionend', onEnd);
      };
      panel.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 290);
    };

    document.querySelectorAll('.schedule-sheet__buy-now-info').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        open();
      });
    });
    sheet.querySelectorAll('[data-schedule-buy-now-info-sheet-close]').forEach((btn) => btn.addEventListener('click', closeBuyNowInfoSheet));
  };

  const initFinanceSummaryInfoSheets = () => {
    const closeSheet = (sheet) => {
      const panel = sheet?.querySelector('.currency-sheet__panel');
      if (!sheet || !panel) return;
      sheet.classList.remove('is-open');
      const onEnd = () => {
        if (!sheet.classList.contains('is-open')) sheet.hidden = true;
        panel.removeEventListener('transitionend', onEnd);
      };
      panel.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 290);
    };

    document.querySelectorAll('[data-finance-summary-info-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const kind = btn.getAttribute('data-finance-summary-info-open');
        if (!kind) return;
        const sheet = document.querySelector(`[data-finance-summary-info-sheet="${kind}"]`);
        if (!sheet) return;
        sheetOpenWithInstantBackdrop(sheet);
      });
    });

    document.querySelectorAll('[data-finance-summary-info-sheet]').forEach((sheet) => {
      sheet.querySelectorAll('[data-finance-summary-info-sheet-close]').forEach((closeBtn) => {
        closeBtn.addEventListener('click', () => closeSheet(sheet));
      });
    });
  };

  /** Plan detail: top-up sheet (Deposit / Convert) — reuses currency-sheet chrome. */
  const initTopupSheet = () => {
    const sheet = document.querySelector('[data-topup-sheet]');
    if (!sheet) return;

    const panel = sheet.querySelector('.currency-sheet__panel');

    const syncTopupSheetCopy = () => {
      const cur = currencyState.plan;
      const sub = `Convert other currencies to ${cur}`;
      const titleEl = sheet.querySelector('[data-topup-sheet-title]');
      const convertDesc = sheet.querySelector('[data-topup-convert-desc]');
      if (titleEl) titleEl.textContent = `Get ${cur}`;
      if (convertDesc) convertDesc.textContent = sub;
      sheet.setAttribute('aria-label', `Get ${cur}`);
    };

    const open = () => {
      syncTopupSheetCopy();
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add('is-open'));
    };

    const close = () => {
      sheet.classList.remove('is-open');
      const onEnd = () => {
        if (!sheet.classList.contains('is-open')) sheet.hidden = true;
        panel.removeEventListener('transitionend', onEnd);
      };
      panel.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 290);
    };

    document.querySelectorAll('[data-plan-detail-topup-trigger]').forEach((btn) => {
      btn.addEventListener('click', open);
    });

    sheet.querySelectorAll('[data-topup-sheet-close]').forEach((b) => {
      b.addEventListener('click', close);
    });

    sheet.querySelectorAll('[data-topup-action]').forEach((b) => {
      b.addEventListener('click', () => {
        // Prototype: no navigation yet
      });
    });
  };

  /** Prototype: when true, nested schedule sheets open on top without animating the parent closed. */
  const getBottomSheetStacking = () => {
    const input = document.querySelector('[data-prototype-bottomsheet-stacking]');
    if (!input) return true;
    return Boolean(input.checked);
  };

  /** Prototype control: show/hide S&P 500 series + legend inside Breakdown panel. */
  const getPrototypeBreakdownSp500Visible = () => {
    const input = document.querySelector('[data-prototype-breakdown-sp500]');
    if (!input) return true;
    return Boolean(input.checked);
  };

  /** Prototype control: show/hide Finance display currency selector pill. */
  const syncPrototypeFinanceCurrencySelectorVisible = () => {
    const input = document.querySelector('[data-prototype-finance-display-currency-selector]');
    const container = document.querySelector('.phone-container');
    if (!container) return;
    const on = Boolean(input?.checked);
    container.classList.toggle('is-proto-finance-currency-selector-on', on);
  };

  /** Prototype control: show/hide "First buy today" row in schedule sheet. */
  const syncPrototypeScheduleBuyNowRowVisible = () => {
    const input = document.querySelector('[data-prototype-show-first-buy-today]');
    const on = Boolean(input?.checked);
    document.querySelectorAll('.schedule-sheet__buy-now-row').forEach((row) => {
      row.style.display = on ? '' : 'none';
    });
  };

  /** Prototype control: plan detail allocation mode (manual vs smart). */
  const getPrototypeSmartAllocationEnabled = () => {
    const sel = document.querySelector('[data-prototype-smart-allocation]');
    return String(sel?.value || 'smart') === 'smart';
  };

  /**
   * Closing a nested sheet (time / set-limit / buys): skip shared nested scrim when stacking is on,
   * or when the main schedule sheet never left the screen (e.g. user toggled stacking off mid-flow).
   * Otherwise activateScheduleNestedScrim would zero the parent backdrop while the scrim sits under
   * the sheet (z-index), so the dim disappears.
   */
  const getSuppressNestedScrimForScheduleChildClose = () => {
    if (getBottomSheetStacking()) return true;
    const scheduleSheet = document.querySelector('[data-schedule-sheet]');
    return Boolean(
      scheduleSheet
      && !scheduleSheet.hidden
      && scheduleSheet.classList.contains('is-open'),
    );
  };

  /** Coordinates nested time-picker: close schedule sheet first, reopen after time sheet closes. */
  const scheduleSheetApi = {
    /** @type {null | ((onClosed?: () => void) => void)} */
    closeAnimatedForChild: null,
    /** @type {null | (() => void)} */
    reopenFromChild: null,
    /** @type {null | ((end: string) => void)} */
    onEndOptionSelect: null,
    /** @type {null | (() => void)} */
    refreshEndConditionSubtitles: null,
    /** Realigns set-limit count to ~1 year of buys for the active repeat frequency */
    applyScheduleSetLimitYearDefault: null,
    /** Plan detail repeats line when end = enddate (from inline stepper summary) */
    planDetailRepeatsEndLimitText: '',
  };

  const SHEET_BACKDROP_HANDOFF = 'currency-sheet--backdrop-handoff';
  const SHEET_BACKDROP_INSTANT_IN = 'currency-sheet--backdrop-instant-in';
  /** Stacked child closing: drop scrim immediately so parent sheet shows (stacking mode only). */
  const SHEET_STACK_POP_DISMISS = 'currency-sheet--stack-pop-dismiss';

  const isScheduleStackSheet = (el) =>
    !!el?.matches?.(
      '[data-schedule-sheet], [data-schedule-time-sheet], [data-schedule-buys-sheet]',
    );

  const getScheduleNestedScrimEls = () => {
    const phoneContainer = document.querySelector('.phone-container');
    const nestedScrim = document.querySelector('[data-nested-sheet-scrim]');
    return { phoneContainer, nestedScrim };
  };

  let scheduleNestedScrimSession = false;

  /** One shared dimmer for schedule + nested sheets so two sheet backdrops never stack visually. */
  const activateScheduleNestedScrim = () => {
    const { phoneContainer, nestedScrim } = getScheduleNestedScrimEls();
    if (!phoneContainer || !nestedScrim) return;
    scheduleNestedScrimSession = true;
    nestedScrim.classList.remove('is-fading-out');
    nestedScrim.hidden = false;
    nestedScrim.setAttribute('aria-hidden', 'false');
    phoneContainer.classList.add('phone-container--nested-sheet-scrim');
  };

  const resetScheduleNestedScrimHard = () => {
    const { phoneContainer, nestedScrim } = getScheduleNestedScrimEls();
    if (!phoneContainer || !nestedScrim) return;
    scheduleNestedScrimSession = false;
    nestedScrim.hidden = true;
    nestedScrim.classList.remove('is-fading-out');
    nestedScrim.setAttribute('aria-hidden', 'true');
    phoneContainer.classList.remove('phone-container--nested-sheet-scrim');
  };

  const fadeOutScheduleNestedScrim = () => {
    const { phoneContainer, nestedScrim } = getScheduleNestedScrimEls();
    if (!nestedScrim || !scheduleNestedScrimSession) return;
    if (nestedScrim.classList.contains('is-fading-out')) return;
    nestedScrim.classList.add('is-fading-out');
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      nestedScrim.removeEventListener('transitionend', done);
      nestedScrim.hidden = true;
      nestedScrim.classList.remove('is-fading-out');
      nestedScrim.setAttribute('aria-hidden', 'true');
      phoneContainer?.classList.remove('phone-container--nested-sheet-scrim');
      scheduleNestedScrimSession = false;
    };
    nestedScrim.addEventListener('transitionend', done);
    setTimeout(done, 240);
  };

  /**
   * Close sheet with panel slide; backdrop stays dim until hidden (nested handoff).
   * @param {{ suppressNestedScrim?: boolean }} [opts] If true, skip shared nested scrim (stacked child closing while parent stays open).
   */
  const sheetCloseWithBackdropHandoff = (rootEl, panelEl, onDone, opts = {}) => {
    const { suppressNestedScrim } = opts;
    if (isScheduleStackSheet(rootEl) && !suppressNestedScrim) {
      activateScheduleNestedScrim();
    }
    if (!rootEl.classList.contains('is-open')) {
      rootEl.hidden = true;
      rootEl.classList.remove(SHEET_BACKDROP_HANDOFF);
      rootEl.classList.remove(SHEET_STACK_POP_DISMISS);
      onDone?.();
      return;
    }
    if (suppressNestedScrim) {
      rootEl.classList.add(SHEET_STACK_POP_DISMISS);
    } else {
      rootEl.classList.add(SHEET_BACKDROP_HANDOFF);
    }
    rootEl.classList.remove('is-open');
    let done = false;
    const onEnd = () => {
      if (done) return;
      done = true;
      panelEl.removeEventListener('transitionend', onEnd);
      if (!rootEl.classList.contains('is-open')) {
        rootEl.hidden = true;
        rootEl.classList.remove(SHEET_BACKDROP_HANDOFF);
        rootEl.classList.remove(SHEET_STACK_POP_DISMISS);
      }
      onDone?.();
    };
    panelEl.addEventListener('transitionend', onEnd);
    setTimeout(onEnd, 290);
  };

  /** Open sheet: scrim snaps to dim, then panel opens; restores normal backdrop transitions after. */
  const sheetOpenWithInstantBackdrop = (rootEl) => {
    rootEl.classList.add(SHEET_BACKDROP_INSTANT_IN);
    rootEl.hidden = false;
    requestAnimationFrame(() => {
      rootEl.classList.add('is-open');
      requestAnimationFrame(() => {
        rootEl.classList.remove(SHEET_BACKDROP_INSTANT_IN);
      });
    });
  };

  /** Plan detail: auto-invest schedule sheet (currency-sheet chrome). */
  const initScheduleSheet = () => {
    const sheet = document.querySelector('[data-schedule-sheet]');
    if (!sheet) return;

    const panel = sheet.querySelector('.currency-sheet__panel');
    const planDetail = document.querySelector('[data-plan-detail-panel]');
    const freqButtons = sheet.querySelectorAll('[data-schedule-freq]');
    const timingLabelEl = sheet.querySelector('[data-schedule-timing-label]');
    const timingValueEl = sheet.querySelector('[data-schedule-timing-value]');
    const buyNowToggleEl = planDetail?.querySelector('[data-schedule-buy-now-toggle]');
    const buyNowStateEl = planDetail?.querySelector('[data-schedule-buy-now-state]');
    const endButtons = sheet.querySelectorAll('[data-schedule-end]');

    const timingSectionLabels = {
      daily: 'Every day',
      weekly: 'Every week on',
      monthly: 'Every month on',
    };
    const defaultTimingDetail = {
      daily: '- -',
      weekly: 'Monday',
      monthly: '15th',
    };
    const freqSchedulePrefix = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
    let buyNowEnabled = false;

    const setFreqUI = (freq) => {
      freqButtons.forEach((btn) => {
        const v = btn.getAttribute('data-schedule-freq');
        const on = v === freq;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    };

    const setEndUI = (end) => {
      endButtons.forEach((btn) => {
        const v = btn.getAttribute('data-schedule-end');
        btn.classList.toggle('is-selected', v === end);
      });
    };

    const endLimitRowBtn = sheet.querySelector('[data-schedule-end="enddate"]');
    const endLimitTitleEl = endLimitRowBtn?.querySelector('[data-schedule-endlimit-title]');

    const hasSchedulePerBuyAmount = () => {
      const raw = document.querySelector('[data-plan-detail-amount-input]')?.value ?? '';
      const n = parseInt(String(raw).replace(/,/g, '').trim(), 10);
      return Number.isFinite(n) && n > 0;
    };

    const syncEndLimitRowAvailability = () => {
      if (!endLimitRowBtn || !endLimitTitleEl) return;
      const descEl = sheet.querySelector('[data-schedule-endlimit-desc]');
      const ok = hasSchedulePerBuyAmount();
      if (!ok) {
        endLimitRowBtn.classList.add('schedule-end-limit-row--disabled');
        endLimitRowBtn.setAttribute('aria-disabled', 'true');
        endLimitRowBtn.tabIndex = -1;
        endLimitTitleEl.textContent = 'Set a limit (disabled)';
        if (descEl) {
          descEl.textContent = 'Enter an amount to buy first';
          descEl.classList.add('schedule-end-limit-desc--needs-amount');
        }
        return;
      }
      endLimitRowBtn.classList.remove('schedule-end-limit-row--disabled');
      endLimitRowBtn.removeAttribute('aria-disabled');
      endLimitRowBtn.tabIndex = 0;
      endLimitTitleEl.textContent = 'Set a limit';
      if (descEl) {
        descEl.classList.remove('schedule-end-limit-desc--needs-amount');
        const end = sheet.querySelector('[data-schedule-end].is-selected')?.getAttribute('data-schedule-end');
        if (end !== 'enddate') descEl.textContent = '';
      }
    };

    scheduleSheetApi.setEndConditionUI = setEndUI;
    scheduleSheetApi.hasSchedulePerBuyAmount = hasSchedulePerBuyAmount;
    scheduleSheetApi.syncEndLimitRowAvailability = syncEndLimitRowAvailability;

    const parseFreqFromScheduleText = (text) => {
      const head = (text || '').split('·')[0]?.trim().toLowerCase() || '';
      if (head.startsWith('daily')) return 'daily';
      if (head.startsWith('weekly')) return 'weekly';
      return 'monthly';
    };

    const parseTimingFromScheduleText = (text, freq) => {
      const stripTimeSuffix = (v) => String(v || '').replace(/\s*at\s+~?\s*\d{1,2}:\d{2}/gi, '').trim();
      const parts = (text || '').split('·').map((s) => s.trim());
      if (parts.length >= 2) {
        const detail = parts.slice(1).join(' · ');
        if (freq === 'daily') {
          return defaultTimingDetail.daily;
        }
        return stripTimeSuffix(detail) || defaultTimingDetail[freq];
      }
      return defaultTimingDetail[freq];
    };

    const timingRowBtn = sheet.querySelector('.schedule-sheet__timing-row');
    const syncTimingRowInteractivity = (freq) => {
      if (!timingRowBtn) return;
      const disabled = freq === 'daily';
      timingRowBtn.disabled = disabled;
      timingRowBtn.classList.toggle('schedule-sheet__timing-row--disabled', disabled);
      timingRowBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      if (disabled && timingValueEl) timingValueEl.textContent = defaultTimingDetail.daily;
    };

    const setBuyNowUI = (enabled) => {
      buyNowEnabled = !!enabled;
      if (planDetail) planDetail.dataset.scheduleBuyNow = buyNowEnabled ? '1' : '0';
      if (buyNowToggleEl) {
        buyNowToggleEl.classList.toggle('is-on', buyNowEnabled);
        buyNowToggleEl.setAttribute('aria-checked', buyNowEnabled ? 'true' : 'false');
      }
      if (buyNowStateEl) {
        buyNowStateEl.textContent = buyNowEnabled ? 'On' : 'Off';
        buyNowStateEl.classList.toggle('is-on', buyNowEnabled);
      }
    };

    const open = () => {
      const scheduleEl = planDetail?.querySelector('[data-plan-detail-schedule]');
      const endEl = planDetail?.querySelector('[data-plan-detail-repeats-end]');
      const scheduleText = scheduleEl?.textContent?.trim() || '';

      const mainFreqBtn = document.querySelector('[data-plan-freq-item].is-active');
      const mainFreq = (mainFreqBtn?.getAttribute('data-plan-freq-item') || 'monthly').toLowerCase();
      const freq = scheduleText ? parseFreqFromScheduleText(scheduleText) : mainFreq;

      setFreqUI(freq);
      if (timingLabelEl) timingLabelEl.textContent = timingSectionLabels[freq] || timingSectionLabels.monthly;
      if (timingValueEl) {
        timingValueEl.textContent = (scheduleText
          ? parseTimingFromScheduleText(scheduleText, freq)
          : defaultTimingDetail[freq]);
      }
      syncTimingRowInteractivity(freq);
      setBuyNowUI(planDetail?.dataset?.scheduleBuyNow === '1');

      let end = 'continuous';
      const endText = String(endEl?.dataset?.endConditionText || endEl?.textContent || '').trim();
      // Match "… · ~ Ends Jun 18, 2026" plus legacy variants.
      const isSetLimitPlanDetail =
        endText === 'End on date'
        || (/\b(buy|buys)\b/i.test(endText)
          && (endText.includes('~ Ends')
            || endText.includes('Ends ~')
            || /\bEnds\s+[\w\s,.]+\s*~\s*$/i.test(endText)));
      if (isSetLimitPlanDetail) end = 'enddate';
      else if (endText.startsWith('After')) end = 'buys';
      setEndUI(end);
      scheduleSheetApi.refreshEndConditionSubtitles?.();

      const endSel = sheet.querySelector('[data-schedule-end].is-selected')?.getAttribute('data-schedule-end');
      if (endSel === 'enddate') {
        const descEl = sheet.querySelector('[data-schedule-endlimit-desc]');
        const line = scheduleSheetApi.planDetailRepeatsEndLimitText?.trim();
        if (descEl && line && !descEl.textContent.trim()) {
          descEl.textContent = line;
        }
      }

      resetScheduleNestedScrimHard();
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add('is-open'));
    };

    const close = () => {
      if (scheduleNestedScrimSession) {
        fadeOutScheduleNestedScrim();
      }
      sheet.classList.remove('is-open');
      let done = false;
      const onEnd = () => {
        if (done) return;
        done = true;
        panel.removeEventListener('transitionend', onEnd);
        if (!sheet.classList.contains('is-open')) sheet.hidden = true;
      };
      panel.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 290);
    };

    /** Used by nested sheets: slide schedule out without fading the scrim, then `onClosed`. */
    const closeAnimatedForChild = (onClosed) => {
      if (getBottomSheetStacking()) {
        onClosed?.();
        return;
      }
      sheetCloseWithBackdropHandoff(sheet, panel, onClosed);
    };

    /** After nested sheet closes — reopen schedule; scrim appears without fade-in. */
    const reopenFromChild = () => {
      if (getBottomSheetStacking()) {
        if (!sheet.hidden && sheet.classList.contains('is-open')) return;
      }
      sheetOpenWithInstantBackdrop(sheet);
    };

    scheduleSheetApi.closeAnimatedForChild = closeAnimatedForChild;
    scheduleSheetApi.reopenFromChild = reopenFromChild;

    const applyAndClose = () => {
      const freqBtn = sheet.querySelector('[data-schedule-freq].is-active');
      const freq = (freqBtn?.getAttribute('data-schedule-freq') || 'monthly').toLowerCase();
      const endBtn = sheet.querySelector('[data-schedule-end].is-selected');
      const end = endBtn?.getAttribute('data-schedule-end') || 'continuous';
      const timing = (timingValueEl?.textContent || '').trim() || defaultTimingDetail[freq];
      const prefix = freqSchedulePrefix[freq] || freqSchedulePrefix.monthly;

      document.querySelectorAll('[data-plan-freq-item]').forEach((item) => {
        const v = item.getAttribute('data-plan-freq-item');
        const on = v === freq;
        item.classList.toggle('is-active', on);
        item.setAttribute('aria-selected', on ? 'true' : 'false');
      });

      const scheduleEl = planDetail?.querySelector('[data-plan-detail-schedule]');
      const endEl = planDetail?.querySelector('[data-plan-detail-repeats-end]');
      if (scheduleEl) scheduleEl.textContent = freq === 'daily' ? 'Daily' : `${prefix} · ${timing}`;
      if (planDetail) planDetail.dataset.scheduleBuyNow = buyNowEnabled ? '1' : '0';
      if (endEl) {
        const setEndConditionText = (nextText) => {
          const next = String(nextText || '').trim();
          endEl.dataset.endConditionText = next;
          endEl.textContent = next;
        };
        if (end === 'continuous') {
          setEndConditionText('Continuous');
          scheduleSheetApi.planDetailRepeatsEndLimitText = '';
        } else if (end === 'enddate') {
          const limitDesc = document.querySelector('[data-schedule-setlimit-end-date]')?.textContent?.trim();
          setEndConditionText(
            scheduleSheetApi.planDetailRepeatsEndLimitText
            || limitDesc
            || 'End on date',
          );
        } else {
          setEndConditionText('After number of buys');
        }
      }

      document.dispatchEvent(new CustomEvent('plan-schedule-confirmed', { detail: { freq, end } }));
      close();
    };

    document.querySelectorAll('.plan-detail-panel__repeats-row').forEach((row) => {
      row.addEventListener('click', () => {
        open();
      });
    });

    sheet.querySelectorAll('[data-schedule-sheet-close]').forEach((btn) => {
      btn.addEventListener('click', close);
    });

    const confirmBtn = sheet.querySelector('[data-schedule-sheet-confirm]');
    if (confirmBtn) confirmBtn.addEventListener('click', applyAndClose);

    buyNowToggleEl?.addEventListener('click', () => {
      setBuyNowUI(!buyNowEnabled);
    });

    freqButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const freq = (btn.getAttribute('data-schedule-freq') || 'monthly').toLowerCase();
        setFreqUI(freq);
        if (timingLabelEl) timingLabelEl.textContent = timingSectionLabels[freq] || timingSectionLabels.monthly;
        if (timingValueEl) timingValueEl.textContent = defaultTimingDetail[freq];
        syncTimingRowInteractivity(freq);
        scheduleSheetApi.refreshEndConditionSubtitles?.();
      });
    });

    endButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const end = btn.getAttribute('data-schedule-end') || 'continuous';
        if (end === 'enddate' && btn.classList.contains('schedule-end-limit-row--disabled')) return;
        setEndUI(end);
        scheduleSheetApi.refreshEndConditionSubtitles?.();
        if (end === 'enddate') scheduleSheetApi.onEndOptionSelect?.(end);
      });
    });

    document.querySelector('[data-plan-detail-amount-input]')?.addEventListener('input', () => {
      scheduleSheetApi.refreshEndConditionSubtitles?.();
    });

    scheduleSheetApi.syncBuyNowFromPlanDetail = () => {
      setBuyNowUI(planDetail?.dataset?.scheduleBuyNow === '1');
    };
  };

  /**
   * “Set a limit” inline stepper — Figma DCA1.0_modal_schedule (8520:8386).
   * @returns {{
   *   syncDom: () => void,
   *   getSummary: () => { count: number, endsApprox: string },
   *   getCount: () => number,
   *   setCount: (nextCount: number) => void,
   *   applyYearDefaultForActiveFreq: () => void
   * } | null}
   */
  const initScheduleSetLimitStepper = (scheduleSheet, limitHostRoot) => {
    const root = limitHostRoot || scheduleSheet;
    const host = root.querySelector('[data-schedule-setlimit-inline]');
    const valueEl = host?.querySelector('[data-schedule-setlimit-value]');
    const suffixEl = host?.querySelector('[data-schedule-setlimit-suffix]');
    // End date label lives outside the stepper pill in some layouts (e.g. summary row).
    const dateEl = root.querySelector('[data-schedule-setlimit-end-date]');
    const decBtn = host?.querySelector('[data-schedule-setlimit-dec]');
    const incBtn = host?.querySelector('[data-schedule-setlimit-inc]');
    const dec10Btn = host?.querySelector('[data-schedule-setlimit-dec-10]');
    const inc10Btn = host?.querySelector('[data-schedule-setlimit-inc-10]');
    if (!host || !valueEl || !suffixEl || !dateEl || !decBtn || !incBtn || !dec10Btn || !inc10Btn) return null;

    const MIN = 1;
    const MAX = 999;

    const getActiveFreq = () => {
      const btn = scheduleSheet.querySelector('[data-schedule-freq].is-active');
      return (btn?.getAttribute('data-schedule-freq') || 'monthly').toLowerCase();
    };

    /** Always 12 for fresh state; freq changes do not override user-adjusted count. */
    const DEFAULT_LIMIT_BUYS = 12;

    let count = Math.max(MIN, Math.min(MAX, DEFAULT_LIMIT_BUYS));
    let countUserCustomized = false;

    /** 1–28 from strings like "15th at ~12:00"; null if not monthly-style. */
    const parseMonthlyBuyDayFromTiming = (text) => {
      const m = String(text || '').match(/(\d{1,2})(?:st|nd|rd|th)/i);
      if (!m) return null;
      return Math.max(1, Math.min(28, parseInt(m[1], 10)));
    };

    const projectEndDate = (buys) => {
      const freq = getActiveFreq();
      const d = new Date();
      const n = Math.max(MIN, Math.min(MAX, buys));
      if (freq === 'daily') d.setDate(d.getDate() + n);
      else if (freq === 'weekly') d.setDate(d.getDate() + n * 7);
      else {
        d.setMonth(d.getMonth() + n);
        const tv = (scheduleSheet.querySelector('[data-schedule-timing-value]')?.textContent || '').trim();
        const buyDay = parseMonthlyBuyDayFromTiming(tv);
        if (buyDay != null) {
          const lastInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          d.setDate(Math.min(buyDay, lastInMonth));
        }
      }
      return d;
    };

    const formatProjection = (d) => d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const getSummary = () => ({
      count,
      endsApprox: formatProjection(projectEndDate(count)),
    });

    const getCount = () => count;

    const setCount = (nextCount) => {
      const n = Number(nextCount);
      count = Number.isFinite(n) ? Math.max(MIN, Math.min(MAX, Math.round(n))) : count;
      syncDom();
      scheduleSheetApi.refreshEndConditionSubtitles?.();
    };

    const syncDom = () => {
      valueEl.textContent = String(count);
      suffixEl.textContent = count === 1 ? 'buy' : 'buys';
      dateEl.textContent = `~ Ends ${formatProjection(projectEndDate(count))}`;
      decBtn.disabled = count <= MIN;
      dec10Btn.disabled = count <= MIN;
      incBtn.disabled = count >= MAX;
      inc10Btn.disabled = count >= MAX;
    };

    const bump = (delta) => {
      countUserCustomized = true;
      count = Math.max(MIN, Math.min(MAX, count + delta));
      syncDom();
      scheduleSheetApi.refreshEndConditionSubtitles?.();
    };

    dec10Btn.addEventListener('click', () => bump(-10));
    decBtn.addEventListener('click', () => bump(-1));
    incBtn.addEventListener('click', () => bump(1));
    inc10Btn.addEventListener('click', () => bump(10));

    const applyYearDefaultForActiveFreq = () => {
      if (countUserCustomized) return;
      count = Math.max(MIN, Math.min(MAX, DEFAULT_LIMIT_BUYS));
      syncDom();
      scheduleSheetApi.refreshEndConditionSubtitles?.();
    };

    syncDom();
    return { syncDom, getSummary, getCount, setCount, applyYearDefaultForActiveFreq };
  };

  /** Schedule sheet: nested follow-up for “Set a limit” stepper (same backdrop handoff as time picker). */
  const initScheduleEndFollowupSheets = () => {
    const scheduleSheet = document.querySelector('[data-schedule-sheet]');
    const buysSheet = document.querySelector('[data-schedule-buys-sheet]');
    if (!scheduleSheet || !buysSheet) return;

    const buysPanel = buysSheet.querySelector('.currency-sheet__panel');
    const handoff = scheduleSheetApi.closeAnimatedForChild;
    const reopen = scheduleSheetApi.reopenFromChild;

    const setLimitStepper = initScheduleSetLimitStepper(scheduleSheet, buysSheet);
    const modeBtns = buysSheet.querySelectorAll('[data-setlimit-mode]');
    const labelEl = buysSheet.querySelector('[data-setlimit-label]');
    const captionEl = buysSheet.querySelector('[data-setlimit-caption]');
    const perBuyEl = buysSheet.querySelector('[data-setlimit-perbuy]');
    const totalBuysEl = buysSheet.querySelector('[data-setlimit-totalbuys]');
    const totalAmountEl = buysSheet.querySelector('[data-setlimit-totalamount]');
    const periodsValueCell = buysSheet.querySelector('[data-setlimit-value-mode="periods"]');
    const amountValueCell = buysSheet.querySelector('[data-setlimit-value-mode="amount"]');
    const amountCurEl = buysSheet.querySelector('[data-setlimit-value-cur]');
    const amountAmtEl = buysSheet.querySelector('[data-setlimit-value-amt]');
    const pillEl = buysSheet.querySelector('.schedule-setlimit-inline__pill');
    const endsEl = buysSheet.querySelector('[data-schedule-setlimit-end-date]');
    const buysConfirmBtn = buysSheet.querySelector('[data-schedule-buys-sheet-confirm]');
    const summaryRowBuyCount = buysSheet.querySelector('.setlimit-sheet__summary-row--buycount');
    const summaryRowTotalAmount = buysSheet.querySelector('.setlimit-sheet__summary-row--totalamount');
    const periodEl = buysSheet.querySelector('[data-setlimit-period]');

    const SETLIMIT_VALUE_PLACEHOLDER = '- -';

    const getPerBuyAmount = () => {
      const raw = document.querySelector('[data-plan-detail-amount-input]')?.value ?? '';
      const s = String(raw).replace(/,/g, '').trim();
      if (s === '') return null;
      const n = parseInt(s, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const getPerBuyCurrency = () => (
      document.querySelector('[data-plan-detail-currency]')?.textContent?.trim()
      || document.querySelector('[data-plan-detail-coverage-currency]')?.textContent?.trim()
      || 'USDT'
    );

    const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : SETLIMIT_VALUE_PLACEHOLDER);

    let mode = 'amount'; // 'periods' | 'amount'
    /** Remember Total amount tab for next open (only applied when auto-invest amount is set). */
    let setLimitFollowupPreferredMode = 'amount';

    const getFreqUnitPlural = (count) => {
      const freqKey = (
        document.querySelector('[data-plan-freq-item].is-active')?.getAttribute('data-plan-freq-item') || 'monthly'
      ).toLowerCase();
      const unit = freqKey === 'daily' ? 'day' : freqKey === 'weekly' ? 'week' : 'month';
      return `${unit}${count === 1 ? '' : 's'}`;
    };

    const setModeUI = (nextMode) => {
      mode = nextMode === 'amount' ? 'amount' : 'periods';
      modeBtns.forEach((btn) => {
        const v = btn.getAttribute('data-setlimit-mode');
        const on = v === mode;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });

      if (periodsValueCell) periodsValueCell.hidden = mode !== 'periods';
      if (amountValueCell) amountValueCell.hidden = mode !== 'amount';

      if (labelEl) labelEl.textContent = mode === 'amount' ? 'Set total amount' : 'Set total buys';
      // if (captionEl) captionEl.hidden = mode !== 'amount';

      // Summary rows: amount-mode shows Buy count; buys-mode shows Total amount.
      if (summaryRowBuyCount) summaryRowBuyCount.hidden = mode !== 'amount';
      if (summaryRowTotalAmount) summaryRowTotalAmount.hidden = mode !== 'periods';
    };

    const syncSummary = () => {
      if (!setLimitStepper) return;
      const perBuy = getPerBuyAmount();
      const cur = getPerBuyCurrency();
      const hasPerBuy = perBuy != null && perBuy > 0;
      const { count } = setLimitStepper.getSummary();
      const total = hasPerBuy ? perBuy * count : null;

      if (perBuyEl) {
        perBuyEl.textContent = hasPerBuy ? `${fmt(perBuy)} ${cur}` : SETLIMIT_VALUE_PLACEHOLDER;
      }
      if (totalBuysEl) totalBuysEl.textContent = `${count} buys`;
      if (totalAmountEl) {
        totalAmountEl.textContent = hasPerBuy ? `${fmt(total)} ${cur}` : SETLIMIT_VALUE_PLACEHOLDER;
      }

      if (periodEl) {
        periodEl.textContent = `${count} ${getFreqUnitPlural(count)}`;
      }

      if (captionEl) {
        captionEl.textContent = hasPerBuy ? `${fmt(perBuy)} ${cur} per buy` : `${SETLIMIT_VALUE_PLACEHOLDER} per buy`;
      }
      if (amountCurEl) amountCurEl.textContent = hasPerBuy ? cur : '';
      if (amountAmtEl) {
        amountAmtEl.textContent = hasPerBuy ? fmt(total) : SETLIMIT_VALUE_PLACEHOLDER;
      }

      const blockAmountStepper = mode === 'amount' && !hasPerBuy;
      if (pillEl) pillEl.classList.toggle('schedule-setlimit-inline__pill--blocked', blockAmountStepper);
      if (buysConfirmBtn) buysConfirmBtn.disabled = blockAmountStepper;

      if (endsEl) {
        if (blockAmountStepper) {
          endsEl.textContent = 'Set “Amount per buy” first';
          endsEl.classList.add('schedule-setlimit-inline__ends--error');
        } else {
          endsEl.classList.remove('schedule-setlimit-inline__ends--error');
          const { endsApprox } = setLimitStepper.getSummary();
          endsEl.textContent = `~ Ends ${endsApprox}`;
        }
      }
    };

    const refreshEndConditionSubtitles = () => {
      if (!scheduleSheetApi.hasSchedulePerBuyAmount?.()) {
        const sel = scheduleSheet.querySelector('[data-schedule-end].is-selected');
        if (sel?.getAttribute('data-schedule-end') === 'enddate') {
          scheduleSheetApi.setEndConditionUI?.('continuous');
          scheduleSheetApi.planDetailRepeatsEndLimitText = '';
          scheduleSheet.classList.remove('schedule-sheet--end-limit-selected');
        }
      }
      const selected = scheduleSheet.querySelector('[data-schedule-end].is-selected');
      const end = selected?.getAttribute('data-schedule-end') || 'continuous';
      const descEl = scheduleSheet.querySelector('[data-schedule-endlimit-desc]');
      scheduleSheet.classList.toggle('schedule-sheet--end-limit-selected', end === 'enddate');
      if (end === 'enddate' && setLimitStepper) {
        setLimitStepper.syncDom();
        const { count, endsApprox } = setLimitStepper.getSummary();
        const buyWord = count === 1 ? 'buy' : 'buys';
        const line = `${count} ${buyWord} ~ Ends ${endsApprox}`;
        scheduleSheetApi.planDetailRepeatsEndLimitText = line;
        if (descEl?.textContent.trim()) {
          descEl.textContent = line;
        }
        syncSummary();
      } else {
        scheduleSheetApi.planDetailRepeatsEndLimitText = '';
        if (descEl) descEl.textContent = '';
      }
      scheduleSheetApi.syncEndLimitRowAvailability?.();
    };

    scheduleSheetApi.refreshEndConditionSubtitles = refreshEndConditionSubtitles;

    scheduleSheetApi.applyScheduleSetLimitYearDefault = () => {
      setLimitStepper?.applyYearDefaultForActiveFreq();
    };

    const revealSheet = (el) => {
      sheetOpenWithInstantBackdrop(el);
    };

    const closeFollowupThenReopenSchedule = (el, elPanel, opts = {}) => {
      const suppressNestedScrim = getSuppressNestedScrimForScheduleChildClose();
      sheetCloseWithBackdropHandoff(
        el,
        elPanel,
        () => {
          reopen?.();
          if (opts.restoreDraft && setLimitStepper) {
            // Delay rollback until after close/reopen transition so values don't "jump"
            // while the follow-up sheet is still visible.
            setTimeout(() => {
              setLimitStepper.setCount(setLimitCommittedCount);
            }, 120);
          }
          requestAnimationFrame(() => scheduleSheetApi.refreshEndConditionSubtitles?.());
        },
        { suppressNestedScrim },
      );
    };

    let setLimitCommittedCount = setLimitStepper?.getCount?.() ?? 12;

    const openSetLimitFollowup = () => {
      setLimitCommittedCount = setLimitStepper?.getCount?.() ?? setLimitCommittedCount;
      const perBuyOk = getPerBuyAmount() != null;
      const nextMode = perBuyOk ? setLimitFollowupPreferredMode : 'amount';
      setModeUI(nextMode);
      setLimitStepper?.syncDom();
      syncSummary();
      const run = () => revealSheet(buysSheet);
      if (typeof handoff === 'function') handoff(run);
      else run();
    };

    scheduleSheetApi.onEndOptionSelect = (end) => {
      if (end === 'enddate') openSetLimitFollowup();
    };

    const wireClose = (root, closeAttr) => {
      root.querySelectorAll(`[${closeAttr}]`).forEach((btn) => {
        btn.addEventListener('click', () => {
          closeFollowupThenReopenSchedule(buysSheet, buysPanel, { restoreDraft: true });
        });
      });
    };

    wireClose(buysSheet, 'data-schedule-buys-sheet-close');
    buysSheet.querySelector('[data-schedule-buys-sheet-cancel]')
      ?.addEventListener('click', () => closeFollowupThenReopenSchedule(buysSheet, buysPanel, { restoreDraft: true }));
    buysSheet.querySelector('[data-schedule-buys-sheet-confirm]')
      ?.addEventListener('click', () => {
        const descEl = scheduleSheet.querySelector('[data-schedule-endlimit-desc]');
        if (setLimitStepper && descEl) {
          setLimitStepper.syncDom();
          const { count, endsApprox } = setLimitStepper.getSummary();
          const buyWord = count === 1 ? 'buy' : 'buys';
          descEl.textContent = `${count} ${buyWord} ~ Ends ${endsApprox}`;
          setLimitCommittedCount = count;
        }
        if (getPerBuyAmount() != null) {
          setLimitFollowupPreferredMode = mode === 'amount' ? 'amount' : 'periods';
        }
        closeFollowupThenReopenSchedule(buysSheet, buysPanel);
      });

    modeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-setlimit-mode') || 'periods';
        setModeUI(v);
        if (getPerBuyAmount() != null) {
          setLimitFollowupPreferredMode = v === 'amount' ? 'amount' : 'periods';
        }
        syncSummary();
      });
    });

    document.querySelector('[data-plan-detail-amount-input]')?.addEventListener('input', () => {
      if (buysSheet.classList.contains('is-open')) syncSummary();
    });

    setModeUI('amount');
    scheduleSheetApi.refreshEndConditionSubtitles?.();
  };

  /** Schedule sheet: day picker only (monthly day / weekly weekday); daily timing is disabled placeholder. */
  const initScheduleTimePicker = () => {
    const timeSheet = document.querySelector('[data-schedule-time-sheet]');
    const scheduleSheet = document.querySelector('[data-schedule-sheet]');
    if (!timeSheet || !scheduleSheet) return;

    const panel = timeSheet.querySelector('.currency-sheet__panel');
    const titleEl = timeSheet.querySelector('[data-schedule-time-sheet-title]');
    const pickerRoot = timeSheet.querySelector('[data-schedule-time-picker]');
    const primaryCol = timeSheet.querySelector('[data-schedule-time-col="primary"]');
    const timeCol = timeSheet.querySelector('[data-schedule-time-col="time"]');
    const timingRow = scheduleSheet.querySelector('.schedule-sheet__timing-row');
    const timingValueEl = scheduleSheet.querySelector('[data-schedule-timing-value]');

    const ITEM_H = 44;
    const SPACER_H = 86;

    const timingTitles = {
      daily: 'Every day at',
      weekly: 'Every week on',
      monthly: 'Every month on',
    };

    const WEEKDAYS = [
      { short: 'Mon', label: 'Monday' },
      { short: 'Tue', label: 'Tuesday' },
      { short: 'Wed', label: 'Wednesday' },
      { short: 'Thu', label: 'Thursday' },
      { short: 'Fri', label: 'Friday' },
      { short: 'Sat', label: 'Saturday' },
      { short: 'Sun', label: 'Sunday' },
    ];

    /** @param {number} n 1–31 */
    const ordinalSuffix = (n) => {
      const j = n % 10;
      const k = n % 100;
      if (k >= 11 && k <= 13) return `${n}th`;
      if (j === 1) return `${n}st`;
      if (j === 2) return `${n}nd`;
      if (j === 3) return `${n}rd`;
      return `${n}th`;
    };

    const parseMonthlyDayIndex = (text) => {
      const m = String(text || '').match(/(\d{1,2})(?:st|nd|rd|th)/i);
      if (!m) return 14;
      const d = Math.max(1, Math.min(28, parseInt(m[1], 10)));
      return d - 1;
    };

    const parseWeeklyDayIndex = (text) => {
      const beforeAt = String(text || '').split(/\s+at\s+/i)[0]?.trim().toLowerCase() || '';
      const idx = WEEKDAYS.findIndex(
        (w) => beforeAt.startsWith(w.short.toLowerCase())
          || beforeAt.startsWith(w.label.toLowerCase()),
      );
      return idx >= 0 ? idx : 0;
    };

    const buildColumnHtml = (labels, activeIndex) => {
      const opts = labels.map(
        (label, i) => `<div class="schedule-time-sheet__option${i === activeIndex ? ' is-active' : ''}" data-index="${i}">${label}</div>`,
      );
      return `<div class="schedule-time-sheet__spacer" style="height:${SPACER_H}px" aria-hidden="true"></div>${
        opts.join('')}<div class="schedule-time-sheet__spacer" style="height:${SPACER_H}px" aria-hidden="true"></div>`;
    };

    const scrollToIndex = (colEl, index, maxIndex) => {
      const i = Math.max(0, Math.min(maxIndex, Math.floor(index)));
      colEl.scrollTop = i * ITEM_H;
    };

    const scrollToIndexSmooth = (colEl, index, maxIndex) => {
      const i = Math.max(0, Math.min(maxIndex, Math.floor(index)));
      colEl.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
    };

    const updateColumnHighlight = (colEl, count) => {
      const idx = Math.max(0, Math.min(count - 1, Math.round(colEl.scrollTop / ITEM_H)));
      colEl.querySelectorAll('.schedule-time-sheet__option').forEach((opt, i) => {
        opt.classList.toggle('is-active', i === idx);
      });
    };

    let highlightAbort;

    const bindColumnScroll = (colEl, count) => {
      const onScroll = () => {
        updateColumnHighlight(colEl, count);
      };
      colEl.addEventListener('scroll', onScroll, { passive: true, signal: highlightAbort.signal });
      onScroll();
    };

    /** Tap an option to snap the column to that index. */
    const bindColumnOptionClicks = (colEl, optionCount) => {
      const maxIdx = optionCount - 1;
      colEl.addEventListener(
        'click',
        (e) => {
          const opt = e.target.closest('.schedule-time-sheet__option');
          if (!opt || !colEl.contains(opt)) return;
          const idx = parseInt(opt.getAttribute('data-index'), 10);
          if (!Number.isFinite(idx)) return;
          scrollToIndexSmooth(colEl, idx, maxIdx);
        },
        { signal: highlightAbort.signal },
      );
    };

    const getActiveScheduleFreq = () => {
      const btn = scheduleSheet.querySelector('[data-schedule-freq].is-active');
      return (btn?.getAttribute('data-schedule-freq') || 'monthly').toLowerCase();
    };

    const revealTimePicker = () => {
      highlightAbort?.abort();
      highlightAbort = new AbortController();

      const freq = getActiveScheduleFreq();
      if (titleEl) titleEl.textContent = timingTitles[freq] || timingTitles.monthly;
      pickerRoot.classList.toggle('schedule-time-picker--daily', freq === 'daily');

      const tv = (timingValueEl?.textContent || '').trim();

      if (freq === 'daily') {
        return;
      } else if (freq === 'weekly') {
        primaryCol.hidden = false;
        timeCol.hidden = true;
        timeCol.innerHTML = '';
        const dayLabels = WEEKDAYS.map((w) => w.label);
        const dayIdx = parseWeeklyDayIndex(tv);
        primaryCol.innerHTML = buildColumnHtml(dayLabels, dayIdx);
        scrollToIndex(primaryCol, dayIdx, 6);
        bindColumnScroll(primaryCol, 7);
        bindColumnOptionClicks(primaryCol, 7);
      } else {
        primaryCol.hidden = false;
        timeCol.hidden = true;
        timeCol.innerHTML = '';
        const dayLabels = Array.from({ length: 28 }, (_, i) => ordinalSuffix(i + 1));
        const dayIdx = parseMonthlyDayIndex(tv);
        primaryCol.innerHTML = buildColumnHtml(dayLabels, dayIdx);
        scrollToIndex(primaryCol, dayIdx, 27);
        bindColumnScroll(primaryCol, 28);
        bindColumnOptionClicks(primaryCol, 28);
      }

      sheetOpenWithInstantBackdrop(timeSheet);
    };

    const openTimePicker = () => {
      const handoff = scheduleSheetApi.closeAnimatedForChild;
      if (typeof handoff === 'function') {
        handoff(() => revealTimePicker());
      } else {
        revealTimePicker();
      }
    };

    /** Animate time sheet out, then slide schedule sheet back in. */
    const closeTimePickerAndReopenSchedule = () => {
      const reopen = scheduleSheetApi.reopenFromChild;
      const suppressNestedScrim = getSuppressNestedScrimForScheduleChildClose();
      sheetCloseWithBackdropHandoff(timeSheet, panel, () => reopen?.(), { suppressNestedScrim });
    };

    const confirmTimePicker = () => {
      const freq = getActiveScheduleFreq();
      let next = '';
      if (freq === 'daily') {
        next = '- -';
      } else if (freq === 'weekly') {
        const pi = Math.max(0, Math.min(6, Math.round(primaryCol.scrollTop / ITEM_H)));
        next = WEEKDAYS[pi].label;
      } else {
        const pi = Math.max(0, Math.min(27, Math.round(primaryCol.scrollTop / ITEM_H)));
        next = `${ordinalSuffix(pi + 1)}`;
      }
      if (timingValueEl) timingValueEl.textContent = next;
      scheduleSheetApi.refreshEndConditionSubtitles?.();
      closeTimePickerAndReopenSchedule();
    };

    timingRow?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTimePicker();
    });

    timeSheet.querySelectorAll('[data-schedule-time-sheet-close]').forEach((btn) => {
      btn.addEventListener('click', closeTimePickerAndReopenSchedule);
    });
    timeSheet.querySelector('[data-schedule-time-sheet-cancel]')?.addEventListener('click', closeTimePickerAndReopenSchedule);
    timeSheet.querySelector('[data-schedule-time-sheet-confirm]')?.addEventListener('click', confirmTimePicker);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  initStates();
  initPrototypeStartOverlay();
  initBadgeControls();
  const tabNavApi = initTabs();
  const financeHeaderApi = initFinanceHeaderTabs();
  const goFinanceAutoInvest = () => {
    tabNavApi.setActiveTab('finance');
    financeHeaderApi.setFinancePage('auto');
    const content = document.querySelector('[data-content]');
    if (content) content.scrollTop = 0;
  };

  /** Set in initPlanDetailPanel — instant teardown of plan detail + overlays when backing out of My plans (post-success). */
  let dismissPlanDetailStackInstant = () => {};

  const initMyPlansPanel = (opts = {}) => {
    const goFinance = typeof opts.goFinanceAutoInvest === 'function' ? opts.goFinanceAutoInvest : () => {};
    const getDismissPlanDetail =
      typeof opts.getDismissPlanDetailStackInstant === 'function' ? opts.getDismissPlanDetailStackInstant : () => () => {};
    const panel = document.querySelector('[data-my-plans-panel]');
    const container = document.querySelector('.phone-container');
    if (!panel) {
      return { open: () => {}, close: () => {} };
    }

    const titleEl = panel.querySelector('[data-my-plans-title]');

    const tabs = panel.querySelectorAll('[data-my-plans-filter]');
    const views = panel.querySelectorAll('[data-my-plans-view]');
    let activeFilter = 'active';

    const buildFallbackPlanSnapshot = () => {
      if ((states.flow ?? 1) < 2) return null;
      const name = document.querySelector('[data-plan-detail-name]')?.textContent?.trim() || 'Your plan';
      const amountRaw = parseInt(
        String(document.querySelector('[data-plan-detail-amount-input]')?.value || '').replace(/[^0-9]/g, ''),
        10,
      ) || 0;
      const cur = String(document.querySelector('[data-plan-detail-currency]')?.textContent || currencyState.plan || 'TWD').trim();
      const freqKey = (
        document.querySelector('[data-plan-freq-item].is-active')?.getAttribute('data-plan-freq-item') || 'monthly'
      ).toLowerCase();
      const cadence = freqKey === 'daily' ? 'day' : freqKey === 'weekly' ? 'week' : 'month';
      const investLine = amountRaw > 0
        ? `${amountRaw.toLocaleString('en-US')} ${cur} each ${cadence}`
        : `— ${cur} each ${cadence}`;
      const repeats = document.querySelector('[data-plan-overview-repeats]')?.textContent?.trim()
        || document.querySelector('[data-plan-detail-schedule]')?.textContent?.trim()
        || '—';
      const firstBuy = document.querySelector('[data-plan-overview-first-buy]')?.textContent?.trim()
        || financeSummaryConfirmedNextBuy
        || '—';
      const fundingMethod = document.querySelector('[data-plan-overview-payment-method]')?.textContent?.trim() || 'Pay as you go';
      const isReserved = /\bset aside funds\b/i.test(fundingMethod);
      const reservedFunds = document.querySelector('[data-plan-overview-prefund-amount]')?.textContent?.trim() || '—';
      const runoutPolicy = document.querySelector('[data-plan-overview-runout-value]')?.textContent?.trim() || '—';
      return {
        id: 'plan-active-1',
        status: 'active',
        name,
        investLine,
        repeats,
        firstBuy,
        fundingMethod,
        isReserved,
        reservedFunds,
        runoutPolicy,
      };
    };

    const getMyPlansRecords = () => {
      if (myPlansSubmittedPlan) return [myPlansSubmittedPlan];
      const fallback = buildFallbackPlanSnapshot();
      return fallback ? [fallback] : [];
    };

    const parsePerBuyFromInvestLine = (investLine) => {
      const m = String(investLine || '').match(/(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})\s+each\b/i);
      if (!m) return null;
      const amount = parseFloat(String(m[1] || '').replace(/,/g, ''));
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return { amount, currency: normalizeFxCurrency(m[2]) };
    };

    const computeCoversBuysText = (planRecord) => {
      if (String(planRecord?.coversBuys || '').trim()) return String(planRecord.coversBuys).trim();
      if (!planRecord?.isReserved) return '';
      const reserved = parseMoneyWithCurrency(planRecord.reservedFunds || '');
      const perBuy = parsePerBuyFromInvestLine(planRecord.investLine || '');
      if (!reserved || !perBuy) return '';
      const reservedInPerBuyCur = convertFx(reserved.amount, reserved.currency, perBuy.currency);
      const buys = Math.max(0, Math.floor(reservedInPerBuyCur / perBuy.amount));
      return `Covers ${buys} more ${buys === 1 ? 'buy' : 'buys'}`;
    };

    const escIconAttr = (v) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');

    /**
     * Reuse Plan detail's icon stack DOM/CSS (2-coin + placeholder, or 3-coin).
     * Supports single-asset mode (one circular 32px icon).
     * @param {HTMLElement | null} wrap
     * @param {string} tickersText e.g. "BTC · ETH · SOL" or "BTC"
     * @param {string} fallbackIconSrc
     */
    const renderMyPlansHeaderIcons = (wrap, tickersText, fallbackIconSrc) => {
      if (!wrap) return;

      const toIcon = (ticker) => {
        const t = String(ticker || '').trim().toUpperCase();
        if (!t) return null;
        if (t === 'BTC') return 'assets/icon_currency_btc.svg';
        if (t === 'ETH') return 'assets/icon_currency_eth.svg';
        if (t === 'SOL' || t === 'SOLANA') return 'assets/icon_solana.svg';
        if (t === 'USDT') return 'assets/icon_currency_usdt.svg';
        if (t === 'TWD') return 'assets/icon_currency_TWD.svg';
        return null;
      };

      const tickers = String(tickersText || '')
        .split(/[·,]/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
      const items = tickers.map((t) => ({ ticker: t, icon: toIcon(t) })).filter((x) => x.icon);

      const buildStackMarkup = () => {
        const icons = items.slice(0, 3);
        if (icons.length < 2) return null;
        const twoOnly = icons.length === 2;
        const mod = twoOnly ? ' plan-detail-panel__icon-stack--two' : '';
        const baseClass = `plan-detail-panel__icon-stack${mod}`;
        const [a, b, c] = [icons[0], icons[1], icons[2]];
        const br = c?.icon
          ? `<img src="${escIconAttr(c.icon)}" alt="" />`
          : '<span class="plan-detail-panel__icon-stack-placeholder" aria-hidden="true"></span>';
        return `<div class="${baseClass}" aria-hidden="true"><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--top"><img src="${escIconAttr(a.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--bl"><img src="${escIconAttr(b.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--br">${br}</div></div>`;
      };

      const stack = buildStackMarkup();
      if (stack) {
        wrap.innerHTML = stack;
        return;
      }

      const singleSrc =
        items.length === 1 && items[0]?.icon
          ? items[0].icon
          : fallbackIconSrc;
      wrap.innerHTML = `<img class="plan-detail-panel__header-icon" src="${escIconAttr(singleSrc)}" alt="" />`;
    };

    const syncMyPlansLabels = () => {
      const records = getMyPlansRecords();
      const counts = records.reduce(
        (acc, item) => {
          const k = item.status === 'paused' ? 'paused' : item.status === 'ended' ? 'ended' : 'active';
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        },
        { active: 0, paused: 0, ended: 0 },
      );

      // Title stays "My plans" per Figma; only tabs show counts.
      if (titleEl) titleEl.textContent = 'My plans';

      // Finance summary button label shows total count.
      document.querySelectorAll('[data-my-plans-count-label]').forEach((el) => {
        el.textContent = `My plans (${records.length})`;
      });

      tabs.forEach((tab) => {
        const k = (tab.getAttribute('data-my-plans-filter') || 'active').toLowerCase();
        const base = k === 'paused' ? 'Paused' : k === 'ended' ? 'Ended' : 'Active';
        const n = counts[k] || 0;
        tab.textContent = k === 'ended' ? 'Ended' : `${base} (${n})`;
      });
    };

    const appendPlanCard = (target, planRecord) => {
      const el = (tag, className, text) => {
        const n = document.createElement(tag);
        if (className) n.className = className;
        if (typeof text === 'string') n.textContent = text;
        return n;
      };

      const statusKey = planRecord.status === 'paused' ? 'paused' : planRecord.status === 'ended' ? 'ended' : 'active';
      const statusLabel = statusKey === 'paused' ? 'Paused' : statusKey === 'ended' ? 'Ended' : 'Active';

      const card = el('article', `my-plans-position-card my-plans-position-card--${statusKey}`);
      card.setAttribute('data-plan-status', statusKey);

      // Header gradient block
      const head = el('div', 'my-plans-position-card__head');
      const headRow = el('div', 'my-plans-position-card__head-row');
      const left = el('div', 'my-plans-position-card__head-left');

      // Icon stack: reuse plan-detail-panel__icon-stack CSS/logic (supports single asset).
      const icons = el('div', 'my-plans-position-card__icons');
      renderMyPlansHeaderIcons(
        icons,
        planRecord.tickers || 'BTC · ETH · SOL',
        planRecord.iconSrc || 'assets/icon_currency_btc.svg',
      );
      left.appendChild(icons);

      const titleWrap = el('div', 'my-plans-position-card__title-wrap');
      // Figma: small label + tickers line
      titleWrap.appendChild(el('div', 'my-plans-position-card__kicker', planRecord.kicker || 'Big Three'));
      titleWrap.appendChild(el('div', 'my-plans-position-card__tickers', planRecord.tickers || 'BTC · ETH · SOL'));
      left.appendChild(titleWrap);

      headRow.appendChild(left);

      const tag = el('div', 'my-plans-position-card__tag');
      const dot = el('span', 'my-plans-position-card__tag-dot');
      tag.appendChild(dot);
      tag.appendChild(el('span', 'my-plans-position-card__tag-text', statusLabel));
      headRow.appendChild(tag);
      head.appendChild(headRow);

      const auto = el('div', 'my-plans-position-card__auto');
      auto.appendChild(el('div', 'my-plans-position-card__auto-label', 'Auto-investing'));
      auto.appendChild(el('div', 'my-plans-position-card__auto-value', planRecord.investLine || '—'));
      head.appendChild(auto);
      card.appendChild(head);

      // Body
      const body = el('div', 'my-plans-position-card__body');

      const twoCol = el('div', 'my-plans-position-card__two-col');
      const next = el('div', 'my-plans-position-card__kv');
      next.appendChild(el('div', 'my-plans-position-card__kv-label', 'Next buy'));
      next.appendChild(el('div', 'my-plans-position-card__kv-value', planRecord.nextBuy || planRecord.firstBuy || '—'));
      twoCol.appendChild(next);

      const completed = el('div', 'my-plans-position-card__kv my-plans-position-card__kv--right');
      completed.appendChild(el('div', 'my-plans-position-card__kv-label', 'Completed'));
      const compLine = el('div', 'my-plans-position-card__completed-line');
      const check = document.createElement('img');
      check.src = 'assets/icon_check_green.svg';
      check.alt = '';
      check.setAttribute('aria-hidden', 'true');
      check.className = 'my-plans-position-card__completed-icon';
      compLine.appendChild(check);
      compLine.appendChild(el('div', 'my-plans-position-card__kv-value', `${planRecord.completedBuys ?? 2} buys`));
      completed.appendChild(compLine);
      twoCol.appendChild(completed);
      body.appendChild(twoCol);

      body.appendChild(el('div', 'my-plans-position-card__divider'));

      const list = el('div', 'my-plans-position-card__list');
      const row = (label, value, opts = {}) => {
        const r = el('div', `my-plans-position-card__row${opts.tight ? ' my-plans-position-card__row--tight' : ''}`);
        r.appendChild(el('div', 'my-plans-position-card__row-label', label));
        r.appendChild(el('div', 'my-plans-position-card__row-value', value));
        return r;
      };

      // Total invested (prototype: derive from invest amount * completed buys when possible)
      const parsed = String(planRecord.investLine || '').match(/(\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})/);
      const per = parsed ? parseFloat(parsed[1].replace(/,/g, '')) : NaN;
      const cur = parsed ? normalizeFxCurrency(parsed[2]) : currencyState.plan || currencyState.summary;
      const completedN = Number.isFinite(planRecord.completedBuys) ? planRecord.completedBuys : 2;
      const totalInv = Number.isFinite(per) ? formatMoney(per * completedN, cur) : (planRecord.totalInvested || `500.00 ${cur}`);
      list.appendChild(row('Total invested', totalInv));

      // Pay-as-you-go only: "Uses your balance each buy" row.
      if (!planRecord.isReserved) {
        const balanceRow = el('div', 'my-plans-position-card__row my-plans-position-card__row--split');
        balanceRow.appendChild(el('div', 'my-plans-position-card__row-label', 'Uses your balance each buy'));
        const bal = el('div', 'my-plans-position-card__row-value my-plans-position-card__row-value--positive', 'Balance ok');
        balanceRow.appendChild(bal);
        list.appendChild(balanceRow);
      }

      if (planRecord.isReserved) {
        const reservedRow = el('div', 'my-plans-position-card__row my-plans-position-card__row--split my-plans-position-card__row--tight');
        reservedRow.appendChild(el('div', 'my-plans-position-card__row-label', 'Reserved funds remaining'));
        reservedRow.appendChild(el('div', 'my-plans-position-card__row-value', planRecord.reservedFunds || '—'));
        list.appendChild(reservedRow);
        const coversText = computeCoversBuysText(planRecord);
        if (coversText) {
          list.appendChild(el('div', 'my-plans-position-card__subvalue my-plans-position-card__subvalue--positive', coversText));
        }
      }

      body.appendChild(list);
      card.appendChild(body);

      // Actions
      const actions = el('div', 'my-plans-position-card__actions');
      const leftActions = el('div', 'my-plans-position-card__actions-left');
      const btn = (label, kind, dataAttr) => {
        const b = el('button', `my-plans-position-card__btn my-plans-position-card__btn--${kind}`, label);
        b.type = 'button';
        if (dataAttr) b.setAttribute(dataAttr, '');
        return b;
      };
      leftActions.appendChild(btn('Add funds', 'secondary', 'data-plan-card-add-funds'));
      leftActions.appendChild(btn(statusKey === 'paused' ? 'Resume' : 'Pause', 'secondary', 'data-plan-card-pause'));
      actions.appendChild(leftActions);
      actions.appendChild(btn('View detail', 'primary', 'data-plan-card-view-detail'));
      card.appendChild(actions);

      target.appendChild(card);
    };

    const renderMyPlansViews = () => {
      const records = getMyPlansRecords();
      panel.classList.toggle('my-plans-panel--hide-cards', records.length === 0);
      views.forEach((view) => {
        const viewId = view.getAttribute('data-my-plans-view') || 'active';
        const list = view.querySelector('[data-my-plans-list]');
        const empty = view.querySelector('[data-my-plans-empty]');
        if (!list) return;
        list.innerHTML = '';
        const filtered = records.filter((item) => item.status === viewId);
        filtered.forEach((item) => appendPlanCard(list, item));
        if (empty) empty.hidden = filtered.length > 0;
      });
      syncMyPlansLabels();
    };

    const setFilter = (id) => {
      activeFilter = id || 'active';
      tabs.forEach((tab) => {
        const on = tab.getAttribute('data-my-plans-filter') === activeFilter;
        tab.classList.toggle('is-active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      views.forEach((view) => {
        view.hidden = view.getAttribute('data-my-plans-view') !== activeFilter;
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => setFilter(tab.getAttribute('data-my-plans-filter')));
    });

    const syncMyPlansFromFlow = () => {
      renderMyPlansViews();
    };

    syncMyPlansFlowUi = syncMyPlansFromFlow;

    let backFromPlanSuccessView = false;

    const open = (openOpts = {}) => {
      backFromPlanSuccessView = !!openOpts.fromPlanSuccessView;
      syncMyPlansFromFlow();
      setFilter('active');
      panel.hidden = false;
      if (container) {
        container.classList.remove('is-my-plans-open');
        container.classList.remove('is-my-plans-fading');
      }
      requestAnimationFrame(() => {
        panel.classList.add('is-open');
      });
      setTimeout(() => {
        if (container && panel.classList.contains('is-open')) {
          container.classList.add('is-my-plans-fading');
        }
      }, 80);
      setTimeout(() => {
        if (container && panel.classList.contains('is-open')) {
          container.classList.add('is-my-plans-open');
        }
      }, 350);
    };

    const closeMyPlans = () => {
      panel.classList.remove('is-open');
      if (container) {
        container.classList.add('is-my-plans-fading');
        container.classList.remove('is-my-plans-open');
        requestAnimationFrame(() => {
          container.classList.remove('is-my-plans-fading');
        });
      }
      const onEnd = () => {
        if (!panel.classList.contains('is-open')) panel.hidden = true;
        panel.removeEventListener('transitionend', onEnd);
      };
      panel.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 380);
    };

    panel.querySelector('[data-my-plans-close]')?.addEventListener('click', () => {
      if (backFromPlanSuccessView) {
        backFromPlanSuccessView = false;
        goFinance();
        const dismiss = getDismissPlanDetail();
        if (typeof dismiss === 'function') dismiss();
        closeMyPlans();
        return;
      }
      closeMyPlans();
    });

    // "+" button: go back to Finance and open "New plan".
    panel.querySelector('[data-my-plans-add]')?.addEventListener('click', () => {
      closeMyPlans();
      goFinance();
      document.querySelector('[data-finance-new-plan]')?.click();
    });

    document.querySelectorAll('[data-open-my-plans]').forEach((btn) => {
      btn.addEventListener('click', () => {
        goFinance();
        open();
      });
    });

    syncMyPlansFromFlow();

    return { open, close: closeMyPlans, sync: syncMyPlansFromFlow };
  };

  const myPlansPanelApi = initMyPlansPanel({
    goFinanceAutoInvest,
    getDismissPlanDetailStackInstant: () => dismissPlanDetailStackInstant,
  });

  initFinanceSectionNav();
  initPlanStrategySlider();
  initPlanStrategyFreq();
  initPlanStrategyCarousel();
  initLimitsPanel();
  initCurrencySheet();
  applyFinanceSummaryMeta();
  initPromoIntroSheet({ goFinanceAutoInvest });
  initRangeSheet();
  initPlanBufferAutofillSheet();
  initSmartAllocInfoSheet();
  initScheduleBuyNowInfoSheet();
  initFinanceSummaryInfoSheets();
  initTopupSheet();
  initScheduleSheet();
  initScheduleTimePicker();
  initScheduleEndFollowupSheets();

  document.querySelector('[data-prototype-bottomsheet-stacking]')?.addEventListener('change', () => {
    resetScheduleNestedScrimHard();
  });
  document.querySelector('[data-prototype-breakdown-sp500]')?.addEventListener('change', () => {
    document.dispatchEvent(new CustomEvent('prototype-breakdown-sp500-toggle'));
  });
  document.querySelector('[data-prototype-finance-display-currency-selector]')?.addEventListener('change', () => {
    syncPrototypeFinanceCurrencySelectorVisible();
  });
  document.querySelector('[data-prototype-show-first-buy-today]')?.addEventListener('change', () => {
    syncPrototypeScheduleBuyNowRowVisible();
  });
  document.querySelector('[data-prototype-smart-allocation]')?.addEventListener('change', () => {
    document.dispatchEvent(new CustomEvent('prototype-smart-allocation-toggle'));
  });
  syncPrototypeScheduleBuyNowRowVisible();

  /** Fictional % delta from plan-detail allocation sliders (prototype feel). */
  let detailPanelAllocPctTweakFn = null;
  let refreshPlanDetailAllocTweak = () => {};

  // ─── Plan Detail Panel ──────────────────────────────────────────────────────
  const initPlanDetailPanel = (opts = {}) => {
    const goFinanceAutoInvestFromSuccess = typeof opts.goFinanceAutoInvest === 'function' ? opts.goFinanceAutoInvest : () => {};
    const openMyPlansAfterPlanFlow =
      typeof opts.openMyPlansAfterPlanFlow === 'function' ? opts.openMyPlansAfterPlanFlow : () => {};
    const panel = document.querySelector('[data-plan-detail-panel]');
    const container = document.querySelector('.phone-container');
    if (!panel) return;

    const formatDetailFooterProfit = (n) => {
      const abs = Math.abs(n);
      const round1 = (x) => {
        const r = Math.round(x * 10) / 10;
        return Number.isInteger(r) ? r.toString() : r.toString();
      };
      if (abs < 10000) return abs.toLocaleString('en-US');
      if (abs < 1000000) return `${round1(abs / 1000)}K`;
      return `${round1(abs / 1000000)}M`;
    };

    const parseDetailFooterAbsText = (text) => {
      const s = String(text || '').trim();
      const neg = s.startsWith('-');
      const t = s.replace(/^[+-]/, '').replace(/,/g, '').trim();
      if (!t) return NaN;
      let mult = 1;
      let numPart = t;
      if (/K$/i.test(numPart)) {
        mult = 1e3;
        numPart = numPart.slice(0, -1).trim();
      } else if (/M$/i.test(numPart)) {
        mult = 1e6;
        numPart = numPart.slice(0, -1).trim();
      }
      const n = parseFloat(numPart);
      if (!isFinite(n)) return NaN;
      const v = n * mult;
      return neg ? -v : v;
    };

    const snapshotFooterAllocBases = () => {
      const pctEl = panel.querySelector('[data-plan-detail-return-pct]');
      const absEl = panel.querySelector('[data-plan-detail-return-abs]');
      const histPctEl = panel.querySelector('[data-plan-detail-return-historic-pct]');
      if (pctEl) {
        const raw = parseFloat(String(pctEl.textContent).replace(/[^0-9.\-]/g, ''));
        if (isFinite(raw)) pctEl.dataset.allocBasePct = String(raw);
      }
      if (absEl) {
        const profit = parseDetailFooterAbsText(absEl.textContent);
        if (isFinite(profit)) absEl.dataset.allocBaseAbs = String(profit);
      }
      if (histPctEl) {
        const rawH = parseFloat(String(histPctEl.textContent).replace(/[^0-9.\-]/g, ''));
        if (isFinite(rawH)) histPctEl.dataset.allocBaseHistPct = String(rawH);
      }
    };

    const applyFooterAllocSliderTweak = () => {
      const pctEl = panel.querySelector('[data-plan-detail-return-pct]');
      const absEl = panel.querySelector('[data-plan-detail-return-abs]');
      const histPctEl = panel.querySelector('[data-plan-detail-return-historic-pct]');
      const autoHistPctEl = panel.querySelector('[data-plan-detail-alloc-auto-historic-pct]');
      const histToneRoot = panel.querySelector('[data-plan-detail-historic-performance-tone]');
      const curEl = panel.querySelector('[data-plan-detail-return-currency]');
      const simPctInlineEl = panel.querySelector('.plan-detail-panel__return-pct-inline.plan-return-metric__pct-line--simulated');
      if (!pctEl || typeof detailPanelAllocPctTweakFn !== 'function') return;
      const base = parseFloat(pctEl.dataset.allocBasePct || '');
      if (!isFinite(base)) return;
      const tw = detailPanelAllocPctTweakFn();
      if (!isFinite(tw)) return;
      const allocRoot = getActiveAllocMultiRoot();
      const isPctAllocInvalid = Boolean(
        allocRoot
        && allocRoot.classList.contains('alloc-multi--pct-invalid')
        && !allocRoot.classList.contains('alloc-multi--amount-mode'),
      );

      if (isPctAllocInvalid) {
        if (absEl) absEl.textContent = '- -';
        if (curEl) curEl.hidden = true;
        if (simPctInlineEl) simPctInlineEl.hidden = true;
        // Keep combined historic performance responsive to allocation changes.
        if (histPctEl) {
          const baseHist = parseFloat(histPctEl.dataset.allocBaseHistPct || '');
          if (isFinite(baseHist)) {
            const nextHist = baseHist + tw;
            const histText = `${nextHist.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
            histPctEl.textContent = histText;
            if (autoHistPctEl) autoHistPctEl.textContent = histText;
            if (histToneRoot) setReturnMetricTone(histToneRoot, nextHist);
          }
        }
        return;
      }

      if (curEl) curEl.hidden = false;
      if (simPctInlineEl) simPctInlineEl.hidden = false;
      const amountInp = panel.querySelector('[data-plan-detail-amount-input]');
      const investAmt = Math.max(0, parseInt(amountInp?.value?.replace(/[^0-9]/g, '') || '0', 10) || 0);
      // No "amount per buy" → keep simulated return at the snapshotted base (0% from the model); do not nudge from allocation sliders.
      const appliedTwSim = investAmt > 0 ? tw : 0;
      const nextPct = base + appliedTwSim;
      pctEl.textContent = `${nextPct.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}% return`;

      if (absEl) {
        const baseAbs = parseFloat(absEl.dataset.allocBaseAbs || '');
        if (isFinite(baseAbs) && Math.abs(base) > 1e-6) {
          const nextAbs = baseAbs * (nextPct / base);
          const sign = nextAbs >= 0 ? '+' : '-';
          absEl.textContent = `${sign}${formatDetailFooterProfit(Math.abs(nextAbs))}`;
        } else {
          // When base return is 0 (common with empty/zero amount), restore from invalid placeholder to default +0.
          absEl.textContent = '+0';
        }
      }

      // Historic (combined) performance should respond to allocation even when amount per buy is empty/0.
      if (histPctEl) {
        const baseHist = parseFloat(histPctEl.dataset.allocBaseHistPct || '');
        if (isFinite(baseHist)) {
          const nextHist = baseHist + tw;
          const histText = `${nextHist.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
          histPctEl.textContent = histText;
          if (autoHistPctEl) autoHistPctEl.textContent = histText;
          if (histToneRoot) setReturnMetricTone(histToneRoot, nextHist);
        }
      }
    };

    refreshPlanDetailAllocTweak = () => {
      if (panel.classList.contains('is-open')) applyFooterAllocSliderTweak();
    };

    /** @type {{ source: 'plan' | 'curated' | 'spotlight' | 'newplan', curatedKey?: string, spotlightKey?: string, card?: Element }} */
    let panelOpenContext = { source: 'plan' };
    let customPlanTitle = '';

    const openBtn = document.querySelector('.plan-strategy__cta');
    const newPlanBtn = document.querySelector('.finance-summary__btn--primary');
    const closeButtons = panel.querySelectorAll('[data-plan-detail-close]');
    const scroller = panel.querySelector('[data-plan-detail-scroller]');
    /** Scroll plan-detail scroller so `el` sits near the top (with optional padding). */
    const scrollPlanDetailContentTo = (el, topOffsetPx = 0) => {
      if (!scroller || !el) return;
      const sr = scroller.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const nextTop = scroller.scrollTop + (er.top - sr.top) - topOffsetPx;
      scroller.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    };
    const productArea = panel.querySelector('[data-plan-detail-product-area]');
    const header = panel.querySelector('[data-plan-detail-header]');
    const pageTitle = panel.querySelector('[data-plan-detail-page-title]');
    const nameEditBtn = panel.querySelector('[data-plan-detail-name-edit-btn]');
    const nameEditIcon = panel.querySelector('[data-plan-detail-name-edit-icon]');
    const nameInput = panel.querySelector('[data-plan-detail-name-input]');
    const nameSpan = panel.querySelector('[data-plan-detail-name]');
    let snackbarTimer = null;
    let snackbarEl = null;

    const ensureTopSnackbar = () => {
      if (snackbarEl && snackbarEl.isConnected) return snackbarEl;
      snackbarEl = document.createElement('div');
      snackbarEl.className = 'snackbar';
      snackbarEl.setAttribute('role', 'status');
      snackbarEl.setAttribute('aria-live', 'polite');
      snackbarEl.innerHTML = `
        <span class="snackbar__icon" aria-hidden="true">
          <img src="assets/icon_timeline_activewarning.svg" alt="" />
        </span>
        <span data-plan-detail-snackbar-text></span>
      `;
      (container || panel).appendChild(snackbarEl);
      return snackbarEl;
    };

    const showTopSnackbar = (message, opts = {}) => {
      const el = ensureTopSnackbar();
      const variant = opts.variant || 'default';
      const textEl = el.querySelector('[data-plan-detail-snackbar-text]');
      if (textEl) textEl.textContent = String(message || '');
      el.classList.toggle('snackbar--alloc-picker-max', variant === 'alloc-picker-max');
      const iconImg = el.querySelector('.snackbar__icon img');
      if (iconImg) {
        iconImg.setAttribute(
          'src',
          variant === 'alloc-picker-max'
            ? 'assets/icon_info_blue.svg'
            : 'assets/icon_timeline_activewarning.svg',
        );
      }
      if (snackbarTimer) clearTimeout(snackbarTimer);
      el.classList.remove('is-visible');
      void el.offsetWidth;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.add('is-visible');
        });
      });
      snackbarTimer = setTimeout(() => {
        el.classList.remove('is-visible', 'snackbar--alloc-picker-max');
        if (iconImg) iconImg.setAttribute('src', 'assets/icon_timeline_activewarning.svg');
        snackbarTimer = null;
      }, 1800);
    };

    const planAllocation = {
      bitcoin:    [{ name: 'Bitcoin',      ticker: 'BTC',  icon: 'assets/icon_currency_btc.svg' }],
      ethereum:   [{ name: 'Ethereum',     ticker: 'ETH',  icon: 'assets/icon_currency_eth.svg' }],
      solana:     [{ name: 'Solana',       ticker: 'SOL',  icon: 'assets/icon_solana.svg' }],
      bigthree:   [
        { name: 'Bitcoin',  ticker: 'BTC',  icon: 'assets/icon_currency_btc.svg' },
        { name: 'Ethereum', ticker: 'ETH',  icon: 'assets/icon_currency_eth.svg' },
        { name: 'Solana',   ticker: 'SOL',  icon: 'assets/icon_solana.svg' },
      ],
      digitalgold: [
        { name: 'Bitcoin',      ticker: 'BTC',  icon: 'assets/icon_currency_btc.svg' },
        { name: 'Tether Gold',  ticker: 'XAUT', icon: 'assets/icon_currency_xaut.svg' },
      ],
      aiessentials: [
        { name: 'Render', ticker: 'RENDER', icon: 'assets/icon_currency_render.svg' },
        { name: 'NEAR',   ticker: 'NEAR',   icon: 'assets/icon_currency_near.svg' },
        { name: 'Solana', ticker: 'SOL',    icon: 'assets/icon_solana.svg' },
      ],
    };

    const planTicker = {
      bitcoin:     'BTC',
      ethereum:    'ETH',
      solana:      'SOL',
      bigthree:    'BTC · ETH · SOL',
      digitalgold: 'BTC · XAUT',
      aiessentials: 'RENDER, NEAR, SOL',
    };

    const pickableCoins = [
      { key: 'btc', name: 'Bitcoin', ticker: 'BTC', icon: 'assets/icon_currency_btc.svg', ret: '121.23%' },
      { key: 'eth', name: 'Ethereum', ticker: 'ETH', icon: 'assets/icon_currency_eth.svg', ret: '73.88%' },
      { key: 'sol', name: 'Solana', ticker: 'SOL', icon: 'assets/icon_solana.svg', ret: '142.11%' },
      { key: 'xaut', name: 'Tether Gold', ticker: 'XAUT', icon: 'assets/icon_currency_xaut.svg', ret: '28.30%' },
      { key: 'render', name: 'Render', ticker: 'RENDER', icon: 'assets/icon_currency_render.svg', ret: '65.20%' },
      { key: 'near', name: 'NEAR', ticker: 'NEAR', icon: 'assets/icon_currency_near.svg', ret: '41.80%' },
      { key: 'link', name: 'Chainlink', ticker: 'LINK', icon: 'assets/icon_currency_link.svg', ret: '35.60%' },
      { key: 'xrp', name: 'XRP', ticker: 'XRP', icon: 'assets/icon_currency_xrp.svg', ret: '44.20%' },
    ];

    const pickerCurated = [
      {
        key: 'bigthree',
        icon: 'assets/icon_bigthree.svg',
        title: 'Big Three',
        tickers: 'BTC, ETH, SOL',
        desc: 'DCA into the top three cryptos',
      },
      {
        key: 'digitalgold',
        icon: 'assets/icon_digitalgold.svg',
        title: 'Digital gold',
        tickers: 'BTC, XAUT',
        desc: 'Tokenized Gold and Bitcoin combined',
      },
      {
        key: 'aiessentials',
        icon: 'assets/icon_aiessentials.svg',
        title: 'AI essentials',
        tickers: 'RENDER, NEAR, SOL',
        desc: 'Leading AI projects and platforms',
      },
    ];

    let detailAllocOverride = null;
    let latestAllocItemCount = 0;

    const getManualAllocSection = () =>
      panel.querySelector('.plan-detail-panel__allocation-section:not(.plan-detail-panel__allocation-section--auto)');
    const getAutoAllocSection = () => panel.querySelector('[data-plan-detail-allocation-auto-section]');
    const getActiveAllocSection = () => {
      const useSmart = getPrototypeSmartAllocationEnabled();
      const manualSection = getManualAllocSection();
      const autoSection = getAutoAllocSection();
      if (useSmart && autoSection && !autoSection.hidden) return autoSection;
      if (manualSection && !manualSection.hidden) return manualSection;
      if (autoSection && !autoSection.hidden) return autoSection;
      return manualSection || autoSection || null;
    };
    const getActiveAllocMultiRoot = () => getActiveAllocSection()?.querySelector('.alloc-multi') || null;
    const getActiveAllocMultiItems = () => Array.from(getActiveAllocSection()?.querySelectorAll('.alloc-multi__item') || []);
    const syncActiveAllocationVariant = () => {
      const manualSection = getManualAllocSection();
      const autoSection = getAutoAllocSection();
      const useSmart = getPrototypeSmartAllocationEnabled();
      const canUseSmart = useSmart && latestAllocItemCount >= 2;
      if (manualSection) manualSection.hidden = canUseSmart;
      if (autoSection) autoSection.hidden = !canUseSmart;
      detailPanelAllocPctTweakFn = canUseSmart
        ? (panel._planDetailAutoAllocTweakFn || panel._planDetailManualAllocTweakFn || null)
        : (panel._planDetailManualAllocTweakFn || panel._planDetailAutoAllocTweakFn || null);
    };

    // Static balances for the prototype
    const BALANCES = { TWD: 75000, USDT: 2750 };

    const syncPlanDetailContinueState = () => {
      const continueBtn = panel.querySelector('.plan-detail-panel__continue');
      if (!continueBtn) return;
      const breakdownBtn = panel.querySelector('.plan-detail-panel__view-breakdown-link');

      const allocCount = parseInt(
        panel.querySelector('[data-plan-detail-alloc-count]')?.textContent?.trim() || '0',
        10,
      ) || 0;
      const amount = parseInt(
        panel.querySelector('[data-plan-detail-amount-input]')?.value?.replace(/[^0-9]/g, '') || '0',
        10,
      );
      const cur = currencyState.plan;
      const balance = BALANCES[cur] ?? BALANCES.TWD;

      const noAssets = allocCount < 1;
      const noAmount = !amount || amount <= 0;
      const exceedsBalance = amount > balance;

      let allocationOutOfBalance = false;
      const allocRoot = getActiveAllocMultiRoot();
      const isSmartAllocUi = Boolean(allocRoot?.classList.contains('alloc-multi--auto'));
      if (allocRoot && allocCount >= 2 && !isSmartAllocUi) {
        const rows = allocRoot.querySelectorAll('.alloc-multi__item [data-alloc-pct-input]');
        if (rows.length >= 2) {
          if (allocRoot.classList.contains('alloc-multi--amount-mode')) {
            let sumAmt = 0;
            rows.forEach((inp) => {
              const v = parseInt(String(inp.value || '').replace(/[^0-9]/g, ''), 10);
              if (!isNaN(v)) sumAmt += v;
            });
            allocationOutOfBalance = amount > 0 && sumAmt !== amount;
          } else {
            let sumPct = 0;
            rows.forEach((inp) => {
              const v = parseInt(String(inp.value || '').replace(/[^0-9]/g, ''), 10);
              if (!isNaN(v)) sumPct += v;
            });
            allocationOutOfBalance = Math.abs(sumPct - 100) > 0.51;
          }
        }
      }

      continueBtn.disabled = noAssets || noAmount || exceedsBalance || allocationOutOfBalance;

      const isPctAllocInvalid =
        allocRoot
        && allocCount >= 2
        && !allocRoot.classList.contains('alloc-multi--amount-mode')
        && allocationOutOfBalance;
      if (breakdownBtn) breakdownBtn.disabled = noAssets || noAmount || isPctAllocInvalid;

      const detailAbsEl = panel.querySelector('[data-plan-detail-return-abs]');
      const detailCurEl = panel.querySelector('[data-plan-detail-return-currency]');
      const detailPctInlineEl = panel.querySelector('.plan-detail-panel__return-pct-inline.plan-return-metric__pct-line--simulated');
      if (noAssets) {
        if (detailAbsEl) detailAbsEl.textContent = '- -';
        if (detailCurEl) detailCurEl.hidden = true;
        if (detailPctInlineEl) detailPctInlineEl.hidden = true;
      } else if (isPctAllocInvalid) {
        if (detailAbsEl) detailAbsEl.textContent = '- -';
        if (detailCurEl) detailCurEl.hidden = true;
        if (detailPctInlineEl) detailPctInlineEl.hidden = true;
      } else {
        if (detailCurEl) detailCurEl.hidden = false;
        if (detailPctInlineEl) detailPctInlineEl.hidden = false;
      }
    };

    /** Plan detail repeats line reflects schedule end: Set a limit (enddate) vs Continuous / After N buys. */
    const isPlanDetailSetLimitEnd = (text) => {
      const t = String(text || '').trim();
      const tl = t.toLowerCase();
      if (!t) return false;
      // Guard continuous variants (including legacy typo "Continuous").
      if (tl.includes('continuous') || tl.includes('Continuous')) return false;
      if (tl.startsWith('after')) return false;
      if (t === 'End on date') return true;
      if (!/\b(buy|buys)\b/i.test(t)) return false;
      return t.includes('~ Ends') || t.includes('Ends ~') || /\bEnds\s+[\w\s,.]+\s*~\s*$/i.test(t);
    };

    /** "Total planned investment" row only for Set a limit; Continuous uses current balance + cover + hint (Figma 8527:4820 / 8527:4835). */
    const syncPlanDetailSetLimitDetailRowsVisibility = () => {
      const totalPlannedRow = panel.querySelector('[data-plan-detail-total-planned-row]');
      const endEl = panel.querySelector('[data-plan-detail-repeats-end]');
      const endText = String(endEl?.dataset?.endConditionText || endEl?.textContent || '');
      const show = isPlanDetailSetLimitEnd(endText);
      if (totalPlannedRow) totalPlannedRow.hidden = !show;
    };

    // Recalculate header "Avail.", Details rows (Figma 8527:4820 / 8527:4835), and balance-can-cover copy.
    const updateCoverageUI = () => {
      const cur = currencyState.plan;
      const balance = BALANCES[cur] ?? BALANCES.TWD;

      // "Avail. 15,000 TWD"
      const availEl = panel.querySelector('.plan-detail-panel__avail-text');
      if (availEl) {
        availEl.innerHTML = `Avail. ${balance.toLocaleString('en-US')} <span data-plan-detail-coverage-currency>${cur}</span>`;
      }

      const currentBalanceEl = panel.querySelector('[data-plan-detail-current-balance]');
      if (currentBalanceEl) {
        currentBalanceEl.textContent = `${balance.toLocaleString('en-US')} ${cur}`;
      }

      const totalPlannedEl = panel.querySelector('[data-plan-detail-total-planned]');
      const coverageValueEl = panel.querySelector('[data-plan-detail-coverage-value]');
      const errorEl = panel.querySelector('[data-plan-detail-amount-error]');
      const errorCurEl = errorEl?.querySelector('[data-plan-detail-error-currency]');

      // Keep error currency label in sync
      if (errorCurEl) errorCurEl.textContent = cur;

      const setError = (isError, message = null) => {
        if (coverageValueEl) coverageValueEl.style.color = isError ? '#EB5347' : '';
        if (errorEl) errorEl.classList.toggle('is-visible', isError);
        if (errorEl && typeof message === 'string' && message.trim()) {
          errorEl.innerHTML = `${message}${message.includes(cur) ? '' : ` <span data-plan-detail-error-currency></span>`}`;
        }
      };

      if (!coverageValueEl) return;
      const syncCoveragePlaceholderTone = (el) => {
        if (!el) return;
        const t = String(el.textContent || '').trim();
        const isPlaceholder = t === '- -' || t === '—';
        el.classList.toggle('plan-detail-panel__coverage-value--placeholder', isPlaceholder);
      };

      const getRepeatsEndText = () => {
        const endEl = panel.querySelector('[data-plan-detail-repeats-end]');
        return String(endEl?.dataset?.endConditionText || endEl?.textContent || '').trim();
      };

      const parseLimitBuysFromRepeatsEnd = (endT) => {
        const lead = String(endT || '').match(/^(\d+)/);
        const n = lead ? parseInt(lead[1], 10) : NaN;
        return Number.isFinite(n) && n >= 1 ? n : NaN;
      };

      /** Set a limit: total planned = auto-invest × scheduled buys (Figma 8527:4835). */
      const refillTotalPlannedForSetLimit = () => {
        if (!totalPlannedEl) return;
        const endT = getRepeatsEndText();
        if (!isPlanDetailSetLimitEnd(endT)) return;
        const amt = parseInt(amountInput?.value?.replace(/[^0-9]/g, '') || '0', 10);
        if (!amt || amt <= 0) {
          totalPlannedEl.textContent = '- -';
          syncCoveragePlaceholderTone(totalPlannedEl);
          return;
        }
        const limitBuys = parseLimitBuysFromRepeatsEnd(endT);
        if (!Number.isFinite(limitBuys)) {
          totalPlannedEl.textContent = '- -';
          syncCoveragePlaceholderTone(totalPlannedEl);
          return;
        }
        totalPlannedEl.textContent = `${(amt * limitBuys).toLocaleString('en-US')} ${cur}`;
        syncCoveragePlaceholderTone(totalPlannedEl);
      };

      const formatCoverageBuysValue = (balanceBuys, endT) => {
        const setLimit = isPlanDetailSetLimitEnd(endT);
        const limitBuys = setLimit ? parseLimitBuysFromRepeatsEnd(endT) : NaN;
        const raw = Math.max(0, Math.floor(balanceBuys));
        if (setLimit && Number.isFinite(limitBuys)) {
          const shown = Math.min(raw, limitBuys);
          const limWord = limitBuys === 1 ? 'buy' : 'buys';
          return `~${shown} / ${limitBuys} ${limWord}`;
        }
        const buyWord = raw === 1 ? 'buy' : 'buys';
        return `~${raw} ${buyWord}`;
      };

      const HINT_NEUTRAL = '';
      const HINT_ERROR = 'Not enough for 1 buy';
      const HINT_OK = 'Enough for 1 buy';

      const syncPlanDetailCoverageHint = ({ hasAmount, balanceBuys }) => {
        const hintEl = panel.querySelector('[data-plan-detail-coverage-hint]');
        if (!hintEl) return;
        hintEl.classList.remove(
          'plan-detail-panel__coverage-hint--neutral',
          'plan-detail-panel__coverage-hint--error',
          'plan-detail-panel__coverage-hint--ok',
        );
        if (!hasAmount) {
          hintEl.classList.add('plan-detail-panel__coverage-hint--neutral');
          hintEl.textContent = HINT_NEUTRAL;
          return;
        }
        if (balanceBuys <= 0) {
          hintEl.classList.add('plan-detail-panel__coverage-hint--error');
          hintEl.textContent = HINT_ERROR;
          return;
        }
        hintEl.classList.add('plan-detail-panel__coverage-hint--ok');
        hintEl.textContent = HINT_OK;
      };

      const amount = parseInt(amountInput?.value?.replace(/[^0-9]/g, '') || '0', 10);
      const endT = getRepeatsEndText();

      if (!amount || amount <= 0) {
        coverageValueEl.textContent = '- -';
        setError(false);
        syncCoveragePlaceholderTone(coverageValueEl);
        refillTotalPlannedForSetLimit();
        syncPlanDetailSetLimitDetailRowsVisibility();
        syncPlanDetailCoverageHint({ hasAmount: false, balanceBuys: 0 });
        return;
      }

      if (amount > balance) {
        coverageValueEl.textContent = formatCoverageBuysValue(0, endT);
        setError(true, 'Not enough balance for one buy');
        syncCoveragePlaceholderTone(coverageValueEl);
        refillTotalPlannedForSetLimit();
        syncPlanDetailSetLimitDetailRowsVisibility();
        syncPlanDetailCoverageHint({ hasAmount: true, balanceBuys: 0 });
        return;
      }

      // How many buys fit in the available balance (same for daily / weekly / monthly).
      const buys = Math.floor(balance / amount);

      if (buys === 0) {
        coverageValueEl.textContent = formatCoverageBuysValue(0, endT);
        setError(true, `Not enough <span data-plan-detail-error-currency>${cur}</span> for one buy`);
        syncCoveragePlaceholderTone(coverageValueEl);
        refillTotalPlannedForSetLimit();
        syncPlanDetailSetLimitDetailRowsVisibility();
        syncPlanDetailCoverageHint({ hasAmount: true, balanceBuys: 0 });
        return;
      }

      setError(false);
      coverageValueEl.textContent = formatCoverageBuysValue(buys, endT);
      syncCoveragePlaceholderTone(coverageValueEl);
      refillTotalPlannedForSetLimit();
      syncPlanDetailSetLimitDetailRowsVisibility();
      syncPlanDetailCoverageHint({ hasAmount: true, balanceBuys: buys });
      syncPlanDetailContinueState();
    };

    // Sync all footer return elements from the main widget's currently displayed values.
    const syncFooterFromMainWidget = () => {
      const absEl = panel.querySelector('[data-plan-detail-return-abs]');
      const currEl = panel.querySelector('[data-plan-detail-return-currency]');
      const titleEl = panel.querySelector('[data-plan-detail-return-title]');
      const pctEl = panel.querySelector('[data-plan-detail-return-pct]');
      const histPctEl = panel.querySelector('[data-plan-detail-return-historic-pct]');
      const histIcons = panel.querySelector('[data-plan-detail-return-asset-icons]');
      const histCap = panel.querySelector('[data-plan-detail-return-historic-caption]');
      const stratCap = panel.querySelector('[data-plan-detail-return-strategy-caption]');
      if (absEl) absEl.textContent = document.querySelector('.plan-strategy__return-abs')?.textContent || absEl.textContent;
      if (currEl) currEl.textContent = document.querySelector('[data-plan-return-currency]')?.textContent || currEl.textContent;
      if (titleEl) titleEl.textContent = document.querySelector('[data-plan-return-title]')?.textContent || titleEl.textContent;
      if (pctEl) {
        const wSim = document.querySelector(
          '.plan-strategy__return-metrics-col--strategy.plan-strategy__return-metrics-col--values .plan-strategy__return-pct',
        )?.textContent;
        if (wSim) {
          const core = String(wSim).replace(/\s+return\s*$/i, '').trim();
          pctEl.textContent = `${core} return`;
        }
      }
      if (histPctEl) {
        histPctEl.textContent = document.querySelector('[data-plan-return-historic-pct]')?.textContent || histPctEl.textContent;
      }
      if (histIcons) {
        const w = document.querySelector('[data-plan-return-asset-icons]');
        setReturnMetricIconWrapHtml(histIcons, w?.innerHTML ?? '', {
          layoutSig: w?.dataset?.returnMetricIconSig,
        });
      }
      if (histCap) {
        histCap.textContent = document.querySelector('[data-plan-return-historic-caption]')?.textContent || histCap.textContent;
      }
      if (stratCap) {
        stratCap.textContent = document.querySelector('[data-plan-return-strategy-caption]')?.textContent || stratCap.textContent;
      }
      const dStrat = panel.querySelector(
        '.plan-detail-panel__return-metrics-col--strategy.plan-detail-panel__return-metrics-col--values',
      );
      const dHist = panel.querySelector('[data-plan-detail-historic-performance-tone]');
      const wStrat = document.querySelector(
        '.plan-strategy__return-metrics-col--strategy.plan-strategy__return-metrics-col--values',
      );
      const wHist = document.querySelector(
        '.plan-strategy__return-metrics-col--historic.plan-strategy__return-metrics-col--values',
      );
      if (dStrat && wStrat) {
        dStrat.classList.toggle('plan-return-metric__group--loss', wStrat.classList.contains('plan-return-metric__group--loss'));
        dStrat.querySelectorAll('.plan-return-metric__arrow').forEach((img, i) => {
          const wImg = wStrat.querySelectorAll('.plan-return-metric__arrow')[i];
          if (!wImg) return;
          if (wImg.classList.contains('plan-return-metric__arrow--historic')) {
            img.src = wImg.src;
            img.classList.remove('plan-return-metric__arrow--down');
          } else {
            img.classList.toggle('plan-return-metric__arrow--down', wImg.classList.contains('plan-return-metric__arrow--down'));
          }
        });
      }
      if (dHist && wHist) {
        dHist.classList.toggle('plan-return-metric__group--loss', wHist.classList.contains('plan-return-metric__group--loss'));
        dHist.querySelectorAll('.plan-return-metric__arrow').forEach((img, i) => {
          const wImg = wHist.querySelectorAll('.plan-return-metric__arrow')[i];
          if (!wImg) return;
          if (wImg.classList.contains('plan-return-metric__arrow--historic')) {
            img.src = wImg.src;
            img.classList.remove('plan-return-metric__arrow--down');
          } else {
            img.classList.toggle('plan-return-metric__arrow--down', wImg.classList.contains('plan-return-metric__arrow--down'));
          }
        });
      }
    };

    // ── Multi-asset allocation sliders ────────────────────────────────────────
    // Called after multi-asset HTML is rendered into the allocation list.
    // Each row is edited independently; total % or amounts must match before Continue.
    const initAllocSliders = (panelEl, count) => {
      const allocPanelAbortKey = '_allocPanelControlsAbort';
      if (panelEl[allocPanelAbortKey]) panelEl[allocPanelAbortKey].abort();

      if (count < 2) {
        panelEl._planDetailManualAllocTweakFn = null;
        panelEl._planDetailAllocRefreshAmounts = null;
        const resetBtnEarly = panelEl.querySelector('[data-alloc-reset]');
        if (resetBtnEarly) resetBtnEarly.hidden = true;
        syncActiveAllocationVariant();
        return;
      }

      const panelAc = new AbortController();
      panelEl[allocPanelAbortKey] = panelAc;
      const panelCtlSignal = panelAc.signal;

      document.querySelector('[data-alloc-lock-tooltip]')?.classList.remove('is-visible');

      const defaultPcts = count === 2 ? [50, 50] : [34, 33, 33];
      const pcts = [...defaultPcts];

      const items = Array.from(panelEl.querySelectorAll('.alloc-multi__item'));
      const allocMultiRoot = items[0]?.closest('.alloc-multi');
      /** @type {'pct' | 'amount'} */
      let inputMode = 'pct';

      const getPlanDetailInvestTotal = () => {
        const inp = panelEl.querySelector('[data-plan-detail-amount-input]');
        return Math.max(0, parseInt(inp?.value?.replace(/[^0-9]/g, '') || '0', 10) || 0);
      };

      const getPlanDetailCurrency = () =>
        panelEl.querySelector('[data-plan-detail-currency]')?.textContent?.trim() || 'TWD';

      const formatAllocAmountDisplay = (n) => {
        const r = Math.round(n);
        return Number.isFinite(r) ? r.toLocaleString('en-US') : '';
      };

      /** Comma-format like the main Auto-invest field; keeps cursor on digit count. */
      const applyAllocInputLiveFormat = (inp) => {
        const cursor = inp.selectionStart;
        const oldVal = inp.value;
        const digitsBeforeCursor = oldVal.slice(0, cursor).replace(/[^0-9]/g, '').length;
        const raw = oldVal.replace(/[^0-9]/g, '');
        if (!raw) {
          inp.value = '';
          return;
        }
        const clamped = Math.min(parseInt(raw, 10), 999999999);
        const formatted = clamped.toLocaleString('en-US');
        inp.value = formatted;
        let newCursor = 0;
        let digitsSeen = 0;
        for (let k = 0; k < formatted.length; k += 1) {
          if (digitsSeen === digitsBeforeCursor) {
            newCursor = k;
            break;
          }
          if (formatted[k] !== ',') digitsSeen += 1;
          newCursor = k + 1;
        }
        inp.setSelectionRange(newCursor, newCursor);
      };

      const syncAllocInputModeClass = () => {
        if (allocMultiRoot) {
          allocMultiRoot.classList.toggle('alloc-multi--amount-mode', inputMode === 'amount');
        }
      };

      const isAllocPctTotalValid = () => {
        const sum = pcts.reduce((a, b) => a + b, 0);
        return Math.abs(sum - 100) < 0.45;
      };

      /**
       * Amount mode only: dim + block allocation controls when Auto-invest can't assign
       * at least 1 unit per asset (or total is 0). % mode is always fully interactive.
       */
      const syncAllocAmountWrapDisabled = () => {
        if (!allocMultiRoot) return;
        const total = getPlanDetailInvestTotal();
        const cannotSplitWholeUnits = total > 0 && total < count;
        const wrapDisabled =
          inputMode === 'amount' && (total <= 0 || cannotSplitWholeUnits);
        allocMultiRoot.classList.toggle('alloc-multi--amount-wrap-disabled', wrapDisabled);
        if (wrapDisabled) {
          const ae = document.activeElement;
          if (ae && allocMultiRoot.contains(ae)) ae.blur();
        }
      };

      const updateAllocHeaderSubtitle = () => {
        const el = panelEl.querySelector('[data-plan-detail-alloc-subtitle]');
        if (!el) return;
        const currentEl = el.querySelector('[data-plan-detail-alloc-total-current]');
        const targetEl = el.querySelector('[data-plan-detail-alloc-total-target]');
        const errEl = el.querySelector('[data-plan-detail-alloc-total-error]');
        const checkEl = el.querySelector('[data-plan-detail-alloc-total-check]');

        if (inputMode === 'amount') {
          // Keep legacy behavior in amount mode: show total amount-per-buy; no /100% or allocation error.
          const total = getPlanDetailInvestTotal();
          const cur = getPlanDetailCurrency();
          const numStr = total > 0 ? total.toLocaleString('en-US') : '0';
          if (currentEl) currentEl.textContent = `${numStr} ${cur}`;
          if (targetEl) targetEl.textContent = '';
          if (errEl) errEl.hidden = true;
          if (currentEl) currentEl.classList.remove('is-error');
          if (checkEl) {
            checkEl.hidden = true;
            checkEl.setAttribute('aria-hidden', 'true');
          }
          return;
        }

        const sum = pcts.reduce((a, b) => a + b, 0);
        const remainingRaw = 100 - sum;
        const isValid = isAllocPctTotalValid();
        const formatAllocTotalPct = (n) => {
          const v = Math.round(n * 10) / 10;
          if (Number.isInteger(v)) return `${v}%`;
          return `${v.toFixed(1)}%`;
        };
        if (currentEl) {
          if (isValid) {
            currentEl.textContent = '0%';
            currentEl.classList.remove('is-error');
          } else {
            currentEl.textContent = formatAllocTotalPct(remainingRaw);
            currentEl.classList.add('is-error');
          }
        }
        if (checkEl) {
          checkEl.hidden = !isValid;
          checkEl.setAttribute('aria-hidden', isValid ? 'false' : 'true');
        }
        if (targetEl) targetEl.textContent = ' / 100%';
        if (errEl) {
          if (isValid) {
            errEl.hidden = true;
          } else {
            errEl.hidden = false;
            if (remainingRaw > 0.45) {
              errEl.textContent = `Add ${formatAllocTotalPct(remainingRaw)} to continue`;
            } else if (remainingRaw < -0.45) {
              const over = sum - 100;
              errEl.textContent = `Reduce ${formatAllocTotalPct(over)} to continue`;
            } else {
              errEl.textContent = 'Allocation should add up to 100%';
            }
          }
        }
      };

      const renderItem = (i) => {
        const item = items[i];
        if (!item) return;
        const fill = item.querySelector('[data-alloc-fill]');
        const thumb = item.querySelector('[data-alloc-thumb]');
        const input = item.querySelector('[data-alloc-pct-input]');
        const symbolEl = item.querySelector('.alloc-multi__pct-symbol');
        const amountSubEl = item.querySelector('[data-alloc-pct-amount-sub]');
        const p = pcts[i] / 100;

        if (fill) fill.style.width = `${p * 100}%`;
        if (thumb) thumb.style.left = `calc(${p * 100}% - ${p * 24}px)`;
        if (symbolEl) {
          symbolEl.textContent = inputMode === 'amount' ? getPlanDetailCurrency() : '%';
        }
        if (amountSubEl) {
          if (inputMode === 'amount') {
            amountSubEl.textContent = '';
            amountSubEl.hidden = true;
            amountSubEl.setAttribute('aria-hidden', 'true');
          } else {
            amountSubEl.hidden = false;
            const invest = getPlanDetailInvestTotal();
            const cur = getPlanDetailCurrency();
            const slice = invest > 0 ? Math.round((invest * pcts[i]) / 100) : 0;
            amountSubEl.textContent = `${slice.toLocaleString('en-US')} ${cur}`;
            amountSubEl.setAttribute('aria-hidden', 'false');
          }
        }
        if (input && document.activeElement !== input) {
          if (inputMode === 'amount') {
            const total = getPlanDetailInvestTotal();
            if (total > 0) {
              const rounded = Math.round((total * pcts[i]) / 100);
              const minOne = total >= count && rounded < 1 ? 1 : rounded;
              input.value = formatAllocAmountDisplay(minOne);
            } else {
              input.value = '';
            }
            input.setAttribute('aria-label', 'Allocation amount');
            input.removeAttribute('maxlength');
          } else {
            input.value = String(Math.round(pcts[i]));
            input.setAttribute('aria-label', 'Allocation percent');
            input.setAttribute('maxlength', '2');
          }
        }
      };

      const isAtDefaultAllocation = () =>
        pcts.every((p, i) => Math.abs(p - defaultPcts[i]) < 0.45);

      const updateAllocResetVisibility = () => {
        const btn = panelEl.querySelector('[data-alloc-reset]');
        if (!btn) return;
        // For multi-asset plans this action should always be available.
        btn.hidden = false;
      };

      const renderAll = () => {
        items.forEach((_, i) => renderItem(i));
        updateAllocResetVisibility();
        updateAllocHeaderSubtitle();
        if (allocMultiRoot) {
          allocMultiRoot.classList.toggle('alloc-multi--pct-invalid', inputMode === 'pct' && !isAllocPctTotalValid());
        }
        syncAllocAmountWrapDisabled();
        syncPlanDetailContinueState();
      };

      /** Slider drags update `pcts` but `renderItem` skips the focused input — blur so values stay in sync. */
      const blurAllocPctInputIfFocused = () => {
        const ae = document.activeElement;
        if (ae?.matches?.('[data-alloc-pct-input]') && panelEl.contains(ae)) ae.blur();
      };

      /**
       * Amount mode: min % so Math.round(total × pct / 100) ≥ 1 → pct ≥ 50/t (ceil).
       * % mode: 1% floor per row; rows are independent (total can differ from 100% until user balances).
       */
      const getMinPctPerOpenSlot = () => {
        if (inputMode !== 'amount') return 1;
        const t = getPlanDetailInvestTotal();
        if (!t || t <= 0) return 1;
        const need = Math.ceil(50 / t);
        const minPct = Math.max(1, Math.min(99, need));
        if (minPct * count > 100) return 1;
        return minPct;
      };

      /** Update one row only; no auto-rebalance across assets. */
      const applyAllocChange = (changedIdx, rawPct) => {
        const minSlot = getMinPctPerOpenSlot();
        let v = Math.round(rawPct);
        v = Math.max(minSlot, Math.min(99, v));
        pcts[changedIdx] = v;

        if (inputMode === 'amount') {
          const t = getPlanDetailInvestTotal();
          const minS = getMinPctPerOpenSlot();
          if (t >= count && t > 0 && Math.round((t * pcts[changedIdx]) / 100) < 1) {
            pcts[changedIdx] = minS;
          }
        }

        renderAll();
        refreshPlanDetailAllocTweak();
      };

      // Tiny synthetic sensitivity vs default split → footer % moves slightly (prototype only)
      const allocBaseline = [...defaultPcts];
      panelEl._planDetailManualAllocTweakFn = () => {
        const sens = count === 3 ? [0.018, 0.01, -0.007] : [0.014, -0.014];
        let t = 0;
        for (let i = 0; i < count; i += 1) {
          t += (pcts[i] - allocBaseline[i]) * sens[i];
        }
        return Math.max(-1.6, Math.min(1.6, t));
      };
      syncActiveAllocationVariant();

      items.forEach((item, i) => {
        const slider = item.querySelector('[data-alloc-slider]');
        const input = item.querySelector('[data-alloc-pct-input]');

        // Slider pointer interaction.
        // setPointerCapture keeps events routed to the slider even when the
        // pointer moves outside it or moves fast, and prevents the browser
        // from firing pointercancel due to scroll-gesture detection.
        if (slider) {
          const getSliderPct = (clientX) => {
            const rect = slider.getBoundingClientRect();
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            return (x / rect.width) * 100;
          };

          slider.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            blurAllocPctInputIfFocused();
            slider.setPointerCapture(e.pointerId);
            applyAllocChange(i, getSliderPct(e.clientX));
          });

          slider.addEventListener('pointermove', (e) => {
            if (!slider.hasPointerCapture(e.pointerId)) return;
            e.preventDefault();
            applyAllocChange(i, getSliderPct(e.clientX));
          });

          slider.addEventListener('pointerup', (e) => {
            if (slider.hasPointerCapture(e.pointerId)) {
              slider.releasePointerCapture(e.pointerId);
            }
          });

          slider.addEventListener('pointercancel', (e) => {
            if (slider.hasPointerCapture(e.pointerId)) {
              slider.releasePointerCapture(e.pointerId);
            }
          });
        }

        // % or amount input (mode toggled in header)
        if (input) {
          const ALLOC_NAME_SCROLL_TOP_PAD = 20;
          input.addEventListener('focus', () => {
            const nameEl = item.querySelector('.alloc-multi__name');
            //scrollPlanDetailContentTo(nameEl, ALLOC_NAME_SCROLL_TOP_PAD);
          });

          input.addEventListener('keydown', (e) => {
            const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
            if (!allowed.includes(e.key) && !/^\d$/.test(e.key) && !(e.ctrlKey || e.metaKey)) {
              e.preventDefault();
            }
          });

          input.addEventListener('blur', () => {
            if (inputMode === 'amount') {
              const total = getPlanDetailInvestTotal();
              const raw = parseInt(input.value.replace(/[^0-9]/g, ''), 10);
              if (!total || isNaN(raw) || raw < 1) {
                input.value = total > 0 ? formatAllocAmountDisplay((total * pcts[i]) / 100) : '';
                syncPlanDetailContinueState();
                return;
              }
              const newPct = Math.round((raw / total) * 100);
              applyAllocChange(i, newPct);
              return;
            }

            if (input.value.trim() === '') {
              pcts[i] = 0;
              renderAll();
              refreshPlanDetailAllocTweak();
              return;
            }

            const val = parseInt(input.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 99) {
              applyAllocChange(i, val);
            } else {
              input.value = String(Math.round(pcts[i]));
              syncPlanDetailContinueState();
            }
          });

          input.addEventListener('input', () => {
            if (inputMode === 'amount') {
              applyAllocInputLiveFormat(input);
              syncPlanDetailContinueState();
              return;
            }
            const digits = input.value.replace(/[^0-9]/g, '').slice(0, 2);
            if (input.value !== digits) input.value = digits;
            if (input.value.trim() === '') {
              pcts[i] = 0;
              renderAll();
              refreshPlanDetailAllocTweak();
              return;
            }
            const val = parseInt(input.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 99) {
              applyAllocChange(i, val);
            } else {
              syncPlanDetailContinueState();
            }
          });
        }
      });

      const resetAllocBtn = panelEl.querySelector('[data-alloc-reset]');
      if (resetAllocBtn) {
        resetAllocBtn.addEventListener(
          'click',
          () => {
            for (let j = 0; j < count; j += 1) {
              pcts[j] = defaultPcts[j];
            }
            renderAll();
            refreshPlanDetailAllocTweak();
          },
          { signal: panelCtlSignal },
        );
      }

      panelEl._planDetailAllocRefreshAmounts = () => {
        renderAll();
      };

      // Initial render
      renderAll();
      refreshPlanDetailAllocTweak();
      syncAllocInputModeClass();

      // Mode toggle (Amount / %) — inputs show % or Auto-invest × allocation
      const modeToggle = panelEl.querySelector('[data-alloc-mode-toggle]');
      if (modeToggle) {
        const pctIcon = modeToggle.querySelector('[data-pct-icon]');
        // Toggle nodes persist across opens; always start in % mode for a fresh plan view
        inputMode = 'pct';
        modeToggle.querySelectorAll('[data-alloc-mode-btn]').forEach((b) => {
          b.classList.toggle('is-active', b.dataset.allocModeBtn === 'pct');
        });
        if (pctIcon) pctIcon.src = 'assets/icon_percentage_tab_black.svg';

        const setAllocInputMode = (mode) => {
          const next = mode === 'amount' ? 'amount' : 'pct';
          const ae = document.activeElement;
          if (ae?.matches?.('[data-alloc-pct-input]')) ae.blur();
          inputMode = next;
          modeToggle.querySelectorAll('[data-alloc-mode-btn]').forEach((b) => {
            b.classList.toggle('is-active', b.dataset.allocModeBtn === next);
          });
          if (pctIcon) {
            pctIcon.src =
              next === 'pct'
                ? 'assets/icon_percentage_tab_black.svg'
                : 'assets/icon_percentage_tab_gray.svg';
          }
          syncAllocInputModeClass();
          renderAll();
        };
        modeToggle.querySelectorAll('[data-alloc-mode-btn]').forEach((btn) => {
          btn.addEventListener(
            'click',
            () => setAllocInputMode(btn.dataset.allocModeBtn === 'amount' ? 'amount' : 'pct'),
            { signal: panelCtlSignal },
          );
        });
      }
    };

    const initAutoAllocSliders = (panelEl, autoRoot, count) => {
      const autoAbortKey = '_autoAllocPanelControlsAbort';
      if (panelEl[autoAbortKey]) panelEl[autoAbortKey].abort();
      if (!autoRoot || count < 2) {
        panelEl._planDetailAutoAllocTweakFn = null;
        syncActiveAllocationVariant();
        return;
      }

      const panelAc = new AbortController();
      panelEl[autoAbortKey] = panelAc;
      const panelCtlSignal = panelAc.signal;

      const defaultPcts = count === 2 ? [50, 50] : [34, 33, 33];
      const pcts = [...defaultPcts];
      let lockedIdx = null;
      let dragRafId = 0;
      let pendingDrag = null;
      const allocBaseline = [...defaultPcts];

      const items = Array.from(autoRoot.querySelectorAll('.alloc-multi__item'));

      const roundPct = (n) => Math.round((Number(n) || 0) * 10) / 10;

      const redistributeByWeights = (total, idxs) => {
        if (!idxs.length) return;
        const safeTotal = Math.max(0, roundPct(total));
        const currentWeights = idxs.map((idx) => Math.max(0, pcts[idx]));
        let weightSum = currentWeights.reduce((sum, v) => sum + v, 0);
        if (weightSum <= 0) {
          for (let i = 0; i < currentWeights.length; i += 1) currentWeights[i] = 1;
          weightSum = currentWeights.length;
        }
        const rawShares = currentWeights.map((w) => (w / weightSum) * safeTotal);
        let allocated = 0;
        idxs.forEach((idx, localIdx) => {
          if (localIdx === idxs.length - 1) {
            pcts[idx] = roundPct(safeTotal - allocated);
          } else {
            const share = roundPct(rawShares[localIdx]);
            pcts[idx] = share;
            allocated = roundPct(allocated + share);
          }
        });
      };

      const applyAutoAllocChange = (changedIdx, rawPct) => {
        if (lockedIdx === changedIdx) return;
        let nextChanged = roundPct(Math.max(0, Math.min(100, rawPct)));
        if (lockedIdx !== null && lockedIdx !== changedIdx) {
          const maxAllowed = Math.max(0, 100 - pcts[lockedIdx]);
          nextChanged = Math.min(nextChanged, maxAllowed);
        }
        pcts[changedIdx] = nextChanged;

        const fixedIdxs = new Set([changedIdx]);
        if (lockedIdx !== null && lockedIdx !== changedIdx) fixedIdxs.add(lockedIdx);
        const freeIdxs = [];
        for (let i = 0; i < count; i += 1) {
          if (!fixedIdxs.has(i)) freeIdxs.push(i);
        }
        const fixedTotal = [...fixedIdxs].reduce((sum, idx) => sum + pcts[idx], 0);
        const remaining = roundPct(Math.max(0, 100 - fixedTotal));
        redistributeByWeights(remaining, freeIdxs);
        renderAll();
        refreshPlanDetailAllocTweak();
      };

      const scheduleAutoAllocDrag = (changedIdx, rawPct) => {
        pendingDrag = { changedIdx, rawPct };
        if (dragRafId) return;
        dragRafId = requestAnimationFrame(() => {
          dragRafId = 0;
          if (!pendingDrag) return;
          const next = pendingDrag;
          pendingDrag = null;
          applyAutoAllocChange(next.changedIdx, next.rawPct);
        });
      };

      panelCtlSignal.addEventListener('abort', () => {
        if (dragRafId) cancelAnimationFrame(dragRafId);
        dragRafId = 0;
        pendingDrag = null;
      });

      panelEl._planDetailAutoAllocTweakFn = () => {
        const sens = count === 3 ? [0.018, 0.01, -0.007] : [0.014, -0.014];
        let t = 0;
        for (let i = 0; i < count; i += 1) {
          t += (pcts[i] - allocBaseline[i]) * sens[i];
        }
        return Math.max(-1.6, Math.min(1.6, t));
      };
      syncActiveAllocationVariant();

      const renderItem = (i) => {
        const item = items[i];
        if (!item) return;
        const fill = item.querySelector('[data-auto-alloc-fill]');
        const thumb = item.querySelector('[data-auto-alloc-thumb]');
        const input = item.querySelector('[data-auto-alloc-pct-input]');
        const amountSubEl = item.querySelector('[data-auto-alloc-pct-amount-sub]');
        const lockLabelEl = item.querySelector('[data-auto-alloc-lock-label]');
        const lockBtn = item.querySelector('[data-auto-alloc-lock-btn]');
        const lockVisual = item.querySelector('.alloc-multi__auto-lock-btn');
        const lockIcon = item.querySelector('[data-auto-alloc-lock-icon]');
        const p = pcts[i] / 100;
        if (fill) fill.style.width = `${p * 100}%`;
        if (thumb) thumb.style.left = `calc(${p * 100}% - ${p * 24}px)`;
        if (input && document.activeElement !== input) input.value = String(Math.round(pcts[i]));
        if (amountSubEl) {
          const invest = Math.max(
            0,
            parseInt(panelEl.querySelector('[data-plan-detail-amount-input]')?.value?.replace(/[^0-9]/g, '') || '0', 10) || 0,
          );
          const cur = panelEl.querySelector('[data-plan-detail-currency]')?.textContent?.trim() || 'TWD';
          const slice = invest > 0 ? Math.round((invest * pcts[i]) / 100) : 0;
          amountSubEl.textContent = `${slice.toLocaleString('en-US')} ${cur}`;
        }
        const isLocked = lockedIdx === i;
        item.classList.toggle('is-locked', isLocked);
        if (lockLabelEl) {
          lockLabelEl.textContent = isLocked
            ? `Holding at ${Math.round(pcts[i])}%`
            : 'Hold this %';
        }
        if (lockLabelEl) lockLabelEl.classList.toggle('is-locked', isLocked);
        if (lockBtn) {
          lockBtn.setAttribute('aria-pressed', isLocked ? 'true' : 'false');
        }
        if (lockVisual) lockVisual.classList.toggle('is-locked', isLocked);
        if (lockIcon) {
          lockIcon.src = isLocked ? 'assets/icon_lock.svg' : 'assets/icon_unlock.svg';
        }
        if (input) {
          input.disabled = isLocked;
          input.setAttribute('aria-disabled', isLocked ? 'true' : 'false');
        }
      };

      const renderAll = () => {
        items.forEach((_, i) => renderItem(i));
      };

      items.forEach((item, i) => {
        const slider = item.querySelector('[data-auto-alloc-slider]');
        const input = item.querySelector('[data-auto-alloc-pct-input]');
        const lockBtn = item.querySelector('[data-auto-alloc-lock-btn]');

        if (slider) {
          const getSliderPct = (clientX) => {
            const rect = slider.getBoundingClientRect();
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            return (x / rect.width) * 100;
          };
          slider.addEventListener(
            'pointerdown',
            (e) => {
              if (lockedIdx === i) return;
              e.preventDefault();
              const ae = document.activeElement;
              if (ae?.matches?.('[data-auto-alloc-pct-input]') && autoRoot.contains(ae)) ae.blur();
              slider.setPointerCapture(e.pointerId);
              applyAutoAllocChange(i, getSliderPct(e.clientX));
            },
            { signal: panelCtlSignal },
          );
          slider.addEventListener(
            'pointermove',
            (e) => {
              if (!slider.hasPointerCapture(e.pointerId)) return;
              if (lockedIdx === i) return;
              e.preventDefault();
              scheduleAutoAllocDrag(i, getSliderPct(e.clientX));
            },
            { signal: panelCtlSignal },
          );
          slider.addEventListener(
            'pointerup',
            (e) => {
              if (pendingDrag && pendingDrag.changedIdx === i) {
                const next = pendingDrag;
                pendingDrag = null;
                applyAutoAllocChange(next.changedIdx, next.rawPct);
              }
              if (slider.hasPointerCapture(e.pointerId)) slider.releasePointerCapture(e.pointerId);
            },
            { signal: panelCtlSignal },
          );
          slider.addEventListener(
            'pointercancel',
            (e) => {
              if (pendingDrag && pendingDrag.changedIdx === i) {
                const next = pendingDrag;
                pendingDrag = null;
                applyAutoAllocChange(next.changedIdx, next.rawPct);
              }
              if (slider.hasPointerCapture(e.pointerId)) slider.releasePointerCapture(e.pointerId);
            },
            { signal: panelCtlSignal },
          );
        }

        if (input) {
          input.addEventListener(
            'keydown',
            (e) => {
              const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
              if (!allowed.includes(e.key) && !/^\d$/.test(e.key) && !(e.ctrlKey || e.metaKey)) {
                e.preventDefault();
              }
            },
            { signal: panelCtlSignal },
          );
          input.addEventListener(
            'input',
            () => {
              const digits = input.value.replace(/[^0-9]/g, '').slice(0, 2);
              if (input.value !== digits) input.value = digits;
              if (digits === '') return;
              const val = parseInt(digits, 10);
              if (!isNaN(val)) applyAutoAllocChange(i, val);
            },
            { signal: panelCtlSignal },
          );
          input.addEventListener(
            'blur',
            () => {
              if (input.value.trim() === '') {
                input.value = String(pcts[i]);
                return;
              }
              const val = parseInt(input.value.replace(/[^0-9]/g, ''), 10);
              if (isNaN(val)) input.value = String(pcts[i]);
              else applyAutoAllocChange(i, val);
            },
            { signal: panelCtlSignal },
          );
        }

        if (lockBtn) {
          lockBtn.addEventListener(
            'click',
            () => {
              lockedIdx = lockedIdx === i ? null : i;
              if (lockedIdx === i) {
                const ae = document.activeElement;
                if (ae === input) ae.blur();
              }
              renderAll();
            },
            { signal: panelCtlSignal },
          );
        }
      });

      panelEl._planDetailAutoAllocRefreshAmounts = () => {
        renderAll();
      };
      renderAll();
      refreshPlanDetailAllocTweak();
    };

    const escPlanDetailIconAttr = (v) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');

    /**
     * Single hero icon or Figma pyramid stack (2 coins + placeholder / 3 coins).
     * @param {{ singleProductClass?: string, singleHeaderClass?: string }} [iconOpts] — override img classes for single-asset mode (e.g. breakdown panel)
     */
    const renderPlanDetailProductIcons = (productWrap, headerWrap, fallbackIconSrc, coinItems, iconOpts = {}) => {
      if (!productWrap || !headerWrap) return;

      const singleProductClass = iconOpts.singleProductClass || 'plan-detail-panel__product-icon';
      const singleHeaderClass = iconOpts.singleHeaderClass || 'plan-detail-panel__header-icon';

      const buildStackMarkup = (variant) => {
        const items = (coinItems || []).slice(0, 3).filter((it) => it && it.icon);
        if (items.length < 2) return null;
        const twoOnly = items.length === 2;
        const mod = twoOnly ? ' plan-detail-panel__icon-stack--two' : '';
        const baseClass =
          variant === 'header'
            ? `plan-detail-panel__icon-stack plan-detail-panel__icon-stack--header${mod}`
            : `plan-detail-panel__icon-stack${mod}`;
        const [a, b, c] = [items[0], items[1], items[2]];
        const br = c?.icon
          ? `<img src="${escPlanDetailIconAttr(c.icon)}" alt="" />`
          : '<span class="plan-detail-panel__icon-stack-placeholder" aria-hidden="true"></span>';
        return `<div class="${baseClass}" aria-hidden="true"><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--top"><img src="${escPlanDetailIconAttr(a.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--bl"><img src="${escPlanDetailIconAttr(b.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--br">${br}</div></div>`;
      };

      const stackProduct = buildStackMarkup('product');
      if (stackProduct) {
        productWrap.innerHTML = stackProduct;
        headerWrap.innerHTML = buildStackMarkup('header');
        return;
      }

      const singleSrc =
        coinItems && coinItems.length === 1 && coinItems[0]?.icon
          ? coinItems[0].icon
          : fallbackIconSrc;
      const s = escPlanDetailIconAttr(singleSrc);
      if (productWrap === headerWrap) {
        productWrap.innerHTML = `<img class="${singleProductClass}" src="${s}" alt="" />`;
      } else {
        productWrap.innerHTML = `<img class="${singleProductClass}" src="${s}" alt="" />`;
        headerWrap.innerHTML = `<img class="${singleHeaderClass}" src="${s}" alt="" />`;
      }
    };

    const getCurrentPlanDisplayAssets = (fallbackIconSrc) => {
      const ctx = panelOpenContext || { source: 'plan' };
      if (detailAllocOverride?.items?.length) return detailAllocOverride.items.slice(0, 3);
      if (ctx.source === 'curated' && ctx.curatedKey) return (planAllocation[String(ctx.curatedKey).toLowerCase()] || []).slice(0, 3);
      if (ctx.source === 'spotlight' && ctx.spotlightKey) {
        const key = String(ctx.spotlightKey || '').toLowerCase();
        const coin = pickableCoins.find((c) => c.key === key);
        return coin ? [{ name: coin.name, ticker: coin.ticker, icon: coin.icon }] : [];
      }
      const carousel = document.querySelector('[data-plan-carousel]');
      const activePlan = String(carousel?.getAttribute('data-active-plan') || 'bitcoin').toLowerCase();
      const fromPlan = planAllocation[activePlan];
      if (fromPlan?.length) return fromPlan.slice(0, 3);
      const ticker = String(planTicker[activePlan] || '').split(/[·,]/)[0].trim() || 'BTC';
      return [{ name: ticker, ticker, icon: fallbackIconSrc || 'assets/icon_currency_btc.svg' }];
    };

    let planBreakdownApi = { sync: () => {}, syncFromPlanWidget: () => {}, close: () => {} };
    let planOverviewApi = { open: () => {}, close: () => {}, sync: () => {} };
    let planBufferApi = { open: () => {}, close: () => {} };
    let planEndConditionApi = { open: () => {}, close: () => {} };
    let planSuccessApi = { close: () => {}, forceClose: () => {} };
    let planBufferOverviewState = {
      mode: 'flexible',
      rawAmount: 0,
      reservedAmount: 0,
      autoRefillEnabled: true,
      currency: '',
      perBuy: 0,
    };

    const populatePanel = (opts = {}) => {
      const ctx = panelOpenContext;
      const shouldPreserveCurrentAmount = !!opts.preserveAmount;
      const cur = currencyState.plan;
      const carousel = document.querySelector('[data-plan-carousel]');
      let planKey = (carousel?.getAttribute('data-active-plan') || 'bitcoin').toLowerCase();
      let title = 'Bitcoin';
      let iconSrc = 'assets/icon_currency_btc.svg';
      let ticker = 'BTC';

      const amountInput = panel.querySelector('[data-plan-detail-amount-input]');

      if (ctx.source === 'newplan') {
        title = 'Your plan';
        const now = new Date();
        ticker = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        iconSrc = 'assets/icon_noallocation.svg';
        planKey = 'newplan';
        if (amountInput && !shouldPreserveCurrentAmount) amountInput.value = '';
      } else if (ctx.source === 'curated' && ctx.curatedKey && ctx.card) {
        planKey = ctx.curatedKey.toLowerCase();
        const card = ctx.card;
        title = card.querySelector('.curated-portfolios__name')?.textContent?.trim() || 'Portfolio';
        ticker = card.querySelector('.curated-portfolios__tickers')?.textContent?.trim() || planTicker[planKey] || '';
        iconSrc = card.querySelector('.curated-portfolios__icon')?.getAttribute('src') || iconSrc;
        if (amountInput && !shouldPreserveCurrentAmount) amountInput.value = '';
      } else if (ctx.source === 'spotlight' && ctx.spotlightKey && ctx.card) {
        const card = ctx.card;
        title = card.querySelector('.crypto-pill__name')?.textContent?.trim() || 'Crypto';
        ticker = card.querySelector('.crypto-pill__ticker')?.textContent?.trim() || String(ctx.spotlightKey).toUpperCase();
        iconSrc = card.querySelector('.crypto-pill__icon')?.getAttribute('src') || iconSrc;
        planKey = String(ctx.spotlightKey).toLowerCase();
        if (amountInput && !shouldPreserveCurrentAmount) amountInput.value = '';
      } else {
        const activeSlide = carousel?.querySelector('[data-plan-carousel-item].swiper-slide-active')
          || carousel?.querySelector('[data-plan-carousel-item]');
        planKey = (carousel?.getAttribute('data-active-plan') || 'bitcoin').toLowerCase();
        title = activeSlide?.getAttribute('data-title') || 'Bitcoin';
        iconSrc = activeSlide?.querySelector('img')?.getAttribute('src') || 'assets/icon_currency_btc.svg';
        ticker = planTicker[planKey] || 'BTC';
        const amountRaw = document.querySelector('[data-plan-amount]')?.textContent?.replace(/,/g, '') || '10000';
        if (amountInput && !shouldPreserveCurrentAmount) {
          const amountNum = parseInt(amountRaw, 10);
          amountInput.value = !isNaN(amountNum) ? amountNum.toLocaleString('en-US') : amountRaw;
        }
      }

      // If user confirms a custom manual coin mix from allocation picker, present as "Your plan".
      if (detailAllocOverride?.kind === 'coins' && detailAllocOverride.items?.length) {
        const selectedTickers = detailAllocOverride.items
          .map((item) => String(item?.ticker || '').trim())
          .filter(Boolean);
        title = 'Your plan';
        ticker = selectedTickers.join(', ');
      }
      if (detailAllocOverride?.kind === 'curated' && detailAllocOverride.items?.length) {
        const curatedMeta = pickerCurated.find((p) => p.key === detailAllocOverride.key);
        const curatedTickers = detailAllocOverride.items
          .map((item) => String(item?.ticker || '').trim())
          .filter(Boolean);
        title = curatedMeta?.title || title;
        ticker = curatedTickers.join(', ');
        if (curatedMeta?.icon) iconSrc = curatedMeta.icon;
      }

      const isCustomNoAssetsYet =
        (ctx.source === 'newplan' && !detailAllocOverride?.items?.length)
        || (detailAllocOverride?.kind === 'coins' && !detailAllocOverride.items?.length);
      const effectiveTitle =
        customPlanTitle.trim()
          ? customPlanTitle.trim()
          : title;

      // Product hero
      panel.querySelector('[data-plan-detail-name]').textContent = effectiveTitle;
      {
        const t = panel.querySelector('[data-plan-detail-ticker]');
        if (t) {
          t.textContent = ticker;
          t.hidden = !!isCustomNoAssetsYet;
        }
      }
      const productIconWrap = panel.querySelector('[data-plan-detail-icon-wrap]');
      const headerIconWrap = panel.querySelector('[data-plan-detail-header-icon-wrap]');
      const coinPickItems =
        detailAllocOverride?.kind === 'coins' && Array.isArray(detailAllocOverride.items)
          ? detailAllocOverride.items
          : null;
      renderPlanDetailProductIcons(productIconWrap, headerIconWrap, iconSrc, coinPickItems);
      planBreakdownApi.sync({ iconSrc });

      // Collapsed header state
      panel.querySelector('[data-plan-detail-header-name]').textContent = effectiveTitle;
      {
        const ht = panel.querySelector('[data-plan-detail-header-ticker]');
        if (ht) {
          ht.textContent = ticker;
          ht.hidden = !!isCustomNoAssetsYet;
        }
      }

      if (nameEditIcon) nameEditIcon.hidden = false;
      if (nameEditBtn) {
        nameEditBtn.disabled = false;
        nameEditBtn.style.cursor = 'pointer';
      }

      const curatedProductKeyForDesc = (() => {
        // Manual/new plans should never show curated subtitles.
        if (ctx.source === 'newplan' || detailAllocOverride?.kind === 'coins' || title === 'Your plan') {
          return null;
        }
        if (detailAllocOverride?.kind === 'curated' && detailAllocOverride.key) {
          return String(detailAllocOverride.key).toLowerCase();
        }
        if (ctx.source === 'curated' && ctx.curatedKey) {
          return String(ctx.curatedKey).toLowerCase();
        }
        const k = String(planKey || '').toLowerCase();
        return pickerCurated.some((p) => p.key === k) ? k : null;
      })();
      const productDescEl = panel.querySelector('[data-plan-detail-product-desc]');
      if (productDescEl) {
        const isUserEditedTitle = !!customPlanTitle.trim();
        const meta = curatedProductKeyForDesc
          ? pickerCurated.find((p) => p.key === curatedProductKeyForDesc)
          : null;
        if (!isUserEditedTitle && meta?.desc) {
          productDescEl.textContent = meta.desc;
          productDescEl.hidden = false;
        } else {
          productDescEl.textContent = '';
          productDescEl.hidden = true;
        }
      }

      panel.querySelector('[data-plan-detail-currency]').textContent = cur;
      panel.querySelector('[data-plan-detail-amount-icon]').src =
        cur === 'USDT' ? 'assets/icon_currency_usdt.svg' : 'assets/icon_currency_TWD.svg';

      updateCoverageUI();

      // Repeats schedule
      const freqLabels = {
        daily: 'Daily',
        weekly: 'Weekly · Monday',
        monthly: 'Monthly · 15th',
      };
      const scheduleEl = panel.querySelector('[data-plan-detail-schedule]');
      if (scheduleEl) {
        if (ctx.source === 'curated' || ctx.source === 'spotlight' || ctx.source === 'newplan') {
          scheduleEl.textContent = freqLabels.monthly;
        } else {
          const freqItem = document.querySelector('[data-plan-freq-item].is-active');
          const freqKey = (freqItem?.getAttribute('data-plan-freq-item') || 'monthly').toLowerCase();
          scheduleEl.textContent = freqLabels[freqKey] || freqLabels.monthly;
        }
      }

      // Return footer
      if (ctx.source === 'curated' || ctx.source === 'spotlight' || ctx.source === 'newplan') {
        const titleEl = panel.querySelector('[data-plan-detail-return-title]');
        const currEl = panel.querySelector('[data-plan-detail-return-currency]');
        if (titleEl) titleEl.textContent = document.querySelector('[data-plan-return-title]')?.textContent || titleEl.textContent;
        if (currEl) currEl.textContent = document.querySelector('[data-plan-return-currency]')?.textContent || currEl.textContent;
      } else {
        syncFooterFromMainWidget();
      }

      // Allocation list
      const allocList = panel.querySelector('[data-plan-detail-allocation]');
      const allocCountEl = panel.querySelector('[data-plan-detail-alloc-count]');
      const allocSection = getManualAllocSection();
      const allocSubtitleEl = panel.querySelector('[data-plan-detail-alloc-subtitle]');
      const allocAutoSection = panel.querySelector('[data-plan-detail-allocation-auto-section]');
      const allocAutoList = panel.querySelector('[data-plan-detail-allocation-auto]');
      const allocAutoCountEl = panel.querySelector('[data-plan-detail-alloc-auto-count]');
      const allocAutoRangeEl = panel.querySelector('[data-plan-detail-alloc-auto-range]');
      const allocAutoHistoricPctEl = panel.querySelector('[data-plan-detail-alloc-auto-historic-pct]');

      if (ctx.source === 'newplan' && !detailAllocOverride?.items?.length) {
        // Empty state: no assets selected yet
        if (allocCountEl) allocCountEl.textContent = '0';
        allocList.innerHTML = '';
        const emptyHeaderHistoric = panel.querySelector('[data-plan-detail-alloc-header-historic]');
        const emptyHistoricTone = panel.querySelector('[data-plan-detail-historic-performance-tone]');
        const emptyBelowLabel = emptyHeaderHistoric?.querySelector('.plan-detail-panel__historic-performance-label--below');
        if (emptyHeaderHistoric && emptyHistoricTone && !emptyHeaderHistoric.contains(emptyHistoricTone)) {
          if (emptyBelowLabel) emptyHeaderHistoric.insertBefore(emptyHistoricTone, emptyBelowLabel.nextSibling);
          else emptyHeaderHistoric.appendChild(emptyHistoricTone);
        } else if (
          emptyHeaderHistoric &&
          emptyHistoricTone &&
          emptyBelowLabel &&
          emptyHistoricTone.previousElementSibling !== emptyBelowLabel
        ) {
          emptyHeaderHistoric.insertBefore(emptyHistoricTone, emptyBelowLabel.nextSibling);
        }
        if (allocSection) {
          allocSection.classList.remove('is-single-asset');
          allocSection.classList.remove('is-multi-asset');
          allocSection.classList.add('is-empty');
        }
        const allocModeToggleNewplan = panel.querySelector('[data-alloc-mode-toggle]');
        if (allocModeToggleNewplan) allocModeToggleNewplan.classList.add('is-hidden');
        panel.querySelectorAll('.plan-detail-panel__add-assets').forEach((btn) => {
          btn.textContent = 'Add assets';
        });
        const resetNewplan = panel.querySelector('[data-alloc-reset]');
        if (resetNewplan) resetNewplan.hidden = true;
        if (allocSubtitleEl) allocSubtitleEl.hidden = true;
        latestAllocItemCount = 0;
        syncActiveAllocationVariant();
        if (allocAutoSection) allocAutoSection.hidden = true;
        if (allocAutoList) allocAutoList.innerHTML = '';
        updateDetailReturn();
        syncPlanDetailContinueState();
        return;
      }

      if (allocSection) allocSection.classList.remove('is-empty');

      const allocItems =
        (detailAllocOverride?.items?.length
          ? detailAllocOverride.items
          : null)
        || ((ctx.source === 'spotlight' && ctx.card)
          ? [{
              name: ctx.card.querySelector('.crypto-pill__name')?.textContent?.trim() || 'Crypto',
              ticker: ctx.card.querySelector('.crypto-pill__ticker')?.textContent?.trim() || ticker,
              icon: ctx.card.querySelector('.crypto-pill__icon')?.getAttribute('src') || iconSrc,
            }]
          : (planAllocation[planKey] || planAllocation.bitcoin));

      if (allocCountEl) allocCountEl.textContent = String(allocItems.length);
      latestAllocItemCount = allocItems.length;

      const addLabel = allocItems.length > 1 ? 'Add / remove assets' : 'Add assets';
      panel.querySelectorAll('.plan-detail-panel__add-assets').forEach((btn) => {
        btn.textContent = addLabel;
      });
      const allocResetBtn = panel.querySelector('[data-alloc-reset]');
      if (allocResetBtn) {
        allocResetBtn.textContent = 'Set equal';
        allocResetBtn.hidden = allocItems.length < 2;
      }

      // Multi-asset allocation header uses "Combined #Y performance" (Figma); single-asset uses "Past #Y performance".
      // updateRangeUI() handles live range changes; this ensures the initial open has the right label too.
      const planRange = rangeState?.plan || '5Y';
      const belowHistLabel = panel.querySelector(
        '.plan-detail-panel__alloc-header-historic-inline .plan-detail-panel__historic-performance-label--below',
      );
      if (belowHistLabel) {
        belowHistLabel.textContent = allocItems.length >= 2
          ? `Past ${planRange}`
          : `Past ${planRange}`;
      }
      if (allocAutoRangeEl) allocAutoRangeEl.textContent = `Past ${planRange}`;
      if (allocAutoHistoricPctEl) {
        const histPct = panel.querySelector('[data-plan-detail-return-historic-pct]')?.textContent?.trim();
        allocAutoHistoricPctEl.textContent = histPct || allocAutoHistoricPctEl.textContent;
      }

      // Show mode toggle + allocation subtitle for 2+ assets only
      const allocModeToggle = panel.querySelector('[data-alloc-mode-toggle]');
      if (allocModeToggle) allocModeToggle.classList.toggle('is-hidden', allocItems.length < 2);
      if (allocSubtitleEl) allocSubtitleEl.hidden = allocItems.length < 2;

      const historicRow = panel.querySelector('.plan-detail-panel__historic-performance-row');
      const headerHistoric = panel.querySelector('[data-plan-detail-alloc-header-historic]');
      const historicBelowInHeader = headerHistoric?.querySelector('.plan-detail-panel__historic-performance-label--below');
      let historicTone = allocSection?.querySelector('[data-plan-detail-historic-performance-tone]');
      const historicAllocSubtitle = historicRow?.querySelector('[data-plan-detail-alloc-subtitle]');

      const placeHistoricToneInAllocHeaderInline = () => {
        const tone = allocSection?.querySelector('[data-plan-detail-historic-performance-tone]');
        if (!headerHistoric || !tone) return;
        if (historicBelowInHeader) {
          if (tone.parentElement === headerHistoric && tone.previousElementSibling === historicBelowInHeader) return;
          headerHistoric.insertBefore(tone, historicBelowInHeader.nextSibling);
        } else {
          if (tone.parentElement === headerHistoric) return;
          headerHistoric.appendChild(tone);
        }
      };

      // Historic % may sit in a single alloc-item; pull it out before list innerHTML replaces nodes.
      if (historicTone && allocList.contains(historicTone)) {
        placeHistoricToneInAllocHeaderInline();
      }

      if (allocItems.length >= 2) {
        // Multi-asset layout with sliders (per-row %; user balances total to 100% / amounts to per-buy total)
        allocList.innerHTML = `<div class="alloc-multi">${
          allocItems.map((item, i) => `
            <div class="alloc-multi__item" data-alloc-idx="${i}">
              <div class="alloc-multi__row">
                <img class="alloc-multi__icon" src="${item.icon}" alt="" />
                <div class="alloc-multi__info">
                  <span class="alloc-multi__name">${item.name}</span>
                  <span class="alloc-multi__ticker">${item.ticker}</span>
                </div>
                <div class="alloc-multi__pct-col">
                  <div class="alloc-multi__pct-wrap">
                    <div class="alloc-multi__pct-inner">
                      <input class="alloc-multi__pct-input" type="text" inputmode="numeric" data-alloc-pct-input />
                      <span class="alloc-multi__pct-symbol">%</span>
                    </div>
                  </div>
                  <p class="alloc-multi__pct-amount-sub" data-alloc-pct-amount-sub aria-hidden="true"></p>
                </div>
              </div>
              <div class="alloc-multi__slider-row">
                <div class="alloc-multi__slider" data-alloc-slider>
                  <div class="alloc-multi__slider-bg"></div>
                  <div class="alloc-multi__slider-fill" data-alloc-fill></div>
                  <div class="alloc-multi__slider-thumb" data-alloc-thumb></div>
                </div>
              </div>
            </div>`).join('')
        }</div>`;

        initAllocSliders(panel, allocItems.length);
      } else {
        // Single-asset layout (simple, no slider)
        allocList.innerHTML = allocItems.map((item) => `
          <div class="plan-detail-panel__alloc-item">
            <img class="plan-detail-panel__alloc-icon" src="${item.icon}" alt="" />
            <div class="plan-detail-panel__alloc-info">
              <span class="plan-detail-panel__alloc-name">${item.name}</span>
              <span class="plan-detail-panel__alloc-ticker">${item.ticker}</span>
            </div>
          </div>`).join('');
        const resetSingle = panel.querySelector('[data-alloc-reset]');
        if (resetSingle) resetSingle.hidden = true;
      }

      if (allocAutoSection && allocAutoList) {
        allocAutoSection.hidden = allocItems.length < 2;
        if (allocAutoCountEl) allocAutoCountEl.textContent = String(allocItems.length);
        if (allocItems.length >= 2) {
          allocAutoList.innerHTML = `<div class="alloc-multi alloc-multi--auto">${
            allocItems.map((item, i) => `
              <div class="alloc-multi__item" data-auto-alloc-idx="${i}">
                <div class="alloc-multi__row">
                  <img class="alloc-multi__icon" src="${item.icon}" alt="" />
                  <div class="alloc-multi__info">
                    <span class="alloc-multi__name">${item.name}</span>
                    <span class="alloc-multi__ticker">${item.ticker}</span>
                  </div>
                  <div class="alloc-multi__pct-col">
                    <div class="alloc-multi__pct-wrap">
                      <div class="alloc-multi__pct-inner">
                        <input class="alloc-multi__pct-input" type="text" inputmode="numeric" maxlength="2" data-alloc-pct-input data-auto-alloc-pct-input />
                        <span class="alloc-multi__pct-symbol">%</span>
                      </div>
                    </div>
                    <p class="alloc-multi__pct-amount-sub" data-auto-alloc-pct-amount-sub aria-hidden="false"></p>
                  </div>
                </div>
                <div class="alloc-multi__slider-row">
                  <div class="alloc-multi__slider" data-auto-alloc-slider>
                    <div class="alloc-multi__slider-bg"></div>
                    <div class="alloc-multi__slider-fill" data-auto-alloc-fill></div>
                    <div class="alloc-multi__slider-thumb" data-auto-alloc-thumb></div>
                  </div>
                </div>
                <div class="alloc-multi__auto-lock-row"${allocItems.length === 2 ? ' hidden' : ''}>
                  <button class="alloc-multi__auto-lock-toggle" type="button" data-auto-alloc-lock-btn aria-pressed="false" aria-label="Toggle allocation lock">
                    <span class="alloc-multi__auto-lock-label" data-auto-alloc-lock-label>Lock this allocation</span>
                    <span class="alloc-multi__auto-lock-btn" aria-hidden="true">
                      <img class="alloc-multi__auto-lock-icon" src="assets/icon_unlock.svg" width="16" height="16" alt="" data-auto-alloc-lock-icon />
                    </span>
                  </button>
                </div>
              </div>`).join('')
          }</div>`;
          initAutoAllocSliders(panel, allocAutoList, allocItems.length);
        } else {
          allocAutoList.innerHTML = '';
          if (panel._planDetailAutoAllocRefreshAmounts) panel._planDetailAutoAllocRefreshAmounts = null;
        }
      }
      syncActiveAllocationVariant();

      // Keep modifier classes in sync whenever we have assets; do not depend on historic DOM (avoids stale
      // is-multi-asset + single-row list, which hid single-asset historic UI).
      if (allocSection) {
        if (allocItems.length === 1) {
          allocSection.classList.add('is-single-asset');
          allocSection.classList.remove('is-multi-asset');
        } else if (allocItems.length >= 2) {
          allocSection.classList.remove('is-single-asset');
          allocSection.classList.add('is-multi-asset');
        }
      }

      historicTone = allocSection?.querySelector('[data-plan-detail-historic-performance-tone]');
      if (allocSection && historicRow && historicTone) {
        if (allocItems.length === 1) {
          const firstItem = allocList.querySelector('.plan-detail-panel__alloc-item');
          if (firstItem && !firstItem.contains(historicTone)) {
            firstItem.appendChild(historicTone);
          }
        } else {
          placeHistoricToneInAllocHeaderInline();
        }
      }

      if (ctx.source === 'curated' || ctx.source === 'spotlight') {
        updateDetailReturn();
      } else if (ctx.source === 'plan') {
        // Footer % was synced from main widget earlier; capture base + alloc slider tweak
        snapshotFooterAllocBases();
        applyFooterAllocSliderTweak();
      }
      syncPlanDetailContinueState();
      scheduleSheetApi.syncBuyNowFromPlanDetail?.();
      if (panel.querySelector('[data-plan-overview-panel]')?.classList.contains('is-open')) {
        planOverviewApi.sync();
      }
    };

    const commitCustomPlanTitle = () => {
      if (!nameInput) return;
      const next = String(nameInput.value || '').trim().slice(0, 40);
      customPlanTitle = next;
      nameInput.hidden = true;
      if (nameSpan) nameSpan.hidden = false;
      if (nameEditIcon) nameEditIcon.hidden = false;
      populatePanel({ preserveAmount: true });
    };

    const enterTitleEditMode = () => {
      if (!nameInput || !nameEditBtn) return;
      const current = panel.querySelector('[data-plan-detail-name]')?.textContent || 'Your plan';
      nameInput.value = String(current).trim();
      if (nameSpan) nameSpan.hidden = true;
      // Keep the edit icon + product icon visible; only swap title text → input.
      nameInput.hidden = false;
      requestAnimationFrame(() => {
        nameInput.focus();
        nameInput.select();
      });
    };

    nameEditBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // If already editing, ignore (prevents space/enter bubbling reopening edit mode).
      if (nameInput && !nameInput.hidden) return;
      enterTitleEditMode();
    });
    nameInput?.addEventListener('keydown', (e) => {
      // Prevent bubbling to the wrapper button (spacebar can "activate" the button).
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commitCustomPlanTitle();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (nameInput) nameInput.hidden = true;
        if (nameSpan) nameSpan.hidden = false;
        if (nameEditIcon) nameEditIcon.hidden = false;
      }
    });
    nameInput?.addEventListener('click', (e) => e.stopPropagation());
    nameInput?.addEventListener('blur', () => commitCustomPlanTitle());

    // ── Scroll-driven collapse behaviour ──────────────────────────────────────
    const resetScrollState = () => {
      if (!scroller || !productArea || !header || !pageTitle) return;
      scroller.scrollTop = 0;
      productArea.style.opacity = '';
      productArea.style.transform = '';
      pageTitle.style.opacity = '';
      header.classList.remove('is-collapsed');
    };

    let rafPending = false;
    const onScroll = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        if (!scroller || !productArea || !header || !pageTitle) return;

        const scrollTop = scroller.scrollTop;
        const productH = (productArea.offsetHeight - 400);

        // Fade product content and page title together (0→1 over the product height)
        const fadeProgress = Math.min(1, Math.max(0, scrollTop / productH));
        productArea.style.opacity = String(1 - fadeProgress);
        pageTitle.style.opacity = String(1 - fadeProgress);

        // Parallax: counteract 50% of the scroll → product moves up at 0.5× speed
        productArea.style.transform = `translateY(${scrollTop * 0.5}px)`;

        // Collapse header once content has fully covered the product
        header.classList.toggle('is-collapsed', scrollTop >= productH);
      });
    };

    if (scroller) scroller.addEventListener('scroll', onScroll, { passive: true });

    // ── Allocation picker panel (right-slide child screen) ────────────────────
    const allocPickerPanel = document.querySelector('[data-alloc-picker-panel]');
    const initPlanAllocPicker = () => {
      if (!allocPickerPanel) return { open: () => {}, close: () => {} };
      const tabBtns = Array.from(allocPickerPanel.querySelectorAll('[data-alloc-picker-tab]'));
      const viewCoins = allocPickerPanel.querySelector('[data-alloc-picker-view="coins"]');
      const viewCurated = allocPickerPanel.querySelector('[data-alloc-picker-view="curated"]');
      const coinsListEl = allocPickerPanel.querySelector('[data-alloc-picker-coins-list]');
      const curatedListEl = allocPickerPanel.querySelector('[data-alloc-picker-curated-list]');
      const chipsEl = allocPickerPanel.querySelector('[data-alloc-picker-chips]');
      const footerEl = allocPickerPanel.querySelector('[data-alloc-picker-footer]');
      const continueBtn = allocPickerPanel.querySelector('[data-alloc-picker-continue]');
      const selectedHeadingEl = allocPickerPanel.querySelector('[data-alloc-picker-selected-heading]');
      const searchInput = allocPickerPanel.querySelector('[data-alloc-picker-search]');
      const searchClearBtn = allocPickerPanel.querySelector('[data-alloc-picker-search-clear]');
      const searchWrap = allocPickerPanel.querySelector('.alloc-picker-panel__search-wrap');
      let activeTab = 'coins';
      let selectedCoinKeys = [];

      const coinByKey = new Map(pickableCoins.map((c) => [c.key, c]));

      const syncTabs = () => {
        tabBtns.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.allocPickerTab === activeTab));
        if (viewCoins) viewCoins.hidden = activeTab !== 'coins';
        if (viewCurated) viewCurated.hidden = activeTab !== 'curated';
        if (footerEl) footerEl.hidden = activeTab !== 'coins';
      };

      const syncCoinListMaxSelectedClass = () => {
        if (!coinsListEl) return;
        coinsListEl.classList.toggle('alloc-picker-panel__coins--max-selected', selectedCoinKeys.length >= 3);
      };

      const syncCoinRowSelectionOnly = () => {
        if (!coinsListEl) return;
        const onSrc = 'assets/icon_checkbox_on.svg';
        const offSrc = 'assets/icon_checkbox_off.svg';
        coinsListEl.querySelectorAll('[data-alloc-picker-coin]').forEach((row) => {
          const key = row.getAttribute('data-alloc-picker-coin');
          if (!key) return;
          const isSelected = selectedCoinKeys.includes(key);
          row.classList.toggle('is-selected', isSelected);
          const check = row.querySelector('.alloc-picker-panel__coin-check');
          if (check) {
            const next = isSelected ? onSrc : offSrc;
            if (check.getAttribute('src') !== next) check.setAttribute('src', next);
          }
        });
        syncCoinListMaxSelectedClass();
      };

      const renderCoins = (opts = { full: true }) => {
        if (!coinsListEl) return;
        if (!opts.full) {
          syncCoinRowSelectionOnly();
          return;
        }
        const q = String(searchInput?.value || '').trim().toLowerCase();
        const spotRange = rangeState.spotlight;
        const visible = pickableCoins.filter((c) => !q || c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q));
        coinsListEl.innerHTML = visible.map((c) => {
          const isSelected = selectedCoinKeys.includes(c.key);
          const ret = spotlightReturns[c.key]?.[spotRange] || c.ret;
          return `
            <button class="alloc-picker-panel__coin-row ${isSelected ? 'is-selected' : ''}" type="button" data-alloc-picker-coin="${c.key}">
              <img class="alloc-picker-panel__coin-icon" src="${c.icon}" alt="" />
              <div class="alloc-picker-panel__coin-main">
                <span class="alloc-picker-panel__coin-ticker">${c.ticker}</span>
                <span class="alloc-picker-panel__coin-name">${c.name}</span>
              </div>
              <span class="alloc-picker-panel__coin-pct-wrap">
                <img class="alloc-picker-panel__coin-pct-arrow" src="assets/icon_northeast_arrow.svg" alt="" />
                <span class="alloc-picker-panel__coin-pct">${ret}</span>
              </span>
              <img
                class="alloc-picker-panel__coin-check"
                src="${isSelected ? 'assets/icon_checkbox_on.svg' : 'assets/icon_checkbox_off.svg'}"
                width="20"
                height="20"
                alt=""
                aria-hidden="true"
              />
            </button>
          `;
        }).join('');
        syncCoinListMaxSelectedClass();
      };

      const createAllocPickerChip = (c) => {
        const wrap = document.createElement('div');
        wrap.className = 'alloc-picker-panel__chip';
        wrap.setAttribute('data-alloc-picker-chip-key', c.key);
        const icon = document.createElement('img');
        icon.className = 'alloc-picker-panel__chip-currency';
        icon.src = c.icon;
        icon.alt = '';
        const label = document.createElement('span');
        label.className = 'alloc-picker-panel__chip-label';
        label.textContent = c.ticker;
        const dismiss = document.createElement('button');
        dismiss.className = 'alloc-picker-panel__chip-dismiss';
        dismiss.type = 'button';
        dismiss.setAttribute('data-alloc-picker-chip-remove', c.key);
        dismiss.setAttribute('aria-label', `Remove ${c.ticker}`);
        const closeImg = document.createElement('img');
        closeImg.className = 'alloc-picker-panel__chip-close';
        closeImg.src = 'assets/icon_close_gray.svg';
        closeImg.width = 12;
        closeImg.height = 12;
        closeImg.alt = '';
        closeImg.setAttribute('aria-hidden', 'true');
        dismiss.appendChild(closeImg);
        wrap.append(icon, label, dismiss);
        return wrap;
      };

      const renderChips = (opts = { full: false }) => {
        if (!chipsEl || !continueBtn) return;
        const selected = selectedCoinKeys.map((k) => coinByKey.get(k)).filter(Boolean);
        const n = selected.length;
        if (selectedHeadingEl) {
          const headingByCount = ['No coins selected', '1 coin selected', '2 coins selected', '3 coins selected'];
          selectedHeadingEl.textContent = headingByCount[n] ?? headingByCount[0];
        }
        continueBtn.textContent = 'Continue';
        continueBtn.disabled = n < 1;

        if (opts.full) {
          chipsEl.replaceChildren(...selected.map((c) => createAllocPickerChip(c)));
          return;
        }

        const wantKeys = new Set(selectedCoinKeys);
        chipsEl.querySelectorAll('[data-alloc-picker-chip-key]').forEach((chip) => {
          const k = chip.getAttribute('data-alloc-picker-chip-key');
          if (!wantKeys.has(k)) chip.remove();
        });

        selected.forEach((c) => {
          let chip = chipsEl.querySelector(`[data-alloc-picker-chip-key="${c.key}"]`);
          if (!chip) chip = createAllocPickerChip(c);
          chipsEl.appendChild(chip);
        });
      };

      const renderCurated = () => {
        if (!curatedListEl) return;
        const curRange = rangeState.curated;
        curatedListEl.innerHTML = pickerCurated.map((p) => {
          const ret = curatedReturns[p.key]?.[curRange] || '';
          return `
            <button class="curated-portfolios__card" type="button" data-alloc-picker-curated="${p.key}">
              <div class="curated-portfolios__card-main">
                <div class="curated-portfolios__icon-wrap">
                  <img src="${p.icon}" alt="" class="curated-portfolios__icon" />
                </div>
                <div class="curated-portfolios__info">
                  <span class="curated-portfolios__name">${p.title}</span>
                  <span class="curated-portfolios__tickers">${p.tickers}</span>
                </div>
                <div class="curated-portfolios__return">
                  <img src="assets/icon_northeast_arrow.svg" alt="" class="curated-portfolios__return-arrow" />
                  <span class="curated-portfolios__return-pct">${ret}</span>
                </div>
              </div>
              <p class="curated-portfolios__desc">${p.desc}</p>
            </button>
          `;
        }).join('');
      };

      const syncSearchClear = () => {
        const has = !!(searchInput && String(searchInput.value || '').trim());
        if (searchClearBtn) searchClearBtn.hidden = !has;
        if (searchWrap) searchWrap.classList.toggle('alloc-picker-panel__search-wrap--has-query', has);
      };

      const applySelectedCoins = () => {
        const items = selectedCoinKeys.map((k) => coinByKey.get(k)).filter(Boolean).map((c) => ({
          name: c.name,
          ticker: c.ticker,
          icon: c.icon,
        }));
        if (!items.length) return;
        detailAllocOverride = { kind: 'coins', items };
        populatePanel({ preserveAmount: true });
        updateDetailReturn();
      };

      const open = (openOpts = {}) => {
        const emptyEntry = openOpts.emptyEntry === true;
        const currentPanelTickers = Array.from(
          panel.querySelectorAll('.alloc-multi__ticker, .plan-detail-panel__alloc-ticker'),
        )
          .map((el) => String(el.textContent || '').trim().toLowerCase())
          .filter(Boolean);

        const fallbackItems = detailAllocOverride?.items?.length
          ? detailAllocOverride.items
          : (() => {
              const activePlan =
                (document.querySelector('[data-plan-carousel]')?.getAttribute('data-active-plan') || 'bitcoin').toLowerCase();
              const fallback = planAllocation[activePlan] || planAllocation.bitcoin;
              return fallback || [];
            })();

        const initialKeysFromPanel = currentPanelTickers
          .map((ticker) => pickableCoins.find((c) => c.ticker.toLowerCase() === ticker)?.key)
          .filter(Boolean);
        const initialKeysFromFallback = fallbackItems
          .map((it) => {
            const ticker = String(it.ticker || '').trim().toLowerCase();
            return pickableCoins.find((c) => c.ticker.toLowerCase() === ticker)?.key;
          })
          .filter(Boolean);

        const seed = emptyEntry
          ? []
          : initialKeysFromPanel.length
            ? initialKeysFromPanel
            : initialKeysFromFallback;
        selectedCoinKeys = Array.from(new Set(seed)).slice(0, 3);
        activeTab = 'coins';
        if (searchInput) searchInput.value = '';
        syncSearchClear();
        syncTabs();
        renderCurated();
        renderCoins();
        renderChips({ full: true });
        allocPickerPanel.hidden = false;
        requestAnimationFrame(() => allocPickerPanel.classList.add('is-open'));
      };

      const close = (closeOpts = {}) => {
        if (closeOpts.instant) {
          allocPickerPanel.style.transition = 'none';
          allocPickerPanel.classList.remove('is-open');
          void allocPickerPanel.offsetHeight;
          allocPickerPanel.style.transition = '';
          allocPickerPanel.hidden = true;
          return;
        }
        allocPickerPanel.classList.remove('is-open');
        const onEnd = () => {
          if (!allocPickerPanel.classList.contains('is-open')) allocPickerPanel.hidden = true;
          allocPickerPanel.removeEventListener('transitionend', onEnd);
        };
        allocPickerPanel.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 420);
      };

      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          activeTab = btn.dataset.allocPickerTab === 'curated' ? 'curated' : 'coins';
          syncTabs();
        });
      });

      allocPickerPanel.querySelectorAll('[data-alloc-picker-close]').forEach((btn) => {
        btn.addEventListener('click', () => close());
      });

      searchInput?.addEventListener('input', () => {
        syncSearchClear();
        renderCoins();
      });

      searchClearBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        if (searchInput) searchInput.value = '';
        syncSearchClear();
        renderCoins();
        searchInput?.focus();
      });

      coinsListEl?.addEventListener('click', (e) => {
        const row = e.target.closest('[data-alloc-picker-coin]');
        if (!row) return;
        const key = row.getAttribute('data-alloc-picker-coin');
        const idx = selectedCoinKeys.indexOf(key);
        if (idx >= 0) {
          selectedCoinKeys.splice(idx, 1);
        } else if (selectedCoinKeys.length < 3) {
          selectedCoinKeys.push(key);
        } else {
          showTopSnackbar('Max 3 coins', { variant: 'alloc-picker-max' });
        }
        renderCoins({ full: false });
        renderChips();
      });

      chipsEl?.addEventListener('click', (e) => {
        const dismiss = e.target.closest('button[data-alloc-picker-chip-remove]');
        if (!dismiss) return;
        e.preventDefault();
        const key = dismiss.getAttribute('data-alloc-picker-chip-remove');
        selectedCoinKeys = selectedCoinKeys.filter((k) => k !== key);
        renderCoins({ full: false });
        renderChips();
      });

      continueBtn?.addEventListener('click', () => {
        applySelectedCoins();
        close();
      });

      curatedListEl?.addEventListener('click', (e) => {
        const card = e.target.closest('[data-alloc-picker-curated]');
        if (!card) return;
        const key = String(card.getAttribute('data-alloc-picker-curated') || '').toLowerCase();
        const items = planAllocation[key];
        if (!items?.length) return;
        detailAllocOverride = { kind: 'curated', key, items };
        populatePanel({ preserveAmount: true });
        updateDetailReturn();
        close();
      });

      document.addEventListener('range-sheet-confirmed', () => {
        if (!allocPickerPanel.classList.contains('is-open')) return;
        renderCoins();
        renderCurated();
      });

      return { open, close };
    };
    const allocPickerApi = initPlanAllocPicker();

    const initPlanBreakdownPanel = () => {
      const breakdownPanel = document.querySelector('[data-plan-breakdown-panel]');
      if (!breakdownPanel) return { open: () => {}, close: () => {}, sync: () => {}, syncFromPlanWidget: () => {} };

      const rangeBtnDetail = breakdownPanel.querySelector('.plan-breakdown-panel__range--detail');
      const rangeBtnWidget = breakdownPanel.querySelector('.plan-breakdown-panel__range--widget');

      const iconWrap = breakdownPanel.querySelector('[data-plan-breakdown-icon-wrap]');
      const headlineEl = breakdownPanel.querySelector('[data-plan-breakdown-headline]');
      const legendAssetsEl = breakdownPanel.querySelector('[data-plan-breakdown-legend-assets]');
      const legendSpEl = breakdownPanel.querySelector('[data-plan-breakdown-legend-sp]');
      const legendSpItemEl = breakdownPanel.querySelector('[data-plan-breakdown-legend-sp-item]');
      const simTitleEl = breakdownPanel.querySelector('[data-plan-breakdown-sim-title]');
      const periodLabelEl = breakdownPanel.querySelector('[data-plan-breakdown-period-label]');
      const contributionEl = breakdownPanel.querySelector('[data-plan-breakdown-contribution]');
      const totalLabelEl = breakdownPanel.querySelector('[data-plan-breakdown-total-label]');
      const totalEl = breakdownPanel.querySelector('[data-plan-breakdown-total]');
      const valueEl = breakdownPanel.querySelector('[data-plan-breakdown-value]');
      const profitPctEl = breakdownPanel.querySelector('[data-plan-breakdown-profit-pct]');
      const profitHistPctEl = breakdownPanel.querySelector('[data-plan-breakdown-profit-historic-pct]');
      const profitAssetIconsEl = breakdownPanel.querySelector('[data-plan-breakdown-profit-asset-icons]');
      const profitHistCapEl = breakdownPanel.querySelector('[data-plan-breakdown-profit-historic-caption]');
      const profitStratCapEl = breakdownPanel.querySelector('[data-plan-breakdown-profit-strategy-caption]');
      const profitAbsEl = breakdownPanel.querySelector('[data-plan-breakdown-profit-abs]');
      const profitCurEl = breakdownPanel.querySelector('[data-plan-breakdown-profit-currency]');

      /** @type {'detail' | 'widget'} */
      let breakdownOpenSource = 'detail';

      const setBreakdownRangeButtons = (source) => {
        if (rangeBtnDetail) rangeBtnDetail.hidden = source !== 'detail';
        if (rangeBtnWidget) rangeBtnWidget.hidden = source !== 'widget';
      };

      const applyCommonBreakdownUi = ({
        selectedAssets,
        prettyTickers,
        range,
        amount,
        cur,
        freqLabel,
        sim,
        chartPlanKey,
        freq,
        fallbackIconSrc,
      }) => {
        const pct = Number.isFinite(sim?.returnPct) ? sim.returnPct : 0;
        const histPct = Number.isFinite(sim?.historicReturnPct) ? sim.historicReturnPct : 0;
        const totalInvested = Math.round(Number.isFinite(sim?.totalInvested) ? sim.totalInvested : 0);
        const profit = Number.isFinite(sim?.profit) ? sim.profit : 0;
        const value = Math.round(totalInvested + profit);

        const tickers = (selectedAssets || [])
          .map((it) => String(it?.ticker || '').trim())
          .filter(Boolean)
          .slice(0, 3);
        const stackItems = (selectedAssets || []).slice(0, 3).filter((it) => it && it.icon);
        const isBreakdownIconStack = stackItems.length >= 2;
        if (iconWrap) {
          iconWrap.classList.toggle('plan-breakdown-panel__asset-wrap--stack', isBreakdownIconStack);
          iconWrap.classList.toggle('plan-breakdown-panel__asset-wrap--single', !isBreakdownIconStack);
        }
        renderPlanDetailProductIcons(iconWrap, iconWrap, fallbackIconSrc, tickers.length ? selectedAssets : null, {
          singleProductClass: 'plan-breakdown-panel__asset-icon',
          singleHeaderClass: 'plan-breakdown-panel__asset-icon',
        });
        if (headlineEl) {
          headlineEl.textContent = `If you'd started ${range} ago and invested in ${prettyTickers}`;
        }
        if (simTitleEl) simTitleEl.textContent = `If you'd started ${range} ago ≈`;
        breakdownPanel.querySelectorAll('[data-plan-breakdown-profit-range-label]').forEach((el) => {
          el.textContent = `${range} simulated outcome ≈`;
        });
        if (legendAssetsEl) legendAssetsEl.textContent = `Plan value (${prettyTickers || '—'})`;
        const showSp500 = getPrototypeBreakdownSp500Visible();
        if (legendSpEl) legendSpEl.hidden = !showSp500;
        if (legendSpItemEl) legendSpItemEl.hidden = !showSp500;
        if (periodLabelEl) periodLabelEl.textContent = `${freqLabel} invested`;
        if (totalLabelEl) totalLabelEl.textContent = `Total invested`;
        if (contributionEl) contributionEl.textContent = `${amount.toLocaleString('en-US')} ${cur}`;
        if (totalEl) totalEl.textContent = `${totalInvested.toLocaleString('en-US')} ${cur}`;
        if (valueEl) valueEl.textContent = `${value.toLocaleString('en-US')} ${cur}`;
        if (profitPctEl) {
          profitPctEl.textContent = `${pct.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}% return`;
        }
        if (profitHistPctEl) {
          profitHistPctEl.textContent = `${histPct.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
        }
        const profitIcons = buildReturnMetricProductIconWrap(selectedAssets, fallbackIconSrc);
        setReturnMetricIconWrapHtml(profitAssetIconsEl, profitIcons.html, { layoutSig: profitIcons.sig });
        if (profitHistCapEl) profitHistCapEl.textContent = buildHistoricPerformanceCaption(selectedAssets);
        if (profitStratCapEl) profitStratCapEl.textContent = 'Return';
        if (profitAbsEl) profitAbsEl.textContent = `${profit >= 0 ? '+' : '-'}${formatDetailFooterProfit(Math.abs(profit))}`;
        if (profitCurEl) profitCurEl.textContent = cur;

        const stratG = breakdownPanel.querySelector(
          '.plan-breakdown-panel__profit-metrics-col--strategy.plan-breakdown-panel__profit-metrics-col--values',
        );
        const histG = breakdownPanel.querySelector(
          '.plan-breakdown-panel__profit-metrics-col--historic.plan-breakdown-panel__profit-metrics-col--values',
        );
        setReturnMetricTone(stratG, profit);
        setReturnMetricTone(histG, histPct);

        const chartSvg = breakdownPanel.querySelector('[data-plan-breakdown-chart-svg]');
        const chartData = computePlanBreakdownChartSeries({
          amount,
          planKey: chartPlanKey,
          freq,
          historicalRangeKey: range,
        });
        renderPlanBreakdownChartSvg(chartSvg, chartData);
      };

      const syncFromDetail = (opts = {}) => {
        const fallbackIconSrc = opts.iconSrc || 'assets/icon_currency_btc.svg';
        const selectedAssets = getCurrentPlanDisplayAssets(fallbackIconSrc);
        const tickers = selectedAssets
          .map((it) => String(it?.ticker || '').trim())
          .filter(Boolean)
          .slice(0, 3);
        const prettyTickers = tickers.join(', ') || 'BTC';
        const range = rangeState.breakdown || '5Y';
        const amount = parseInt(String(amountInput?.value || '').replace(/[^0-9]/g, ''), 10) || 0;
        const cur = String(panel.querySelector('[data-plan-detail-currency]')?.textContent || currencyState.plan || 'TWD').trim();
        const freq = (
          document.querySelector('[data-plan-freq-item].is-active')?.getAttribute('data-plan-freq-item') || 'monthly'
        ).toLowerCase();
        const freqLabel = freq === 'daily' ? 'Daily' : freq === 'weekly' ? 'Weekly' : 'Monthly';

        const ctx = panelOpenContext;
        const overrideCuratedKey =
          detailAllocOverride?.kind === 'curated' && detailAllocOverride.key
            ? String(detailAllocOverride.key).toLowerCase()
            : '';
        const effectiveCuratedKey =
          ctx.source === 'curated' && ctx.curatedKey ? String(ctx.curatedKey).toLowerCase() : overrideCuratedKey;
        let planKeyOpt;
        if (effectiveCuratedKey) planKeyOpt = effectiveCuratedKey;
        else if (ctx.source === 'spotlight' && ctx.spotlightKey) planKeyOpt = String(ctx.spotlightKey).toLowerCase();

        const chartPlanKey =
          planKeyOpt ||
          String(document.querySelector('[data-plan-carousel]')?.getAttribute('data-active-plan') || 'bitcoin').toLowerCase();

        const sim = updatePlanStrategyHistoricalReturn({
          detailPanel: true,
          amount,
          planKey: planKeyOpt,
          freq,
          historicalRangeKey: range,
          domWrite: false,
          displayAssets: selectedAssets,
        });
        const simWithAllocTweak = (() => {
          if (!sim || typeof detailPanelAllocPctTweakFn !== 'function') return sim;
          const tw = detailPanelAllocPctTweakFn();
          if (!isFinite(tw)) return sim;
          const next = { ...sim };
          const simBasePct = Number.isFinite(sim.returnPct) ? sim.returnPct : 0;
          const simAppliedTw = amount > 0 ? tw : 0;
          const simNextPct = simBasePct + simAppliedTw;
          next.returnPct = simNextPct;
          if (Number.isFinite(sim.profit) && Math.abs(simBasePct) > 1e-6) {
            next.profit = sim.profit * (simNextPct / simBasePct);
          }
          if (Number.isFinite(sim.historicReturnPct)) {
            next.historicReturnPct = sim.historicReturnPct + tw;
          }
          return next;
        })();

        applyCommonBreakdownUi({
          selectedAssets,
          prettyTickers,
          range,
          amount,
          cur,
          freqLabel,
          sim: simWithAllocTweak,
          chartPlanKey,
          freq,
          fallbackIconSrc,
        });
      };

      const syncFromWidget = () => {
        const carousel = document.querySelector('[data-plan-carousel]');
        const activePlan = String(carousel?.getAttribute('data-active-plan') || 'bitcoin').toLowerCase();
        const selectedAssets = (planAllocation[activePlan] || planAllocation.bitcoin || []).slice(0, 3);
        const tickers = selectedAssets
          .map((it) => String(it?.ticker || '').trim())
          .filter(Boolean)
          .slice(0, 3);
        const prettyTickers = tickers.join(', ') || 'BTC';
        const range = rangeState.widgetBreakdown || rangeState.plan || '5Y';
        const amount = parseInt(String(document.querySelector('[data-plan-amount]')?.textContent || '0').replace(/[^0-9]/g, ''), 10) || 0;
        const cur = String(document.querySelector('[data-plan-currency-label]')?.textContent || currencyState.plan || 'TWD').trim();
        const freq = (
          document.querySelector('[data-plan-freq-item].is-active')?.getAttribute('data-plan-freq-item') || 'monthly'
        ).toLowerCase();
        const freqLabel = freq === 'daily' ? 'Daily' : freq === 'weekly' ? 'Weekly' : 'Monthly';
        const fallbackIconSrc = selectedAssets[0]?.icon || 'assets/icon_currency_btc.svg';

        const sim = updatePlanStrategyHistoricalReturn({
          amount,
          planKey: activePlan,
          freq,
          historicalRangeKey: range,
          domWrite: false,
          displayAssets: selectedAssets,
        });

        applyCommonBreakdownUi({
          selectedAssets,
          prettyTickers,
          range,
          amount,
          cur,
          freqLabel,
          sim,
          chartPlanKey: activePlan,
          freq,
          fallbackIconSrc,
        });
      };

      const sync = (opts = {}) => {
        const source =
          opts.source ||
          (breakdownPanel.classList.contains('is-open') ? breakdownOpenSource : 'detail');
        if (source === 'widget') syncFromWidget();
        else syncFromDetail(opts);
      };

      const open = () => {
        breakdownOpenSource = 'detail';
        // Opening breakdown from plan-detail footer should inherit the current plan range.
        rangeState.breakdown = rangeState.plan || rangeState.breakdown || '5Y';
        updateRangeUI('breakdown', rangeState.breakdown);
        setBreakdownRangeButtons('detail');
        syncFromDetail();
        panel.classList.add('is-plan-breakdown-open');
        breakdownPanel.hidden = false;
        requestAnimationFrame(() => breakdownPanel.classList.add('is-open'));
      };

      const openFromPlanWidget = () => {
        breakdownOpenSource = 'widget';
        // Opening breakdown from Finance quick strategy should inherit its current range.
        rangeState.widgetBreakdown = rangeState.plan || rangeState.widgetBreakdown || '5Y';
        updateRangeUI('widgetBreakdown', rangeState.widgetBreakdown);
        setBreakdownRangeButtons('widget');
        syncFromWidget();
        breakdownPanel.hidden = false;
        requestAnimationFrame(() => breakdownPanel.classList.add('is-open'));
      };

      const close = (closeOpts = {}) => {
        const finishClose = () => {
          breakdownPanel.hidden = true;
          panel.classList.remove('is-plan-breakdown-open');
        };
        if (closeOpts.instant) {
          breakdownPanel.style.transition = 'none';
          breakdownPanel.classList.remove('is-open');
          void breakdownPanel.offsetHeight;
          breakdownPanel.style.transition = '';
          finishClose();
          return;
        }
        breakdownPanel.classList.remove('is-open');
        const onEnd = () => {
          if (!breakdownPanel.classList.contains('is-open')) {
            finishClose();
          }
          breakdownPanel.removeEventListener('transitionend', onEnd);
        };
        breakdownPanel.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 380);
      };

      panel.querySelector('.plan-detail-panel__view-breakdown-link')?.addEventListener('click', open);
      document.querySelector('.plan-strategy__view-breakdown-link')?.addEventListener('click', openFromPlanWidget);
      breakdownPanel.querySelectorAll('[data-plan-breakdown-close]').forEach((btn) => btn.addEventListener('click', close));

      document.addEventListener('range-sheet-confirmed', (e) => {
        if (!breakdownPanel.classList.contains('is-open')) return;
        const ctx = e?.detail?.context;
        // The breakdown panel is shared by Plan Detail and Finance widget.
        // Once opened, it must not "switch sources" when range changes — only refresh
        // if the confirmed range context matches the currently-open source.
        if (ctx === 'breakdown' && (breakdownOpenSource === 'detail' || rangeBtnDetail?.hidden === false)) {
          syncFromDetail();
        } else if (ctx === 'widgetBreakdown' && (breakdownOpenSource === 'widget' || rangeBtnWidget?.hidden === false)) {
          syncFromWidget();
        }
      });

      document.addEventListener('plan-schedule-confirmed', () => {
        if (breakdownPanel.classList.contains('is-open') && breakdownOpenSource === 'detail') sync({ source: 'detail' });
      });
      document.addEventListener('prototype-breakdown-sp500-toggle', () => {
        if (!breakdownPanel.classList.contains('is-open')) return;
        if (breakdownOpenSource === 'widget') syncFromWidget();
        else syncFromDetail();
      });

      return {
        open,
        close,
        sync,
        syncFromPlanWidget: () => {
          if (breakdownPanel.classList.contains('is-open') && breakdownOpenSource === 'widget') syncFromWidget();
        },
      };
    };
    planBreakdownApi = initPlanBreakdownPanel();

    const initPlanOverviewPanel = () => {
      const overviewPanel = panel.querySelector('[data-plan-overview-panel]');
      if (!overviewPanel) return { open: () => {}, close: () => {}, sync: () => {} };
      const overviewScroller = overviewPanel.querySelector('.plan-overview-panel__scroller');
      const overviewConfirmBtn = overviewPanel.querySelector('[data-plan-overview-confirm]');
      const overviewConsentToggle = overviewPanel.querySelector('[data-plan-overview-consent-toggle]');
      const overviewConsentIcon = overviewPanel.querySelector('.plan-overview-panel__consent-icon');
      let overviewConsentChecked = false;
      let openedFromBuffer = false;

      const overviewTimingLabels = {
        daily: 'Every day at',
        weekly: 'Every week on',
        monthly: 'Every month on',
      };

      const escOv = (s) =>
        String(s ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/"/g, '&quot;');

      // Reserve option section removed from overview.
      const closeReserveInfo = () => {};

      const syncOverviewConsentUI = () => {
        if (overviewConsentToggle) {
          overviewConsentToggle.setAttribute('aria-pressed', overviewConsentChecked ? 'true' : 'false');
        }
        if (overviewConsentIcon) {
          overviewConsentIcon.setAttribute(
            'src',
            overviewConsentChecked ? 'assets/icon_checkbox_on.svg' : 'assets/icon_checkbox_off.svg',
          );
        }
        if (overviewConfirmBtn) overviewConfirmBtn.disabled = !overviewConsentChecked;
      };

      const syncFromPlanDetail = () => {
        const chipsEl = overviewPanel.querySelector('[data-plan-overview-chips]');
        const headingEl = overviewPanel.querySelector('[data-plan-overview-alloc-heading]');
        const planNameEl = overviewPanel.querySelector('[data-plan-overview-plan-name]');
        const planAmountEl = overviewPanel.querySelector('[data-plan-overview-plan-amount]');
        const planMetaEl = overviewPanel.querySelector('[data-plan-overview-plan-meta]');
        const planIconWrap = overviewPanel.querySelector('[data-plan-overview-plan-icon-wrap]');
        const repeatsEl = overviewPanel.querySelector('[data-plan-overview-repeats]');
        const endMainEl = overviewPanel.querySelector('[data-plan-overview-end-main]');
        const endSubEl = overviewPanel.querySelector('[data-plan-overview-end-sub]');
        const totalPlannedRowEl = overviewPanel.querySelector('[data-plan-overview-total-planned-row]');
        const totalPlannedAfterDividerEl = overviewPanel.querySelector('[data-plan-overview-total-planned-after-divider]');
        const totalPlannedValEl = overviewPanel.querySelector('[data-plan-overview-total-planned]');
        const paymentMethodEl = overviewPanel.querySelector('[data-plan-overview-payment-method]');
        const paymentMethodSubEl = overviewPanel.querySelector('[data-plan-overview-payment-method-sub]');
        const prefundDividerEl = overviewPanel.querySelector('[data-plan-overview-prefund-divider]');
        const prefundRowEl = overviewPanel.querySelector('[data-plan-overview-prefund-row]');
        const runoutDividerEl = overviewPanel.querySelector('[data-plan-overview-runout-divider]');
        const runoutRowEl = overviewPanel.querySelector('[data-plan-overview-runout-row]');
        const runoutValueEl = overviewPanel.querySelector('[data-plan-overview-runout-value]');
        const prefundAfterDividerEl = overviewPanel.querySelector('[data-plan-overview-prefund-after-divider]');
        const prefundAmountEl = overviewPanel.querySelector('[data-plan-overview-prefund-amount]');
        const prefundSubEl = overviewPanel.querySelector('[data-plan-overview-prefund-sub]');
        const firstBuyEl = overviewPanel.querySelector('[data-plan-overview-first-buy]');
        const deductSubEl = overviewPanel.querySelector('[data-plan-overview-deduct-sub]');

        const multiItems = getActiveAllocMultiItems();
        const singleItems = panel.querySelectorAll('.plan-detail-panel__alloc-item');
        const chips = [];

        if (multiItems.length) {
          const allocRoot = getActiveAllocMultiRoot();
          const isAmountMode = !!allocRoot?.classList.contains('alloc-multi--amount-mode');
          /** @type {number[]} */
          let pctValues = [];
          if (isAmountMode) {
            const amounts = Array.from(multiItems).map((row) => {
              const pctIn = row.querySelector('[data-alloc-pct-input]');
              const raw = pctIn ? String(pctIn.value || '').replace(/[^0-9]/g, '') : '';
              return raw ? parseInt(raw, 10) : 0;
            });
            const totalAmt = amounts.reduce((s, n) => s + (isFinite(n) ? n : 0), 0);
            if (totalAmt > 0) {
              pctValues = amounts.map((n) => Math.max(0, Math.round((n / totalAmt) * 100)));
              // Keep display totals stable at 100% after rounding.
              const sumPct = pctValues.reduce((s, n) => s + n, 0);
              const adjIdx = pctValues.length - 1;
              if (adjIdx >= 0 && sumPct !== 100) pctValues[adjIdx] += 100 - sumPct;
            } else {
              pctValues = amounts.map(() => 0);
            }
          }
          multiItems.forEach((row, idx) => {
            const icon = row.querySelector('.alloc-multi__icon')?.getAttribute('src') || '';
            const ticker = row.querySelector('.alloc-multi__ticker')?.textContent?.trim() || '';
            const pctIn = row.querySelector('[data-alloc-pct-input]');
            const pctRaw = pctIn ? String(pctIn.value || '').replace(/[^0-9]/g, '') : '';
            const pctNum = isAmountMode
              ? (isFinite(pctValues[idx]) ? pctValues[idx] : 0)
              : (pctRaw ? parseInt(pctRaw, 10) : 0);
            const pct = pctNum > 0 ? `${pctNum}` : '';
            if (!ticker) return;
            const pctPart = pct ? `<span class="plan-overview-panel__chip-pct">${escOv(pct)}%</span>` : '';
            chips.push(`<div class="plan-overview-panel__chip"><img class="plan-overview-panel__chip-icon" src="${escPlanDetailIconAttr(icon)}" alt="" /><div class="plan-overview-panel__chip-meta"><span class="plan-overview-panel__chip-ticker">${escOv(ticker)}</span>${pctPart}</div></div>`);
          });
        } else {
          singleItems.forEach((row) => {
            const icon = row.querySelector('.plan-detail-panel__alloc-icon')?.getAttribute('src') || '';
            const ticker = row.querySelector('.plan-detail-panel__alloc-ticker')?.textContent?.trim() || '';
            if (!ticker) return;
            chips.push(`<div class="plan-overview-panel__chip"><img class="plan-overview-panel__chip-icon" src="${escPlanDetailIconAttr(icon)}" alt="" /><div class="plan-overview-panel__chip-meta"><span class="plan-overview-panel__chip-ticker">${escOv(ticker)}</span><span class="plan-overview-panel__chip-pct">100%</span></div></div>`);
          });
        }

        if (chipsEl) chipsEl.innerHTML = chips.join('');
        const n = chips.length;
        if (headingEl) headingEl.textContent = `Allocation (${n})`;

        if (planNameEl) {
          const name = panel.querySelector('[data-plan-detail-name]')?.textContent?.trim() || '—';
          planNameEl.textContent = name;
        }

        const amount = parseInt(String(amountInput?.value || '').replace(/[^0-9]/g, ''), 10) || 0;
        const cur = String(panel.querySelector('[data-plan-detail-currency]')?.textContent || currencyState.plan || 'TWD').trim();

        const freqKey = (
          document.querySelector('[data-plan-freq-item].is-active')?.getAttribute('data-plan-freq-item') || 'monthly'
        ).toLowerCase();
        const freqBtn = document.querySelector('[data-plan-freq-item].is-active');
        const freqText = freqBtn?.textContent?.trim() || 'Monthly';
        const sched = panel.querySelector('[data-plan-detail-schedule]')?.textContent?.trim() || '';
        const schedLower = sched.toLowerCase();
        const cadenceFromSchedule = schedLower.startsWith('daily')
          ? 'day'
          : schedLower.startsWith('weekly')
            ? 'week'
            : schedLower.startsWith('monthly')
              ? 'month'
              : '';
        const freqUnit = cadenceFromSchedule || (freqKey === 'daily' ? 'day' : freqKey === 'weekly' ? 'week' : 'month');
        if (planAmountEl) {
          planAmountEl.innerHTML = amount > 0
            ? `Invest ${amount.toLocaleString('en-US')} ${cur}<br aria-hidden="true" /> each ${freqUnit}`
            : '—';
        }
        const schedParts = sched.split('·').map((t) => t.trim()).filter(Boolean);
        const timingDetail = schedParts.length > 1 ? schedParts.slice(1).join(' · ') : schedParts[0] || '—';
        const repeatsText = sched
          ? sched.replace(/\s+at\s+~?\d{1,2}:\d{2}\s*$/i, '').trim()
          : '';
        if (repeatsEl) {
          repeatsEl.textContent = repeatsText || freqText;
        }
        if (planMetaEl) {
          planMetaEl.textContent = timingDetail === '—'
            ? `Repeats ${freqText}`
            : `Repeats ${freqText} · ${timingDetail}`;
        }

        const fallbackPlanIcon =
          getActiveAllocSection()?.querySelector('.alloc-multi__icon')?.getAttribute('src') ||
          panel.querySelector('.plan-detail-panel__alloc-icon')?.getAttribute('src') ||
          'assets/icon_currency_btc.svg';
        const selectedPlanAssets = getCurrentPlanDisplayAssets(fallbackPlanIcon);
        if (planIconWrap) {
          renderPlanDetailProductIcons(
            planIconWrap,
            planIconWrap,
            fallbackPlanIcon,
            selectedPlanAssets,
            {
              singleProductClass: 'plan-detail-panel__product-icon',
              singleHeaderClass: 'plan-detail-panel__product-icon',
            },
          );
        }

        const endEl = panel.querySelector('[data-plan-detail-repeats-end]');
        const endRaw = String(endEl?.dataset?.endConditionText || endEl?.textContent || '—').trim();
        let endMain = 'Continuous';
        let endSub = 'Pause anytime';
        const endLower = endRaw.toLowerCase();
        // When set to number-of-buys mode, plan-detail stores values like:
        // "12 buys ~ Ends Mar 24, 2027" (or small legacy variants). Split this
        // so overview shows title: "12 buys", subtitle: "~ Ends Mar 24, 2027".
        const buysEndsMatch = endRaw.match(/^(.+?\bbuys?\b)\s*(?:~\s*)?Ends\s+(.+)$/i);
        if (buysEndsMatch || endLower === 'continuous' || /^after\s*\d+/i.test(endRaw) || /^after number/i.test(endRaw) || isPlanDetailSetLimitEnd(endRaw)) {
          endSub = 'Pause anytime';
        }
        if (endMainEl) endMainEl.textContent = endMain;
        if (endSubEl) {
          endSubEl.textContent = endSub;
          endSubEl.hidden = !endSub;
        }
        const isContinuousEnd = /\bcontinuous\b|\bContinuous\b/i.test(endRaw);
        const showTotalPlanned = isPlanDetailSetLimitEnd(endRaw) && !isContinuousEnd;
        if (totalPlannedRowEl) {
          totalPlannedRowEl.hidden = !showTotalPlanned;
          totalPlannedRowEl.style.display = showTotalPlanned ? '' : 'none';
        }
        if (totalPlannedAfterDividerEl) {
          totalPlannedAfterDividerEl.hidden = !showTotalPlanned;
          totalPlannedAfterDividerEl.style.display = showTotalPlanned ? '' : 'none';
        }
        if (totalPlannedValEl) {
          const detailTotalPlanned =
            panel.querySelector('[data-plan-detail-total-planned]')?.textContent?.trim() || '- -';
          totalPlannedValEl.textContent = showTotalPlanned ? detailTotalPlanned : '- -';
        }

        const selectedMethod = planBufferOverviewState.mode === 'reserved' ? 'reserved' : 'flexible';
        if (paymentMethodEl) {
          paymentMethodEl.textContent = selectedMethod === 'reserved' ? 'Set aside funds' : 'Pay as you go';
        }
        if (paymentMethodSubEl) {
          const showPaymentMethodSub = selectedMethod === 'reserved';
          paymentMethodSubEl.textContent = showPaymentMethodSub ? 'Reserved directly' : '';
          paymentMethodSubEl.hidden = !showPaymentMethodSub;
          paymentMethodSubEl.style.display = showPaymentMethodSub ? '' : 'none';
        }
        const showPrefund = selectedMethod === 'reserved';
        if (prefundRowEl) {
          prefundRowEl.hidden = !showPrefund;
          prefundRowEl.style.display = showPrefund ? '' : 'none';
        }
        // Keep divider below "Funding method" visible in both modes:
        // - reserved: divider sits above "Amount to reserve"
        // - pay as you go: it becomes the divider above "Deduct from"
        if (prefundDividerEl) {
          prefundDividerEl.hidden = false;
          prefundDividerEl.style.display = '';
        }
        if (runoutDividerEl) {
          runoutDividerEl.hidden = !showPrefund;
          runoutDividerEl.style.display = showPrefund ? '' : 'none';
        }
        if (runoutRowEl) {
          runoutRowEl.hidden = !showPrefund;
          runoutRowEl.style.display = showPrefund ? '' : 'none';
        }
        if (runoutValueEl) {
          runoutValueEl.textContent = planBufferOverviewState.autoRefillEnabled
            ? 'Auto-reserve again'
            : 'Use remaining balance';
        }
        if (prefundAfterDividerEl) {
          prefundAfterDividerEl.hidden = !showPrefund;
          prefundAfterDividerEl.style.display = showPrefund ? '' : 'none';
        }
        if (prefundAmountEl) {
          const reserveInputNum = Number.isFinite(planBufferOverviewState.reservedAmount)
            ? Math.floor(planBufferOverviewState.reservedAmount)
            : NaN;
          prefundAmountEl.textContent = Number.isFinite(reserveInputNum) && reserveInputNum > 0
            ? `${reserveInputNum.toLocaleString('en-US')} ${cur}`
            : '—';
          if (prefundSubEl) {
            // Always start from neutral text; avoid any stale legacy "Covers ..." copy.
            prefundSubEl.textContent = '—';
            const coversCount = Number.isFinite(reserveInputNum) && reserveInputNum > 0 && amount > 0
              ? Math.floor(reserveInputNum / amount)
              : 0;
            const unit = freqKey === 'daily' ? 'day' : freqKey === 'weekly' ? 'week' : 'month';
            const unitLabel = `${unit}${coversCount === 1 ? '' : 's'}`;
            let untilText = '';
            if (coversCount > 0) {
              const compactNextBuyForCovers = formatFinanceNextBuyCompact(sched) || '';
              const dateToken = compactNextBuyForCovers.split('·')[0]?.trim() || '';
              const monthDayMatch = dateToken.match(/^([A-Za-z]{3,9})\s+(\d{1,2})$/);
              if (monthDayMatch) {
                const monthDay = `${monthDayMatch[1]} ${monthDayMatch[2]}`;
                const now = new Date();
                const endDate = new Date(`${monthDay} ${now.getFullYear()}`);
                if (!Number.isNaN(endDate.getTime())) {
                  if (endDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
                    endDate.setFullYear(endDate.getFullYear() + 1);
                  }
                  if (unit === 'day') endDate.setDate(endDate.getDate() + coversCount);
                  else if (unit === 'week') endDate.setDate(endDate.getDate() + (coversCount * 7));
                  else endDate.setMonth(endDate.getMonth() + coversCount);
                  untilText = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }
              }
            }
            prefundSubEl.textContent = coversCount > 0
              ? `~${coversCount} ${unitLabel}${untilText ? ` · until ${untilText}` : ''}`
              : '—';
          }
        }

        const compactNextBuy = formatFinanceNextBuyCompact(sched);
        let firstBuyText = '—';
        const buyNowOn = panel.dataset?.scheduleBuyNow === '1';
        if (buyNowOn) {
          firstBuyText = 'Today';
        }
        if (!buyNowOn && compactNextBuy) {
          const dateToken = compactNextBuy.split('·')[0]?.trim() || '';
          const monthDayMatch = dateToken.match(/^([A-Za-z]{3,9})\s+(\d{1,2})$/);
          if (monthDayMatch) {
            const monthDay = `${monthDayMatch[1]} ${monthDayMatch[2]}`;
            const now = new Date();
            const guessed = new Date(`${monthDay} ${now.getFullYear()}`);
            if (!Number.isNaN(guessed.getTime())) {
              if (guessed.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
                guessed.setFullYear(guessed.getFullYear() + 1);
              }
              firstBuyText = guessed.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              });
            } else {
              firstBuyText = dateToken || '—';
            }
          } else {
            firstBuyText = dateToken || '—';
          }
        }
        if (firstBuyEl) firstBuyEl.textContent = firstBuyText;

        const balCur = currencyState.plan || 'TWD';
        const bal = BALANCES[balCur] ?? BALANCES.TWD;
        if (deductSubEl) deductSubEl.textContent = `Avail. ${bal.toLocaleString('en-US')} ${balCur}`;
      };

      const open = (openOpts = {}) => {
        planBreakdownApi.close();
        closeReserveInfo({ instant: true });
        syncFromPlanDetail();
        overviewConsentChecked = false;
        syncOverviewConsentUI();
        if (overviewScroller) overviewScroller.scrollTop = 0;
        openedFromBuffer = !!openOpts.fromBuffer;
        panel.classList.add('is-plan-overview-open');
        overviewPanel.hidden = false;
        requestAnimationFrame(() => overviewPanel.classList.add('is-open'));
      };

      const close = (closeOpts = {}) => {
        if (closeOpts.instant) {
          closeReserveInfo({ instant: true });
          overviewPanel.style.transition = 'none';
          overviewPanel.classList.remove('is-open');
          void overviewPanel.offsetHeight;
          overviewPanel.style.transition = '';
          overviewPanel.hidden = true;
          panel.classList.remove('is-plan-overview-open');
          if (openedFromBuffer) {
            const buf = panel.querySelector('[data-plan-buffer-panel]');
            if (buf) {
              buf.hidden = false;
              buf.classList.add('is-open');
            }
          }
          openedFromBuffer = false;
          return;
        }
        closeReserveInfo({ instant: true });
        overviewPanel.classList.remove('is-open');
        const onEnd = () => {
          if (!overviewPanel.classList.contains('is-open')) {
            overviewPanel.hidden = true;
            panel.classList.remove('is-plan-overview-open');
            if (openedFromBuffer) {
              const buf = panel.querySelector('[data-plan-buffer-panel]');
              if (buf) {
                buf.hidden = false;
                buf.classList.add('is-open');
              }
            }
            openedFromBuffer = false;
          }
          overviewPanel.removeEventListener('transitionend', onEnd);
        };
        overviewPanel.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 380);
      };

      overviewPanel.querySelectorAll('[data-plan-overview-close]').forEach((b) => b.addEventListener('click', close));
      overviewConsentToggle?.addEventListener('click', () => {
        overviewConsentChecked = !overviewConsentChecked;
        syncOverviewConsentUI();
      });
      syncOverviewConsentUI();
      // Reserve option section removed from overview.

      const continueSheet = document.querySelector('[data-plan-detail-continue-sheet]');
      const continueSheetPanel = continueSheet?.querySelector('.currency-sheet__panel');
      const continueSheetNameEl = continueSheet?.querySelector('[data-plan-continue-sheet-name]');
      const continueSheetAmountEl = continueSheet?.querySelector('[data-plan-continue-sheet-amount]');
      const continueSheetIconWrapEl = continueSheet?.querySelector('[data-plan-continue-sheet-icon-wrap]');
      const continueSheetAllocHeadingEl = continueSheet?.querySelector('[data-plan-continue-sheet-alloc-heading]');
      const continueSheetChipsEl = continueSheet?.querySelector('[data-plan-continue-sheet-chips]');
      const continueSheetRepeatsEl = continueSheet?.querySelector('[data-plan-continue-sheet-repeats]');
      const continueSheetRepeatsSubEl = continueSheet?.querySelector('[data-plan-continue-sheet-repeats-sub]');
      const continueSheetDurationMainEl = continueSheet?.querySelector('[data-plan-continue-sheet-duration-main]');
      const continueSheetDurationSubEl = continueSheet?.querySelector('[data-plan-continue-sheet-duration-sub]');

      const navigateToFundingStep = () => {
        if (ENABLE_PLAN_END_CONDITION_STEP) planEndConditionApi.open();
        else planBufferApi.open({ autofocusInput: true });
      };

      const openContinueSheet = () => {
        if (!continueSheet) return;
        continueSheet.hidden = false;
        requestAnimationFrame(() => continueSheet.classList.add('is-open'));
      };

      const closeContinueSheet = () => {
        if (!continueSheet || !continueSheetPanel) return;
        continueSheet.classList.remove('is-open');
        const onEnd = () => {
          if (!continueSheet.classList.contains('is-open')) continueSheet.hidden = true;
          continueSheetPanel.removeEventListener('transitionend', onEnd);
        };
        continueSheetPanel.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 290);
      };

      const syncContinueSheetChips = () => {
        if (!continueSheetChipsEl) return 0;
        const multiItems = getActiveAllocMultiItems();
        const singleItems = panel.querySelectorAll('.plan-detail-panel__alloc-item');
        continueSheetChipsEl.innerHTML = '';

        const appendChip = (icon, ticker, pctText) => {
          if (!ticker) return;
          const chip = document.createElement('div');
          chip.className = 'plan-overview-panel__chip';

          const iconEl = document.createElement('img');
          iconEl.className = 'plan-overview-panel__chip-icon';
          iconEl.src = icon || '';
          iconEl.alt = '';

          const meta = document.createElement('div');
          meta.className = 'plan-overview-panel__chip-meta';

          const tickerEl = document.createElement('span');
          tickerEl.className = 'plan-overview-panel__chip-ticker';
          tickerEl.textContent = ticker;
          meta.appendChild(tickerEl);

          const pctEl = document.createElement('span');
          pctEl.className = 'plan-overview-panel__chip-pct';
          pctEl.textContent = pctText;
          meta.appendChild(pctEl);

          chip.appendChild(iconEl);
          chip.appendChild(meta);
          continueSheetChipsEl.appendChild(chip);
        };

        if (multiItems.length) {
          const allocRoot = getActiveAllocMultiRoot();
          const isAmountMode = !!allocRoot?.classList.contains('alloc-multi--amount-mode');
          let pctValues = [];
          if (isAmountMode) {
            const amounts = Array.from(multiItems).map((row) => {
              const pctIn = row.querySelector('[data-alloc-pct-input]');
              const raw = pctIn ? String(pctIn.value || '').replace(/[^0-9]/g, '') : '';
              return raw ? parseInt(raw, 10) : 0;
            });
            const totalAmt = amounts.reduce((s, n) => s + (isFinite(n) ? n : 0), 0);
            if (totalAmt > 0) {
              pctValues = amounts.map((n) => Math.max(0, Math.round((n / totalAmt) * 100)));
              const sumPct = pctValues.reduce((s, n) => s + n, 0);
              const adjIdx = pctValues.length - 1;
              if (adjIdx >= 0 && sumPct !== 100) pctValues[adjIdx] += 100 - sumPct;
            } else {
              pctValues = amounts.map(() => 0);
            }
          }
          multiItems.forEach((row, idx) => {
            const icon = row.querySelector('.alloc-multi__icon')?.getAttribute('src') || '';
            const ticker = row.querySelector('.alloc-multi__ticker')?.textContent?.trim() || '';
            const pctIn = row.querySelector('[data-alloc-pct-input]');
            const pctRaw = pctIn ? String(pctIn.value || '').replace(/[^0-9]/g, '') : '';
            const pctNum = isAmountMode
              ? (isFinite(pctValues[idx]) ? pctValues[idx] : 0)
              : (pctRaw ? parseInt(pctRaw, 10) : 0);
            const pct = pctNum > 0 ? `${pctNum}%` : '0%';
            appendChip(icon, ticker, pct);
          });
          return continueSheetChipsEl.children.length;
        }

        singleItems.forEach((row) => {
          const icon = row.querySelector('.plan-detail-panel__alloc-icon')?.getAttribute('src') || '';
          const ticker = row.querySelector('.plan-detail-panel__alloc-ticker')?.textContent?.trim() || '';
          appendChip(icon, ticker, '100%');
        });
        return continueSheetChipsEl.children.length;
      };

      const syncContinueSheetSummary = () => {
        if (!continueSheet) return;
        const name = panel.querySelector('[data-plan-detail-name]')?.textContent?.trim() || '—';
        const amountRaw = parseInt(
          String(panel.querySelector('[data-plan-detail-amount-input]')?.value || '').replace(/[^0-9]/g, ''),
          10,
        ) || 0;
        const cur = String(panel.querySelector('[data-plan-detail-currency]')?.textContent || currencyState.plan || 'TWD').trim();
        const sched = panel.querySelector('[data-plan-detail-schedule]')?.textContent?.trim() || '';
        const schedClean = sched ? sched.replace(/\s+at\s+~?\d{1,2}:\d{2}\s*$/i, '').trim() : '—';
        const schedParts = sched.split('·').map((t) => t.trim()).filter(Boolean);
        const timingDetail = schedParts.length > 1 ? schedParts.slice(1).join(' · ') : '';
        const cadence = sched.toLowerCase().startsWith('daily')
          ? 'day'
          : sched.toLowerCase().startsWith('weekly')
            ? 'week'
            : 'month';

        const allocCount = syncContinueSheetChips();
        const iconSourceWrap = panel.querySelector('[data-plan-detail-icon-wrap]');
        const buyNowEnabled = String(panel.dataset.scheduleBuyNow || '0') === '1';
        const overviewFirstBuy = panel.querySelector('[data-plan-overview-first-buy]')?.textContent?.trim() || '';
        const repeatsSub = buyNowEnabled
          ? 'First buy Today'
          : (overviewFirstBuy && overviewFirstBuy !== '—'
            ? `First buy ${overviewFirstBuy}`
            : (timingDetail ? `First buy ${timingDetail}` : ''));
        const durationMain = 'Continuous';
        const durationSub = panel.querySelector('[data-plan-overview-end-sub]')?.textContent?.trim() || 'Pause anytime';

        if (continueSheetNameEl) continueSheetNameEl.textContent = name;
        if (continueSheetAmountEl) {
          continueSheetAmountEl.innerHTML = amountRaw > 0
            ? `Invest ${amountRaw.toLocaleString('en-US')} ${cur}<br aria-hidden="true" />each ${cadence}`
            : '—';
        }
        if (continueSheetAllocHeadingEl) continueSheetAllocHeadingEl.textContent = `Allocation (${allocCount})`;
        if (continueSheetRepeatsEl) continueSheetRepeatsEl.textContent = schedClean || '—';
        if (continueSheetRepeatsSubEl) {
          continueSheetRepeatsSubEl.textContent = repeatsSub;
          continueSheetRepeatsSubEl.hidden = !repeatsSub;
        }
        if (continueSheetDurationMainEl) continueSheetDurationMainEl.textContent = durationMain;
        if (continueSheetDurationSubEl) continueSheetDurationSubEl.textContent = durationSub;
        if (continueSheetIconWrapEl && iconSourceWrap) {
          continueSheetIconWrapEl.innerHTML = iconSourceWrap.innerHTML;
        }
      };

      continueSheet?.querySelectorAll('[data-plan-detail-continue-sheet-close]').forEach((b) => {
        b.addEventListener('click', closeContinueSheet);
      });
      continueSheet?.querySelector('[data-plan-detail-continue-sheet-confirm]')?.addEventListener('click', () => {
        closeContinueSheet();
        window.setTimeout(navigateToFundingStep, 500);
      });

      panel.querySelector('.plan-detail-panel__continue')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        if (btn.disabled) return;
        e.preventDefault();
        syncContinueSheetSummary();
        if (continueSheet) openContinueSheet();
        else navigateToFundingStep();
      });

      return { open, close, sync: syncFromPlanDetail };
    };
    planOverviewApi = initPlanOverviewPanel();

    const initPlanBufferPanel = () => {
      const bufferPanel = panel.querySelector('[data-plan-buffer-panel]');
      if (!bufferPanel) return { open: () => {}, close: () => {} };

      const bufferScroller = bufferPanel.querySelector('.plan-buffer-panel__scroller');
      const methodBtns = Array.from(bufferPanel.querySelectorAll('[data-plan-buffer-method]'));
      const flexibleDetails = bufferPanel.querySelector('[data-plan-buffer-details="flexible"]');
      const reservedDetails = bufferPanel.querySelector('[data-plan-buffer-details="reserved"]');
      const perBuyEl = bufferPanel.querySelector('[data-plan-buffer-perbuy]');
      const perBuyEl2 = bufferPanel.querySelector('[data-plan-buffer-perbuy-2]');
      const availBalanceEl = bufferPanel.querySelector('[data-plan-buffer-avail-balance]');
      const availBalanceEl2 = bufferPanel.querySelector('[data-plan-buffer-avail-balance-2]');
      const nextBuyEl = bufferPanel.querySelector('[data-plan-buffer-nextbuy]');
      const sourceEl = bufferPanel.querySelector('[data-plan-buffer-source]');
      const sourceEl2 = bufferPanel.querySelector('[data-plan-buffer-source-2]');

      const stepsEl = bufferPanel.querySelector('[data-plan-buffer-steps]');
      const reserveCurEl = bufferPanel.querySelector('[data-plan-buffer-reserve-cur]');
      const reserveAmtEl = bufferPanel.querySelector('[data-plan-buffer-reserve-amt]');
      const reserveBalanceErrorEl = bufferPanel.querySelector('[data-plan-buffer-balance-error]');
      const coversNowEl = bufferPanel.querySelector('[data-plan-buffer-covers-now]');
      const coversTotalEl = bufferPanel.querySelector('[data-plan-buffer-covers-total]');
      const coversSlashEl = bufferPanel.querySelector('[data-plan-buffer-covers-slash]');
      const coversAmountRowEl = bufferPanel.querySelector('[data-plan-buffer-covers-amount]');
      const coversAmountNowEl = bufferPanel.querySelector('[data-plan-buffer-covers-amount-now]');
      const coversAmountTotalEl = bufferPanel.querySelector('[data-plan-buffer-covers-amount-total]');
      const coversFillEl = bufferPanel.querySelector('[data-plan-buffer-covers-fill]');
      const coversTrackEl = bufferPanel.querySelector('.plan-buffer-panel__reserve-track');
      const reserveTrackNoteEl = bufferPanel.querySelector('[data-plan-buffer-reserve-track-note]');
      const reserveTrackPerBuyEl = bufferPanel.querySelector('[data-plan-buffer-reserve-track-perbuy]');
      const recurringPrefundEl = bufferPanel.querySelector('[data-plan-buffer-recurring-prefund]');
      const hideOnReservedRows = Array.from(bufferPanel.querySelectorAll('[data-plan-buffer-hide-on-reserved]'));
      const hideOnFlexibleRows = Array.from(bufferPanel.querySelectorAll('[data-plan-buffer-hide-on-flexible]'));

      const dec10Btn = bufferPanel.querySelector('[data-plan-buffer-reserve-dec-10]');
      const decBtn = bufferPanel.querySelector('[data-plan-buffer-reserve-dec]');
      const incBtn = bufferPanel.querySelector('[data-plan-buffer-reserve-inc]');
      const inc10Btn = bufferPanel.querySelector('[data-plan-buffer-reserve-inc-10]');

      const ctaBtn = bufferPanel.querySelector('[data-plan-buffer-confirm]');
      const learnMoreTrigger = bufferPanel.querySelector('[data-plan-buffer-learn-more-open]');
      const learnMorePanel = bufferPanel.querySelector('[data-plan-buffer-learn-more-panel]');
      const learnMoreTabButtons = Array.from(
        bufferPanel.querySelectorAll('[data-plan-buffer-learn-more-tab]'),
      );
      const learnMoreViews = Array.from(
        bufferPanel.querySelectorAll('[data-plan-buffer-learn-more-view]'),
      );

      const useMaxBtn = bufferPanel.querySelector('[data-plan-buffer-use-max]');
      const coversPctEl = bufferPanel.querySelector('[data-plan-buffer-covers-pct]');
      const coversPctWrapEl = bufferPanel.querySelector('[data-plan-buffer-covers-pct-wrap]');
      const coversBarEl = bufferPanel.querySelector('[data-plan-buffer-covers-bar]');
      const coversBarDividersEl = bufferPanel.querySelector('[data-plan-buffer-covers-bar-dividers]');
      const coversBuyTotalSuffix = bufferPanel.querySelector('[data-plan-buffer-covers-buy-total-suffix]');
      const coversPeriodNowEl = bufferPanel.querySelector('[data-plan-buffer-covers-period-now]');
      const coversPeriodTotalSuffix = bufferPanel.querySelector('[data-plan-buffer-covers-period-total-suffix]');
      const coversAmountTotalSuffix = bufferPanel.querySelector('[data-plan-buffer-covers-amount-total-suffix]');

      const sumPerbuyEl = bufferPanel.querySelector('[data-plan-buffer-sum-perbuy]');
      const sumCoversEl = bufferPanel.querySelector('[data-plan-buffer-sum-covers]');
      const sumUnusedEl = bufferPanel.querySelector('[data-plan-buffer-sum-unused]');
      const reserveInputEl = bufferPanel.querySelector('[data-plan-buffer-reserve-input]');
      const reserveRangeEl = bufferPanel.querySelector('[data-plan-buffer-reserve-range]');
      const reserveInputIconEl = bufferPanel.querySelector('[data-plan-buffer-reserve-input-icon]');
      const reserveMaxBtn = bufferPanel.querySelector('[data-plan-buffer-reserve-max]');
      const perBuySubtitleEl = bufferPanel.querySelector('[data-plan-buffer-perbuy-sub]');
      const planActionEl = bufferPanel.querySelector('[data-plan-buffer-plan-action]');
      const planActionTitleSuffixEl = bufferPanel.querySelector('[data-plan-buffer-plan-action-title-suffix]');
      const planActionBodyEl = bufferPanel.querySelector('[data-plan-buffer-plan-action-body]');
      const autoRefillTextEl = bufferPanel.querySelector('[data-plan-buffer-autorefill-text]');
      const autoRefillOptionBtns = Array.from(
        bufferPanel.querySelectorAll('[data-plan-buffer-autorefill-option]'),
      );
      const roundWrapEl = bufferPanel.querySelector('[data-plan-buffer-rounding]');
      const roundDownBtn = bufferPanel.querySelector('[data-plan-buffer-round-down]');
      const roundUpBtn = bufferPanel.querySelector('[data-plan-buffer-round-up]');

      let method = 'flexible'; // 'flexible' | 'reserved'
      let perBuy = 0;
      let cur = currencyState.plan || 'USDT';
      let reserveAmount = 0;
      let reserveInputAmount = 0;
      let coversTotalBuys = 40;
      let isSetLimit = false;
      let autoRefillEnabled = true;

      const setMethodUI = (next) => {
        method = next === 'reserved' ? 'reserved' : 'flexible';
        methodBtns.forEach((btn) => {
          const on = btn.getAttribute('data-plan-buffer-method') === method;
          btn.classList.toggle('is-selected', on);
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (flexibleDetails) {
          const showFlex = method === 'flexible';
          flexibleDetails.hidden = !showFlex;
          flexibleDetails.style.display = showFlex ? '' : 'none';
        }
        if (reservedDetails) reservedDetails.hidden = method !== 'reserved';
        hideOnReservedRows.forEach((row) => {
          const show = method !== 'reserved';
          row.hidden = !show;
          row.style.display = show ? '' : 'none';
        });
        hideOnFlexibleRows.forEach((row) => {
          const show = method !== 'flexible';
          row.hidden = !show;
          row.style.display = show ? '' : 'none';
        });
        if (ctaBtn) ctaBtn.textContent = method === 'reserved' ? 'Continue' : 'Continue';
      };

      const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '—');
      const formatWithCommas = (n) => n.toLocaleString('en-US');
      const MAX_RESERVE_INPUT = 99999999;
      const formatBuys = (n) => {
        if (!Number.isFinite(n) || n <= 0) return '0';
        const rounded = Math.round(n * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
      };
      const currencyIconSrc = (code) => {
        const c = String(code || 'USDT').toUpperCase();
        const map = {
          USDT: 'assets/icon_currency_usdt.svg',
          TWD: 'assets/icon_currency_TWD.svg',
          USD: 'assets/icon_currency_USD.svg',
          BTC: 'assets/icon_currency_btc.svg',
          ETH: 'assets/icon_currency_eth.svg',
          XRP: 'assets/icon_currency_xrp.svg',
          XAUT: 'assets/icon_currency_xaut.svg',
          LINK: 'assets/icon_currency_link.svg',
          NEAR: 'assets/icon_currency_near.svg',
          MATIC: 'assets/icon_currency_matic.svg',
          ONDO: 'assets/icon_currency_ondo.svg',
          AAVE: 'assets/icon_currency_aave.svg',
          RENDER: 'assets/icon_currency_render.svg',
        };
        return map[c] || map.USDT;
      };

      const computeNextBuyDate = () => {
        const schedText = panel.querySelector('[data-plan-detail-schedule]')?.textContent?.trim() || '';
        // Try to reuse existing compact formatter; then expand to include year.
        const compact = formatFinanceNextBuyCompact(schedText);
        const monthDay = compact.split('·')[0]?.trim();
        if (!monthDay) return '—';
        const t = new Date();
        const guess = new Date(`${monthDay} ${t.getFullYear()}`);
        if (Number.isNaN(guess.getTime())) return monthDay;
        // If the guess is in the past (e.g. Jan 10 when today is Mar), roll to next year.
        if (guess.getTime() < Date.now() - 24 * 60 * 60 * 1000) guess.setFullYear(guess.getFullYear() + 1);
        return guess.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };

      const computeCoversUntilText = ({ periods, unit, unitPlural }) => {
        if (!Number.isFinite(periods) || periods <= 0) return '- -';
        const nextBuyDate = computeNextBuyDate();
        const anchor = new Date(nextBuyDate);
        if (Number.isNaN(anchor.getTime())) {
          const label = periods === 1 ? unit : unitPlural;
          return `${periods} ${label}`;
        }
        const ordinalDay = (day) => {
          const d = Number(day) || 0;
          const mod100 = d % 100;
          if (mod100 >= 11 && mod100 <= 13) return `${d}th`;
          const mod10 = d % 10;
          if (mod10 === 1) return `${d}st`;
          if (mod10 === 2) return `${d}nd`;
          if (mod10 === 3) return `${d}rd`;
          return `${d}th`;
        };
        if (unit === 'day') anchor.setDate(anchor.getDate() + periods);
        else if (unit === 'week') anchor.setDate(anchor.getDate() + (periods * 7));
        else anchor.setMonth(anchor.getMonth() + periods);
        const month = anchor.toLocaleDateString('en-US', { month: 'short' });
        const day = ordinalDay(anchor.getDate());
        const label = periods === 1 ? unit : unitPlural;
        return `${month} ${day} · ${periods} ${label}`;
      };

      const getReserveBuyBounds = () => {
        // Prototype rule: pre-fund stepper never goes below 1 buy.
        if (!isSetLimit) return { min: 1, max: Number.POSITIVE_INFINITY };
        const maxBuys = Number.isFinite(coversTotalBuys) && coversTotalBuys > 0 ? coversTotalBuys : 1;
        return { min: 1, max: maxBuys };
      };

      const clampReserveAmount = (rawAmount) => {
        if (!Number.isFinite(rawAmount)) return 0;
        const n = Math.min(MAX_RESERVE_INPUT, Math.max(0, Math.floor(rawAmount)));
        if (perBuy <= 0) return n;
        const { max } = getReserveBuyBounds();
        if (Number.isFinite(max) && max > 0) {
          return Math.min(n, max * perBuy);
        }
        return n;
      };

      const getMaxAllowedAmount = () => {
        const balance = BALANCES[cur] ?? BALANCES.TWD;
        const reserveLimitAmount = isSetLimit && perBuy > 0 ? perBuy * coversTotalBuys : Number.POSITIVE_INFINITY;
        return Math.floor(Math.max(0, Math.min(balance, reserveLimitAmount, MAX_RESERVE_INPUT)));
      };

      const render = () => {
        reserveInputAmount = clampReserveAmount(reserveInputAmount);
        const perBuyStr = perBuy > 0 ? `${fmt(perBuy)} ${cur}` : '—';
        const balance = BALANCES[cur] ?? BALANCES.TWD;
        const reserveLimitAmount = isSetLimit && perBuy > 0 ? perBuy * coversTotalBuys : Number.POSITIVE_INFINITY;
        const maxAllowedAmount = Math.floor(Math.max(0, Math.min(balance, reserveLimitAmount)));
        const rawAmount = reserveInputAmount;
        const inputDigits = String(reserveInputEl?.value || '').replace(/[^0-9]/g, '');
        const isEmptyInput = inputDigits.length === 0;
        const isZeroInput = !isEmptyInput && rawAmount === 0;
        const isReservedActive = !!reservedDetails && !reservedDetails.hidden;
        const hasReserveBalanceError = isReservedActive && rawAmount > balance;
        const isOverLimit = isReservedActive && rawAmount > reserveLimitAmount;
        // "Fits 1 or multiple buys" means the amount covers an integer number of buys exactly.
        const isMultiple = perBuy > 0 && rawAmount > 0 && Math.floor(rawAmount / perBuy) * perBuy === rawAmount;
        const isValidReservedAmount = perBuy > 0 && rawAmount > 0 && isMultiple && !hasReserveBalanceError && !isOverLimit;
        reserveAmount = isValidReservedAmount ? rawAmount : 0;

        const nearestDown = perBuy > 0 ? Math.floor(rawAmount / perBuy) * perBuy : 0;
        const nearestUp = perBuy > 0 ? Math.ceil(rawAmount / perBuy) * perBuy : 0;
        const coversNow = perBuy > 0 ? Math.floor(rawAmount / perBuy) : 0;
        const unusedRaw = perBuy > 0 ? rawAmount - (coversNow * perBuy) : 0;

        if (availBalanceEl) availBalanceEl.textContent = `${fmt(balance)} ${cur}`;
        if (availBalanceEl2) availBalanceEl2.textContent = `Avail. ${fmt(balance)} ${cur}`;
        if (perBuyEl) perBuyEl.textContent = perBuyStr;
        if (perBuyEl2) perBuyEl2.textContent = perBuyStr;
        if (recurringPrefundEl) recurringPrefundEl.textContent = reserveAmount > 0 ? `${fmt(reserveAmount)} ${cur}` : '—';
        if (nextBuyEl) nextBuyEl.textContent = computeNextBuyDate();
        if (sourceEl) sourceEl.textContent = 'Wallet';
        if (sourceEl2) sourceEl2.textContent = 'Wallet';
        if (reserveCurEl) reserveCurEl.textContent = cur;
        if (reserveAmtEl) reserveAmtEl.textContent = reserveAmount > 0 ? fmt(reserveAmount) : '- -';
        if (reserveBalanceErrorEl) reserveBalanceErrorEl.hidden = !(hasReserveBalanceError || isOverLimit);
        if (reserveInputEl && document.activeElement !== reserveInputEl) {
          reserveInputEl.value = rawAmount > 0 ? formatWithCommas(rawAmount) : (isEmptyInput ? '' : '0');
        }
        if (reserveRangeEl) {
          reserveRangeEl.hidden = rawAmount > 0;
          const minText = '0';
          const maxText = Number.isFinite(maxAllowedAmount) && maxAllowedAmount > 0 ? fmt(maxAllowedAmount) : '—';
          reserveRangeEl.textContent = `Min ${minText} / Max ${maxText}`;
        }
        if (reserveInputIconEl) reserveInputIconEl.setAttribute('src', currencyIconSrc(cur));

        if (stepsEl) stepsEl.textContent = perBuy > 0 ? `${fmt(perBuy)} ${cur} per buy` : '- - per buy';
        if (coversNowEl) coversNowEl.textContent = String(coversNow);
        if (coversTotalEl) {
          coversTotalEl.textContent = String(coversTotalBuys);
          coversTotalEl.hidden = !isSetLimit;
        }
        if (coversSlashEl) coversSlashEl.hidden = !isSetLimit;
        if (coversAmountRowEl) coversAmountRowEl.hidden = !isSetLimit;
        if (coversAmountNowEl) coversAmountNowEl.textContent = rawAmount > 0 ? fmt(rawAmount) : '—';
        if (coversAmountTotalEl) {
          const totalAmount = isSetLimit && perBuy > 0 ? perBuy * coversTotalBuys : null;
          const totalText = totalAmount != null ? fmt(totalAmount) : '—';
          coversAmountTotalEl.textContent = ` / ${totalText} ${cur}`;
        }

        const freqKey = (
          document.querySelector('[data-plan-freq-item].is-active')?.getAttribute('data-plan-freq-item') || 'monthly'
        ).toLowerCase();
        const unit = freqKey === 'daily' ? 'day' : freqKey === 'weekly' ? 'week' : 'month';
        const unitPlural = `${unit}${coversTotalBuys === 1 ? '' : 's'}`;
        if (coversBarEl) coversBarEl.hidden = !isSetLimit;
        if (coversPctWrapEl) coversPctWrapEl.hidden = !isSetLimit;
        if (isSetLimit) {
          if (coversNowEl) coversNowEl.textContent = String(Math.max(0, coversNow));
          if (coversPeriodNowEl) coversPeriodNowEl.textContent = String(Math.max(0, coversNow));
          if (coversAmountNowEl) coversAmountNowEl.textContent = rawAmount > 0 ? fmt(rawAmount) : '—';
        } else {
          if (coversNowEl) coversNowEl.textContent = `${String(Math.max(0, coversNow))} buys`;
          if (coversPeriodNowEl) coversPeriodNowEl.textContent = `${String(Math.max(0, coversNow))} ${unitPlural}`;
          if (coversAmountNowEl) coversAmountNowEl.textContent = rawAmount > 0 ? `${fmt(rawAmount)} ${cur}` : '—';
        }
        if (coversBuyTotalSuffix) {
          coversBuyTotalSuffix.textContent = ` / ${String(coversTotalBuys)} buys`;
          coversBuyTotalSuffix.hidden = !isSetLimit;
        }
        if (coversPeriodTotalSuffix) {
          coversPeriodTotalSuffix.textContent = ` / ${String(coversTotalBuys)} ${unitPlural}`;
          coversPeriodTotalSuffix.hidden = !isSetLimit;
        }
        if (coversAmountTotalSuffix) {
          const totalAmount = isSetLimit && perBuy > 0 ? perBuy * coversTotalBuys : null;
          const totalText = totalAmount != null ? `${fmt(totalAmount)} ${cur}` : `— ${cur}`;
          coversAmountTotalSuffix.textContent = ` / ${totalText}`;
          coversAmountTotalSuffix.hidden = !isSetLimit;
        }
        if (coversPctEl) {
          const denom = isSetLimit && perBuy > 0 ? perBuy * coversTotalBuys : 0;
          const pct = denom > 0 ? Math.floor((rawAmount / denom) * 100) : 0;
          coversPctEl.textContent = String(Math.max(0, Math.min(100, pct)));
        }
        if (coversTrackEl) coversTrackEl.hidden = !isSetLimit;
        if (reserveTrackNoteEl) reserveTrackNoteEl.hidden = !isReservedActive;
        if (reserveTrackPerBuyEl) reserveTrackPerBuyEl.textContent = perBuy > 0 ? `${fmt(perBuy)} ${cur}` : '—';
        if (coversFillEl) {
          const pct = isSetLimit && coversTotalBuys > 0 ? (coversNow / coversTotalBuys) * 100 : 0;
          coversFillEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        }
        if (coversBarDividersEl) {
          coversBarDividersEl.innerHTML = '';
          const stepBuys = isSetLimit ? Math.max(0, Math.floor(coversNow)) : 0;
          const totalBuys = isSetLimit ? Math.max(0, Math.floor(coversTotalBuys)) : 0;
          const maxTicks = 18;
          if (stepBuys > 0 && totalBuys > 0 && stepBuys < totalBuys) {
            const tickCount = Math.floor((totalBuys - 1) / stepBuys);
            if (tickCount > 0 && tickCount <= maxTicks) {
              for (let k = 1; k <= tickCount; k += 1) {
                const buysAtTick = k * stepBuys;
                if (buysAtTick >= totalBuys) break;
                const leftPct = (buysAtTick / totalBuys) * 100;
                const tick = document.createElement('span');
                tick.className = 'plan-buffer-panel__covers-bar-divider';
                tick.style.left = `${leftPct}%`;
                coversBarDividersEl.appendChild(tick);
              }
            }
          }
        }

        const coversNowForButtons = perBuy > 0 ? Math.floor(rawAmount / perBuy) : 0;
        const { min: minBuys, max: maxBuys } = getReserveBuyBounds();
        if (dec10Btn) dec10Btn.disabled = coversNowForButtons <= minBuys;
        if (decBtn) decBtn.disabled = coversNowForButtons <= minBuys;
        if (incBtn) incBtn.disabled = coversNowForButtons >= maxBuys;
        if (inc10Btn) inc10Btn.disabled = coversNowForButtons >= maxBuys;

        if (perBuySubtitleEl) {
          perBuySubtitleEl.textContent = perBuy > 0 ? `Per buy : ${fmt(perBuy)} ${cur}` : 'Per buy : —';
        }
        if (sumPerbuyEl) {
          if (perBuy > 0 && rawAmount > 0) {
            const buysCovered = rawAmount / perBuy;
            const buyLabel = buysCovered === 1 ? 'buy' : 'buys';
            sumPerbuyEl.textContent = `${formatBuys(buysCovered)} ${buyLabel}`;
          } else {
            sumPerbuyEl.textContent = '- -';
          }
          sumPerbuyEl.classList.toggle('plan-buffer-funding-summary__value--warning', rawAmount > 0 && unusedRaw > 0);
          sumPerbuyEl.classList.toggle('plan-buffer-funding-summary__value--highlight', rawAmount > 0 && unusedRaw === 0);
        }
        if (sumCoversEl) {
          const periods = perBuy > 0 && rawAmount > 0 ? Math.max(1, Math.floor(rawAmount / perBuy)) : 0;
          sumCoversEl.textContent = computeCoversUntilText({ periods, unit, unitPlural });
        }
        if (sumUnusedEl) {
          const shouldHideUnused = perBuy > 0 && rawAmount > 0 && (rawAmount < perBuy || unusedRaw === 0);
          const unusedText = perBuy > 0 && rawAmount > 0 && !shouldHideUnused
            ? `${fmt(Math.max(0, unusedRaw))} ${cur}`
            : '- -';
          sumUnusedEl.textContent = unusedText;
          sumUnusedEl.classList.toggle('plan-buffer-funding-summary__value--negative', rawAmount > 0 && unusedRaw > 0 && !shouldHideUnused);
          sumUnusedEl.classList.toggle('plan-buffer-funding-summary__value--positive', rawAmount > 0 && unusedRaw === 0 && !shouldHideUnused);
        }

        // If the amount already covers an integer number of buys, unused remainder is 0.
        // In that case we hide the rounding UI.
        const showRounding = perBuy > 0 && rawAmount > 0 && unusedRaw !== 0;
        if (roundWrapEl) roundWrapEl.hidden = !showRounding;
        if (roundDownBtn) {
          const roundDownMain = roundDownBtn.querySelector('.plan-buffer-funding-round__btn-main');
          const roundDownSub = roundDownBtn.querySelector('.plan-buffer-funding-round__btn-sub');
          const hasRoundDownValue = nearestDown > 0;
          const downBuys = perBuy > 0 ? Math.floor(nearestDown / perBuy) : 0;
          const isSubOneBuyRemainder = perBuy > 0 && rawAmount > 0 && rawAmount < perBuy;
          roundDownBtn.classList.toggle('plan-buffer-funding-round__btn--secondary-paygo', isSubOneBuyRemainder);
          if (isSubOneBuyRemainder) {
            if (roundDownMain) roundDownMain.textContent = `0 ${cur}`;
            if (roundDownSub) roundDownSub.textContent = 'Pay as you go';
            roundDownBtn.disabled = false;
            roundDownBtn.hidden = false;
          } else {
            if (roundDownMain) roundDownMain.textContent = hasRoundDownValue ? `${formatWithCommas(nearestDown)} ${cur}` : '—';
            if (roundDownSub) roundDownSub.textContent = hasRoundDownValue ? `${downBuys} ${downBuys === 1 ? 'buy' : 'buys'}` : '—';
            roundDownBtn.disabled = !hasRoundDownValue;
            roundDownBtn.hidden = !hasRoundDownValue;
          }
        }
        if (roundUpBtn) {
          const roundUpMain = roundUpBtn.querySelector('.plan-buffer-funding-round__btn-main');
          const roundUpSub = roundUpBtn.querySelector('.plan-buffer-funding-round__btn-sub');
          const upBuys = perBuy > 0 ? Math.floor(nearestUp / perBuy) : 0;
          if (roundUpMain) roundUpMain.textContent = nearestUp > 0 ? `${formatWithCommas(nearestUp)} ${cur}` : '—';
          if (roundUpSub) roundUpSub.textContent = nearestUp > 0 ? `${upBuys} ${upBuys === 1 ? 'buy' : 'buys'}` : '—';
          roundUpBtn.disabled = !(nearestUp > 0 && nearestUp <= maxAllowedAmount);
        }
        if (reserveMaxBtn) reserveMaxBtn.disabled = !(maxAllowedAmount > 0);

        const showZeroAction = isZeroInput;
        const showValidAction = isValidReservedAmount;
        planBufferOverviewState = {
          mode: showValidAction ? 'reserved' : 'flexible',
          rawAmount,
          reservedAmount: reserveAmount,
          autoRefillEnabled,
          currency: cur,
          perBuy,
        };
        if (planActionEl) {
          if (showZeroAction) {
            if (planActionTitleSuffixEl) planActionTitleSuffixEl.textContent = 'Pay as you go';
            if (planActionBodyEl) {
              planActionBodyEl.textContent = 'No funds are set aside: Your plan is paid from your balance at time of each buy. May fail if balance is low.';
            }
          } else if (showValidAction) {
            if (planActionTitleSuffixEl) planActionTitleSuffixEl.textContent = 'Set aside funds';
            if (planActionBodyEl) {
              planActionBodyEl.textContent = `${fmt(rawAmount)} ${cur} will be set aside now and reserved for upcoming buys.`;
            }
          } else {
            if (planActionTitleSuffixEl) planActionTitleSuffixEl.textContent = '';
            if (planActionBodyEl) planActionBodyEl.textContent = '';
          }
          planActionEl.hidden = !(showZeroAction || showValidAction);
        }

        if (autoRefillTextEl) {
          autoRefillTextEl.textContent = showValidAction
            ? `We\u2019ll reserve ${fmt(rawAmount)} ${cur} again after funds runs out.`
            : '\u2014';
        }
        autoRefillOptionBtns.forEach((btn) => {
          const key = btn.getAttribute('data-plan-buffer-autorefill-option') || 'auto';
          const selected = autoRefillEnabled ? key === 'auto' : key === 'balance';
          btn.classList.toggle('is-selected', selected);
          btn.setAttribute('aria-checked', selected ? 'true' : 'false');
        });

        bufferPanel.classList.toggle('plan-buffer-panel--state-empty', isEmptyInput);
        bufferPanel.classList.toggle('plan-buffer-panel--state-zero', isZeroInput);
        bufferPanel.classList.toggle('plan-buffer-panel--has-positive', rawAmount > 0);
        bufferPanel.classList.toggle('plan-buffer-panel--state-invalid', rawAmount > 0 && !isMultiple);
        bufferPanel.classList.toggle('plan-buffer-panel--state-valid', showValidAction);

        const shouldDisableContinue = isEmptyInput || (rawAmount > 0 && !isValidReservedAmount);
        if (ctaBtn) ctaBtn.disabled = shouldDisableContinue;
      };

      const syncFromPlanDetail = () => {
        const amountInput = panel.querySelector('[data-plan-detail-amount-input]');
        cur = currencyState.plan || String(panel.querySelector('[data-plan-detail-currency]')?.textContent || 'USDT').trim();
        perBuy = parseInt(String(amountInput?.value || '').replace(/[^0-9]/g, ''), 10) || 0;

        // Use plan limit buys if available; else keep the Figma example default.
        const endEl = panel.querySelector('[data-plan-detail-repeats-end]');
        const endRaw = String(endEl?.dataset?.endConditionText || endEl?.textContent || '').trim();
        isSetLimit = isPlanDetailSetLimitEnd(endRaw);
        bufferPanel.classList.toggle('plan-buffer-panel--continuous', !isSetLimit);
        const m = endRaw.match(/^(\d+)\s+buys?\b/i);
        const n = m ? parseInt(m[1], 10) : NaN;
        coversTotalBuys = Number.isFinite(n) && n > 0 ? n : 40;

        // Funding (Set aside) starts empty until user enters a valid amount.
        reserveInputAmount = 0;
        reserveAmount = 0;
        autoRefillEnabled = true;
        if (reserveInputEl) reserveInputEl.value = '0';

        setMethodUI('reserved');
        render();
      };

      const bumpReserve = (deltaBuys) => {
        if (perBuy <= 0) return;
        reserveInputAmount = clampReserveAmount(reserveInputAmount + (deltaBuys * perBuy));
        render();
      };

      const open = (openOpts = {}) => {
        const shouldAutofocusInput = !!openOpts.autofocusInput;
        planBreakdownApi.close();
        planOverviewApi.close({ instant: true });
        planSuccessApi.forceClose();
        if (learnMorePanel) {
          learnMorePanel.classList.remove('is-open');
          learnMorePanel.hidden = true;
        }

        syncFromPlanDetail();

        if (bufferScroller) bufferScroller.scrollTop = 0;
        bufferPanel.hidden = false;
        requestAnimationFrame(() => bufferPanel.classList.add('is-open'));
        if (shouldAutofocusInput) {
          // Focus only after panel transition finishes to avoid viewport jump
          // interrupting stacked panel animations.
          let focused = false;
          const focusInput = () => {
            if (focused || !reserveInputEl) return;
            if (bufferPanel.hidden || !bufferPanel.classList.contains('is-open')) return;
            focused = true;
            try {
              reserveInputEl.focus({ preventScroll: true });
            } catch (_) {
              reserveInputEl.focus();
            }
            const len = (reserveInputEl.value || '').length;
            try { reserveInputEl.setSelectionRange(len, len); } catch (_) {}
          };
          const onEnd = () => {
            bufferPanel.removeEventListener('transitionend', onEnd);
            focusInput();
          };
          bufferPanel.addEventListener('transitionend', onEnd);
          // Fallback in case transitionend is skipped.
          setTimeout(() => {
            bufferPanel.removeEventListener('transitionend', onEnd);
            focusInput();
          }, 420);
        }
      };

      const close = (opts = {}) => {
        if (learnMorePanel) {
          learnMorePanel.classList.remove('is-open');
          learnMorePanel.hidden = true;
        }
        if (opts.instant) {
          // Leaving buffer should always leave the stack clean.
          planOverviewApi.close({ instant: true });
          bufferPanel.classList.remove('is-open');
          bufferPanel.hidden = true;
          return;
        }
        // If overview is open above us, close it first.
        planOverviewApi.close({ instant: true });
        bufferPanel.classList.remove('is-open');
        let done = false;
        const onEnd = () => {
          if (done) return;
          done = true;
          bufferPanel.removeEventListener('transitionend', onEnd);
          if (!bufferPanel.classList.contains('is-open')) bufferPanel.hidden = true;
        };
        bufferPanel.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 380);
      };

      const closeBuffer = () => close();
      bufferPanel.querySelector('[data-plan-buffer-back]')?.addEventListener('click', closeBuffer);
      bufferPanel.querySelector('[data-plan-buffer-back-bottom]')?.addEventListener('click', closeBuffer);

      methodBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const v = btn.getAttribute('data-plan-buffer-method') || 'flexible';
          setMethodUI(v);
          render();
        });
      });

      const applyReserveInputLiveFormat = () => {
        if (!reserveInputEl) return;
        const cursor = reserveInputEl.selectionStart || 0;
        const oldVal = reserveInputEl.value || '';
        const digitsBeforeCursor = oldVal.slice(0, cursor).replace(/[^0-9]/g, '').length;
        const raw = oldVal.replace(/[^0-9]/g, '');
        if (!raw) {
          reserveInputEl.value = '';
          reserveInputAmount = 0;
          return;
        }
        const clamped = Math.min(parseInt(raw, 10), MAX_RESERVE_INPUT);
        reserveInputAmount = Number.isFinite(clamped) ? clamped : 0;
        const formatted = formatWithCommas(reserveInputAmount);
        reserveInputEl.value = formatted;

        let newCursor = 0;
        let digitsSeen = 0;
        for (let i = 0; i < formatted.length; i += 1) {
          if (digitsSeen === digitsBeforeCursor) { newCursor = i; break; }
          if (formatted[i] !== ',') digitsSeen += 1;
          newCursor = i + 1;
        }
        reserveInputEl.setSelectionRange(newCursor, newCursor);
      };

      reserveInputEl?.addEventListener('input', () => {
        applyReserveInputLiveFormat();
        render();
      });

      reserveInputEl?.addEventListener('blur', () => {
        const digits = String(reserveInputEl.value || '').replace(/[^0-9]/g, '');
        const raw = parseInt(digits, 10);
        reserveInputAmount = Number.isFinite(raw) ? Math.max(0, raw) : 0;
        if (reserveInputEl) {
          reserveInputEl.value = digits ? formatWithCommas(reserveInputAmount) : '';
        }
        render();
      });

      reserveMaxBtn?.addEventListener('click', () => {
        const maxAllowed = getMaxAllowedAmount();
        if (perBuy > 0) {
          reserveInputAmount = Math.floor(maxAllowed / perBuy) * perBuy;
        } else {
          reserveInputAmount = maxAllowed;
        }
        render();
      });

      roundDownBtn?.addEventListener('click', () => {
        if (perBuy <= 0) return;
        reserveInputAmount = Math.floor(reserveInputAmount / perBuy) * perBuy;
        render();
      });

      roundUpBtn?.addEventListener('click', () => {
        if (perBuy <= 0) return;
        const next = Math.ceil(reserveInputAmount / perBuy) * perBuy;
        reserveInputAmount = Math.min(next, getMaxAllowedAmount());
        render();
      });

      incBtn?.addEventListener('click', () => bumpReserve(1));
      inc10Btn?.addEventListener('click', () => bumpReserve(10));
      decBtn?.addEventListener('click', () => bumpReserve(-1));
      dec10Btn?.addEventListener('click', () => bumpReserve(-10));

      // "Use Max": take the max whole-buy amount from available balance.
      useMaxBtn?.addEventListener('click', () => {
        if (perBuy <= 0) return;
        const maxAllowed = getMaxAllowedAmount();
        reserveInputAmount = Math.floor(maxAllowed / perBuy) * perBuy;
        render();
      });

      autoRefillOptionBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-plan-buffer-autorefill-option') || 'auto';
          autoRefillEnabled = key !== 'balance';
          render();
        });
      });

      bufferPanel.querySelector('[data-plan-buffer-confirm]')?.addEventListener('click', () => {
        // Keep buffer open underneath overview so "Back" returns to buffer.
        planOverviewApi.open({ fromBuffer: true });
      });

      const openLearnMore = () => {
        if (!learnMorePanel) return;
        const setLearnMoreTab = (tabKey) => {
          const activeTab = tabKey === 'reserved' ? 'reserved' : 'flexible';
          learnMoreTabButtons.forEach((btn) => {
            const on = (btn.getAttribute('data-plan-buffer-learn-more-tab') || 'flexible') === activeTab;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          learnMoreViews.forEach((view) => {
            const on = (view.getAttribute('data-plan-buffer-learn-more-view') || 'flexible') === activeTab;
            view.hidden = !on;
          });
        };
        setLearnMoreTab(method);
        learnMorePanel.hidden = false;
        requestAnimationFrame(() => learnMorePanel.classList.add('is-open'));
      };

      const closeLearnMore = (opts = {}) => {
        if (!learnMorePanel) return;
        if (opts.instant) {
          learnMorePanel.classList.remove('is-open');
          learnMorePanel.hidden = true;
          return;
        }
        learnMorePanel.classList.remove('is-open');
        const onEnd = () => {
          if (!learnMorePanel.classList.contains('is-open')) learnMorePanel.hidden = true;
          learnMorePanel.removeEventListener('transitionend', onEnd);
        };
        learnMorePanel.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 380);
      };

      learnMoreTrigger?.addEventListener('click', openLearnMore);
      learnMoreTabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-plan-buffer-learn-more-tab') || 'flexible';
          const activeTab = key === 'reserved' ? 'reserved' : 'flexible';
          learnMoreTabButtons.forEach((item) => {
            const on = (item.getAttribute('data-plan-buffer-learn-more-tab') || 'flexible') === activeTab;
            item.classList.toggle('is-active', on);
            item.setAttribute('aria-selected', on ? 'true' : 'false');
          });
          learnMoreViews.forEach((view) => {
            const on = (view.getAttribute('data-plan-buffer-learn-more-view') || 'flexible') === activeTab;
            view.hidden = !on;
          });
        });
      });
      learnMorePanel?.querySelectorAll('[data-plan-buffer-learn-more-close]')
        .forEach((btn) => btn.addEventListener('click', () => closeLearnMore()));

      return { open, close, sync: syncFromPlanDetail };
    };

    planBufferApi = initPlanBufferPanel();

    const initPlanEndConditionPanel = () => {
      const endPanel = panel.querySelector('[data-plan-end-condition-panel]');
      if (!endPanel) return { open: () => {}, close: () => {} };

      const ecScroller = endPanel.querySelector('.plan-buffer-panel__scroller');
      const ecMethodBtns = Array.from(endPanel.querySelectorAll('[data-plan-end-condition]'));
      /** @type {'continuous' | 'limit'} */
      let ecSelection = 'continuous';

      const syncFromPlanDetail = () => {
        const endEl = panel.querySelector('[data-plan-detail-repeats-end]');
        const endRaw = String(endEl?.dataset?.endConditionText || endEl?.textContent || '').trim();
        const useContinuous = !endRaw || /\bcontinuous\b|\bContinuous\b/i.test(endRaw);
        ecSelection = useContinuous ? 'continuous' : 'limit';
        ecMethodBtns.forEach((btn) => {
          const v = btn.getAttribute('data-plan-end-condition') === 'limit' ? 'limit' : 'continuous';
          const on = v === ecSelection;
          btn.classList.toggle('is-selected', on);
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      };

      const applySelectionToPlanDetail = () => {
        const endEl = panel.querySelector('[data-plan-detail-repeats-end]');
        if (!endEl) return;
        const setEndConditionText = (nextText) => {
          const next = String(nextText || '').trim();
          endEl.dataset.endConditionText = next;
          endEl.textContent = next;
        };
        if (ecSelection === 'continuous') {
          setEndConditionText('Continuous');
          scheduleSheetApi.planDetailRepeatsEndLimitText = '';
        } else {
          const cur = String(endEl.dataset.endConditionText || endEl.textContent || '').trim();
          if (/\bcontinuous\b|\bContinuous\b/i.test(cur) || !cur || !isPlanDetailSetLimitEnd(cur)) {
            setEndConditionText('40 buys ~ Ends Dec 31, 2026');
            scheduleSheetApi.planDetailRepeatsEndLimitText = String(endEl.dataset.endConditionText || endEl.textContent || '').trim();
          }
        }
        syncPlanDetailSetLimitDetailRowsVisibility();
        updateCoverageUI();
      };

      const open = () => {
        planBreakdownApi.close();
        planOverviewApi.close({ instant: true });
        planSuccessApi.forceClose();
        syncFromPlanDetail();
        if (ecScroller) ecScroller.scrollTop = 0;
        endPanel.hidden = false;
        requestAnimationFrame(() => endPanel.classList.add('is-open'));
      };

      const close = (opts = {}) => {
        if (opts.instant) {
          endPanel.classList.remove('is-open');
          endPanel.hidden = true;
          return;
        }
        endPanel.classList.remove('is-open');
        let done = false;
        const onEnd = () => {
          if (done) return;
          done = true;
          endPanel.removeEventListener('transitionend', onEnd);
          if (!endPanel.classList.contains('is-open')) endPanel.hidden = true;
        };
        endPanel.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 380);
      };

      endPanel.querySelector('[data-plan-end-condition-back]')?.addEventListener('click', () => close());

      ecMethodBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          ecSelection = btn.getAttribute('data-plan-end-condition') === 'limit' ? 'limit' : 'continuous';
          ecMethodBtns.forEach((b) => {
            const v = b.getAttribute('data-plan-end-condition') === 'limit' ? 'limit' : 'continuous';
            const on = v === ecSelection;
            b.classList.toggle('is-selected', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        });
      });

      endPanel.querySelector('[data-plan-end-condition-continue]')?.addEventListener('click', () => {
        applySelectionToPlanDetail();
        planBufferApi.open({ autofocusInput: true });
      });

      return { open, close, sync: syncFromPlanDetail };
    };

    planEndConditionApi = initPlanEndConditionPanel();

    // ── Open / close ──────────────────────────────────────────────────────────
    const setOpen = (nextOpen, openCtx = null) => {
      if (nextOpen) {
        // Entering plan detail from Finance → Auto-invest should always start
        // from the original plan name (discard any previously edited title).
        customPlanTitle = '';
        if (nameInput) nameInput.hidden = true;
        if (nameSpan) nameSpan.hidden = false;
        planBreakdownApi.close();
        planOverviewApi.close();
        planSuccessApi.forceClose();
        // When entering from the Finance wizard CTA (no openCtx) or from any non-plan
        // entrypoint (curated/spotlight/newplan), start with the preset allocation
        // instead of any stale custom override from a previous visit.
        if (!openCtx || (openCtx && openCtx.source && openCtx.source !== 'plan')) {
          detailAllocOverride = null;
          // Entering from Finance entrypoints should start with Buy now OFF.
          panel.dataset.scheduleBuyNow = '0';
        }
        panelOpenContext =
          openCtx?.source === 'newplan'
            ? { source: 'newplan' }
            : openCtx && openCtx.source === 'curated' && openCtx.curatedKey
              ? { source: 'curated', curatedKey: String(openCtx.curatedKey).toLowerCase(), card: openCtx.card }
              : openCtx && openCtx.source === 'spotlight' && openCtx.spotlightKey
                ? { source: 'spotlight', spotlightKey: String(openCtx.spotlightKey).toLowerCase(), card: openCtx.card }
                : { source: 'plan' };
        // Entering plan detail from Finance entrypoints should start with a fresh end condition.
        // Prevent previous "Set a limit" state from leaking across entries.
        const repeatsEndEl = panel.querySelector('[data-plan-detail-repeats-end]');
        if (repeatsEndEl) {
          repeatsEndEl.dataset.endConditionText = 'Continuous';
          repeatsEndEl.textContent = 'Continuous';
        }
        scheduleSheetApi.planDetailRepeatsEndLimitText = '';
        syncPlanDetailSetLimitDetailRowsVisibility();
        populatePanel();
        resetScrollState();
        // Always start with the Repeats "Details" disclosure collapsed (instant, no animation).
        // This avoids reopening the panel in an expanded state from a previous visit.
        {
          const detailsCollapse = panel.querySelector('[data-plan-detail-details-collapse]');
          const detailsToggle = panel.querySelector('[data-plan-detail-details-toggle]');
          const detailsChevron = panel.querySelector('[data-plan-detail-details-chevron]');
          const detailsBody = detailsCollapse?.querySelector('.plan-detail-panel__details-body');
          if (detailsCollapse && detailsToggle && detailsChevron) {
            if (detailsBody) {
              detailsBody.style.transition = 'none';
            }
            detailsCollapse.classList.remove('plan-detail-panel__details-collapse--expanded');
            detailsToggle.setAttribute('aria-expanded', 'false');
            detailsChevron.setAttribute('src', 'assets/icon_chevron_down_white.svg');
            if (detailsBody) {
              void detailsBody.offsetHeight;
              detailsBody.style.transition = '';
            }
          }
        }

        // Ensure stacked flow panels never "stick" open across visits.
        {
          const bufPanel = panel.querySelector('[data-plan-buffer-panel]');
          if (bufPanel) {
            bufPanel.classList.remove('is-open');
            bufPanel.hidden = true;
          }
          const ecPanel = panel.querySelector('[data-plan-end-condition-panel]');
          if (ecPanel) {
            ecPanel.classList.remove('is-open');
            ecPanel.hidden = true;
          }
        }

        panel.hidden = false;
        if (container) {
          container.classList.remove('is-plan-detail-open');
          container.classList.remove('is-plan-detail-fading');
        }
        requestAnimationFrame(() => { panel.classList.add('is-open'); });
        setTimeout(() => {
          if (container && panel.classList.contains('is-open')) {
            container.classList.add('is-plan-detail-fading');
          }
        }, 80);
        setTimeout(() => {
          if (container && panel.classList.contains('is-open')) {
            container.classList.add('is-plan-detail-open');
          }
        }, 350);
      } else {
        const instant = !!(openCtx && openCtx.instant);
        if (instant) {
          planBreakdownApi.close({ instant: true });
          planBufferApi.close({ instant: true });
          planEndConditionApi.close({ instant: true });
          planOverviewApi.close({ instant: true });
          planSuccessApi.forceClose();
          const submitLoader = panel.querySelector('[data-plan-submit-loader]');
          if (submitLoader) submitLoader.hidden = true;
          document.querySelector('[data-alloc-lock-tooltip]')?.classList.remove('is-visible');
          panelOpenContext = { source: 'plan' };
          panel.style.transition = 'none';
          panel.classList.remove('is-open');
          void panel.offsetHeight;
          panel.style.transition = '';
          panel.hidden = true;
          if (container) {
            container.classList.remove('is-plan-detail-open');
            container.classList.remove('is-plan-detail-fading');
          }
          const spotlightEl = document.querySelector('.spotlight__scroll');
          if (spotlightEl) spotlightEl.scrollLeft = 0;
          return;
        }
        planBreakdownApi.close();
        planBufferApi.close({ instant: true });
        planEndConditionApi.close({ instant: true });
        planOverviewApi.close();
        planSuccessApi.forceClose();
        const submitLoader = panel.querySelector('[data-plan-submit-loader]');
        if (submitLoader) submitLoader.hidden = true;
        document.querySelector('[data-alloc-lock-tooltip]')?.classList.remove('is-visible');
        panelOpenContext = { source: 'plan' };
        panel.classList.remove('is-open');
        if (container) {
          container.classList.add('is-plan-detail-fading');
          container.classList.remove('is-plan-detail-open');
          requestAnimationFrame(() => { container.classList.remove('is-plan-detail-fading'); });
        }
        const onEnd = () => {
          if (!panel.classList.contains('is-open')) panel.hidden = true;
          panel.removeEventListener('transitionend', onEnd);
        };
        panel.addEventListener('transitionend', onEnd);
        // Reset spotlight scroll position when returning to the Finance page
        const spotlightEl = document.querySelector('.spotlight__scroll');
        if (spotlightEl) spotlightEl.scrollLeft = 0;
      }
    };

    dismissPlanDetailStackInstant = () => {
      allocPickerApi.close({ instant: true });
      setOpen(false, { instant: true });
    };

    const initPlanSubmitSuccessFlow = () => {
      const loaderEl = panel.querySelector('[data-plan-submit-loader]');
      const successEl = panel.querySelector('[data-plan-success-panel]');
      const LOADER_MS = 1400;
      let submitGeneration = 0;

      const forceClose = () => {
        submitGeneration += 1;
        if (loaderEl) {
          loaderEl.hidden = true;
        }
        if (successEl) {
          successEl.classList.remove('is-open');
          successEl.hidden = true;
        }
        panel.classList.remove('is-plan-success-open');
      };

      const showLoader = () => {
        if (!loaderEl) return;
        loaderEl.hidden = false;
      };

      const hideLoader = () => {
        if (!loaderEl) return;
        loaderEl.hidden = true;
      };

      const buildFirstBuyLine = () => {
        const overviewFirstBuy = panel.querySelector('[data-plan-overview-first-buy]')?.textContent?.trim() || '';
        if (overviewFirstBuy && overviewFirstBuy !== '—') {
          return `First buy on ${overviewFirstBuy}`;
        }
        const sched = panel.querySelector('[data-plan-detail-schedule]')?.textContent?.trim() || '';
        const parts = sched.split('·').map((t) => t.trim()).filter(Boolean);
        const tail = parts.length > 1 ? parts.slice(1).join(' · ') : parts[0] || '';
        const timeMatch = tail.match(/at\s+~?\s*(\d{1,2}:\d{2})/i);
        const timeStr = timeMatch ? `~${timeMatch[1]}` : '~12:00';
        const dayMatch = tail.match(/(\d{1,2})(?:st|nd|rd|th)/i);
        if (!dayMatch && tail) {
          return `First buy on ${tail}`;
        }
        const day = dayMatch ? parseInt(dayMatch[1], 10) : 15;
        const t = new Date();
        if (t.getDate() >= day) t.setMonth(t.getMonth() + 1);
        t.setDate(day);
        const mon = t.toLocaleString('en-US', { month: 'short' });
        return `First buy on ${mon} ${day} at ${timeStr}`;
      };

      const syncSuccessCopy = () => {
        const freqKey = (
          document.querySelector('[data-plan-freq-item].is-active')?.getAttribute('data-plan-freq-item') || 'monthly'
        ).toLowerCase();
        const freqWord = freqKey === 'daily' ? 'daily' : freqKey === 'weekly' ? 'weekly' : 'monthly';
        const titleEl = successEl?.querySelector('[data-plan-success-title]');
        const prefundEl = successEl?.querySelector('[data-plan-success-prefund]');
        const subEl = successEl?.querySelector('[data-plan-success-sub]');
        if (titleEl) {
          titleEl.innerHTML = `Your ${freqWord}<br aria-hidden="true" />auto-invest plan is set`;
        }
        const selectedMethodBtn =
          panel.querySelector('[data-plan-buffer-method].is-selected') ||
          panel.querySelector('[data-plan-buffer-method][aria-pressed="true"]');
        const isReservedMethod = selectedMethodBtn?.getAttribute('data-plan-buffer-method') === 'reserved';
        if (prefundEl) {
          const reserveAmount =
            panel.querySelector('[data-plan-overview-prefund-amount]')?.textContent?.trim()
            || panel.querySelector('[data-plan-buffer-reserve-amt]')?.textContent?.trim()
            || '—';
          const cur = String(panel.querySelector('[data-plan-detail-currency]')?.textContent || currencyState.plan || 'USDT').trim();
          const hasCurrencySuffix = new RegExp(`\\b${cur}\\b$`, 'i').test(reserveAmount);
          prefundEl.textContent = reserveAmount === '—'
            ? `Reserved — ${cur}`
            : `Reserved ${hasCurrencySuffix ? reserveAmount : `${reserveAmount} ${cur}`}`;
          prefundEl.hidden = !isReservedMethod;
          prefundEl.style.display = isReservedMethod ? '' : 'none';
        }
        if (subEl) subEl.textContent = buildFirstBuyLine();
      };

      const openSuccess = () => {
        if (!successEl) return;
        syncSuccessCopy();
        panel.classList.add('is-plan-success-open');
        successEl.hidden = false;
        requestAnimationFrame(() => successEl.classList.add('is-open'));
      };

      const closeSuccess = () => {
        if (!successEl) return;
        successEl.classList.remove('is-open');
        const onEnd = () => {
          if (!successEl.classList.contains('is-open')) {
            successEl.hidden = true;
            panel.classList.remove('is-plan-success-open');
          }
          successEl.removeEventListener('transitionend', onEnd);
        };
        successEl.addEventListener('transitionend', onEnd);
        setTimeout(onEnd, 380);
      };

      panel.querySelector('[data-plan-overview-confirm]')?.addEventListener('click', () => {
        const gen = (submitGeneration += 1);
        showLoader();
        window.setTimeout(() => {
          if (gen !== submitGeneration) return;
          hideLoader();
          // Keep overview in place (still open under success); success z-index is higher so it
          // slides in over it—avoids the overview “popping off” before the submitted screen.
          if (gen !== submitGeneration) return;
          setState('flow', 2, { force: true });
          const overviewFirstBuy = panel.querySelector('[data-plan-overview-first-buy]')?.textContent?.trim() || '';
          const overviewReserved = panel.querySelector('[data-plan-overview-prefund-amount]')?.textContent?.trim() || '';
          const schedLine = panel.querySelector('[data-plan-detail-schedule]')?.textContent?.trim() || '';
          const nextCompact = formatFinanceNextBuyCompact(schedLine);
          const paymentMethod = panel.querySelector('[data-plan-overview-payment-method]')?.textContent?.trim() || 'Pay as you go';
          const runoutPolicy = panel.querySelector('[data-plan-overview-runout-value]')?.textContent?.trim() || '—';
          const repeatsValue = panel.querySelector('[data-plan-overview-repeats]')?.textContent?.trim() || schedLine || '—';
          const amountRaw = parseInt(
            String(panel.querySelector('[data-plan-detail-amount-input]')?.value || '').replace(/[^0-9]/g, ''),
            10,
          ) || 0;
          const cur = String(panel.querySelector('[data-plan-detail-currency]')?.textContent || currencyState.plan || 'TWD').trim();
          const freqKey = (
            document.querySelector('[data-plan-freq-item].is-active')?.getAttribute('data-plan-freq-item') || 'monthly'
          ).toLowerCase();
          const cadence = freqKey === 'daily' ? 'day' : freqKey === 'weekly' ? 'week' : 'month';
          const isReservedPlan = /\bset aside funds\b/i.test(paymentMethod);
          if (overviewFirstBuy && overviewFirstBuy !== '—') {
            financeSummaryConfirmedNextBuy = overviewFirstBuy;
          } else if (nextCompact) {
            financeSummaryConfirmedNextBuy = nextCompact;
          }
          financeSummaryConfirmedReserved = parseMoneyWithCurrency(overviewReserved);
          myPlansSubmittedPlan = {
            id: `plan-active-${Date.now()}`,
            status: 'active',
            name: panel.querySelector('[data-plan-detail-name]')?.textContent?.trim() || 'Your plan',
            investLine: amountRaw > 0 ? `${amountRaw.toLocaleString('en-US')} ${cur} each ${cadence}` : `— ${cur} each ${cadence}`,
            repeats: repeatsValue,
            firstBuy: (overviewFirstBuy && overviewFirstBuy !== '—') ? overviewFirstBuy : (nextCompact || '—'),
            fundingMethod: paymentMethod,
            isReserved: isReservedPlan,
            reservedFunds: overviewReserved || '—',
            runoutPolicy: runoutPolicy || '—',
          };
          applyFinanceSummaryMeta();
          myPlansPanelApi.sync?.();
          openSuccess();
        }, LOADER_MS);
      });

      const leaveSuccessToFinanceAuto = () => {
        planOverviewApi.close({ instant: true });
        forceClose();
        setOpen(false);
        goFinanceAutoInvestFromSuccess();
      };

      const leaveSuccessToMyPlans = () => {
        openMyPlansAfterPlanFlow();
      };

      successEl?.querySelectorAll('[data-plan-success-dismiss]').forEach((b) => {
        b.addEventListener('click', leaveSuccessToFinanceAuto);
      });

      successEl?.querySelector('[data-plan-success-view-plan]')?.addEventListener('click', leaveSuccessToMyPlans);

      return { close: closeSuccess, forceClose };
    };

    planSuccessApi = initPlanSubmitSuccessFlow();

    if (openBtn) openBtn.addEventListener('click', () => setOpen(true));
    if (newPlanBtn) {
      newPlanBtn.addEventListener('click', () => {
        // Always reset custom title when starting a fresh New plan flow.
        customPlanTitle = '';
        setOpen(true, { source: 'newplan' });
        setTimeout(() => {
          const inp = panel.querySelector('[data-plan-detail-amount-input]');
          inp?.focus();
        }, 380);
      });
    }
    closeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const ld = panel.querySelector('[data-plan-submit-loader]');
        if (ld && !ld.hidden) {
          planSuccessApi.forceClose();
          return;
        }
        const sep = panel.querySelector('[data-plan-success-panel]');
        if (sep?.classList.contains('is-open')) {
          planSuccessApi.close();
          return;
        }
        const ovp = panel.querySelector('[data-plan-overview-panel]');
        if (ovp?.classList.contains('is-open')) {
          planOverviewApi.close();
          return;
        }
        const bufP = panel.querySelector('[data-plan-buffer-panel]');
        if (bufP?.classList.contains('is-open')) {
          planBufferApi.close();
          return;
        }
        const ecP = panel.querySelector('[data-plan-end-condition-panel]');
        if (ecP?.classList.contains('is-open')) {
          planEndConditionApi.close();
          return;
        }
        setOpen(false);
      });
    });
    panel.addEventListener('click', (e) => {
      const addAssetsBtn = e.target.closest('.plan-detail-panel__add-assets');
      if (!addAssetsBtn) return;
      e.preventDefault();
      const emptyEntry = !!addAssetsBtn.closest('.plan-detail-panel__alloc-empty');
      allocPickerApi.open(emptyEntry ? { emptyEntry: true } : {});
    });

    document.querySelectorAll('.curated-portfolios__card').forEach((card) => {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      const openFromCard = () => {
        const key = card.getAttribute('data-curated-key');
        if (!key) return;
        setOpen(true, { source: 'curated', curatedKey: key, card });
        setTimeout(() => {
          const inp = panel.querySelector('[data-plan-detail-amount-input]');
          inp?.focus();
        }, 380);
      };
      card.addEventListener('click', openFromCard);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFromCard();
        }
      });
    });

    // Spotlight crypto pills → open detail panel with empty auto-invest amount.
    const spotlightScrollEl = document.querySelector('.spotlight__scroll');
    document.querySelectorAll('.crypto-pill').forEach((pill) => {
      pill.setAttribute('role', 'button');
      pill.setAttribute('tabindex', '0');
      const openFromPill = () => {
        // Suppress click if the user was dragging
        if (spotlightScrollEl?._getDidDrag?.()) return;
        const key = pill.getAttribute('data-spotlight-key');
        if (!key) return;
        setOpen(true, { source: 'spotlight', spotlightKey: key, card: pill });
        setTimeout(() => {
          const inp = panel.querySelector('[data-plan-detail-amount-input]');
          inp?.focus();
        }, 380);
      };
      pill.addEventListener('click', openFromPill);
      pill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFromPill();
        }
      });
    });

    // ── Amount input ──────────────────────────────────────────────────────────
    const amountInput = panel.querySelector('[data-plan-detail-amount-input]');
    const detailBreakdownLinkBtn = panel.querySelector('.plan-detail-panel__view-breakdown-link');

    const formatWithCommas = (n) => n.toLocaleString('en-US');

    // Recalculate the footer return using the same logic as the main widget,
    // but reading the amount from this panel's input instead of the slider.
    // The observer is disconnected during the update to prevent infinite loops.
    let returnObserver = null;
    const mainReturnAbsEl = document.querySelector('.plan-strategy__return-abs');
    const observerOpts = { childList: true, characterData: true, subtree: true };
    const syncDetailBreakdownLinkState = () => {
      if (!detailBreakdownLinkBtn) return;
      const amount = parseInt(amountInput?.value?.replace(/[^0-9]/g, '') || '0', 10);
      const allocCount = parseInt(
        panel.querySelector('[data-plan-detail-alloc-count]')?.textContent?.trim() || '0',
        10,
      ) || 0;
      const hasAmount = Number.isFinite(amount) && amount > 0;
      const hasAssets = allocCount > 0;
      const allocRoot = getActiveAllocMultiRoot();
      let isPctAllocInvalid = false;
      if (
        allocRoot
        && allocCount >= 2
        && !allocRoot.classList.contains('alloc-multi--amount-mode')
        && !allocRoot.classList.contains('alloc-multi--auto')
      ) {
        const rows = allocRoot.querySelectorAll('.alloc-multi__item [data-alloc-pct-input]');
        let sumPct = 0;
        rows.forEach((inp) => {
          const v = parseInt(String(inp.value || '').replace(/[^0-9]/g, ''), 10);
          if (!isNaN(v)) sumPct += v;
        });
        isPctAllocInvalid = Math.abs(sumPct - 100) > 0.51;
      }
      const disabled = !(hasAmount && hasAssets) || isPctAllocInvalid;
      detailBreakdownLinkBtn.disabled = disabled;
    };

    const updateDetailReturn = () => {
      const ctx = panelOpenContext;
      const amount = parseInt(amountInput?.value?.replace(/[^0-9]/g, '') || '0', 10);
      const titleEl = panel.querySelector('[data-plan-detail-return-title]');
      const currEl = panel.querySelector('[data-plan-detail-return-currency]');
      syncDetailBreakdownLinkState();

      // Always recalculate coverage whenever amount or currency changes
      updateCoverageUI();
      syncPlanDetailContinueState();

      if (ctx.source === 'newplan' && !detailAllocOverride?.items?.length) {
        // No allocation yet — show blank return footer
        const absEl = panel.querySelector('[data-plan-detail-return-abs]');
        const pctEl = panel.querySelector('[data-plan-detail-return-pct]');
        const histPctEl = panel.querySelector('[data-plan-detail-return-historic-pct]');
        const autoHistPctEl = panel.querySelector('[data-plan-detail-alloc-auto-historic-pct]');
        const simPctInlineEl = panel.querySelector('.plan-detail-panel__return-pct-inline.plan-return-metric__pct-line--simulated');
        const histIcons = panel.querySelector('[data-plan-detail-return-asset-icons]');
        const histCap = panel.querySelector('[data-plan-detail-return-historic-caption]');
        const stratCap = panel.querySelector('[data-plan-detail-return-strategy-caption]');
        if (absEl) absEl.textContent = '- -';
        if (currEl) currEl.hidden = true;
        if (simPctInlineEl) simPctInlineEl.hidden = true;
        if (pctEl) {
          pctEl.textContent = '0.0% return';
          pctEl.removeAttribute('data-alloc-base-pct');
        }
        if (histPctEl) {
          histPctEl.textContent = '0.0%';
          histPctEl.removeAttribute('data-alloc-base-hist-pct');
        }
        if (autoHistPctEl) autoHistPctEl.textContent = '0.0%';
        setReturnMetricIconWrapHtml(histIcons, '', { layoutSig: '' });
        if (histCap) histCap.textContent = 'Price change';
        if (stratCap) stratCap.textContent = 'Return';
        if (absEl) absEl.removeAttribute('data-alloc-base-abs');
        if (titleEl) titleEl.textContent = document.querySelector('[data-plan-return-title]')?.textContent || titleEl.textContent;
        if (currEl) currEl.textContent = document.querySelector('[data-plan-return-currency]')?.textContent || currEl.textContent;
        panel.querySelectorAll('.plan-detail-panel__return-metrics-col.plan-return-metric__group').forEach((g) => {
          g.classList.remove('plan-return-metric__group--loss');
          g.querySelectorAll('.plan-return-metric__arrow').forEach((a) => {
            a.classList.remove('plan-return-metric__arrow--down');
            if (a.classList.contains('plan-return-metric__arrow--historic')) {
              a.src = RETURN_METRIC_ARROW_HIST_POS;
            }
          });
        });
        return;
      }

      const overrideCuratedKey =
        detailAllocOverride?.kind === 'curated' && detailAllocOverride.key
          ? String(detailAllocOverride.key).toLowerCase()
          : '';
      const effectiveCuratedKey = (ctx.source === 'curated' && ctx.curatedKey)
        ? String(ctx.curatedKey).toLowerCase()
        : overrideCuratedKey;

      if (effectiveCuratedKey) {
        if (returnObserver) returnObserver.disconnect();
        const freqItemCurated = document.querySelector('[data-plan-freq-item].is-active');
        const freqCurated = (freqItemCurated?.getAttribute('data-plan-freq-item') || 'monthly').toLowerCase();
        updatePlanStrategyHistoricalReturn({
          detailPanel: true,
          amount,
          planKey: effectiveCuratedKey,
          freq: freqCurated,
          displayAssets: getCurrentPlanDisplayAssets('assets/icon_currency_btc.svg'),
        });
        if (titleEl) {
          titleEl.textContent = document.querySelector('[data-plan-return-title]')?.textContent || titleEl.textContent;
        }
        if (currEl) {
          currEl.textContent = document.querySelector('[data-plan-return-currency]')?.textContent || currEl.textContent;
        }
        if (returnObserver && mainReturnAbsEl) returnObserver.observe(mainReturnAbsEl, observerOpts);
        snapshotFooterAllocBases();
        applyFooterAllocSliderTweak();
        return;
      }

      if (ctx.source === 'spotlight' && ctx.spotlightKey) {
        if (returnObserver) returnObserver.disconnect();
        const freqItemSpot = document.querySelector('[data-plan-freq-item].is-active');
        const freqSpot = (freqItemSpot?.getAttribute('data-plan-freq-item') || 'monthly').toLowerCase();
        updatePlanStrategyHistoricalReturn({
          detailPanel: true,
          amount,
          planKey: ctx.spotlightKey,
          freq: freqSpot,
          displayAssets: getCurrentPlanDisplayAssets('assets/icon_currency_btc.svg'),
        });
        if (titleEl) {
          titleEl.textContent = document.querySelector('[data-plan-return-title]')?.textContent || titleEl.textContent;
        }
        if (currEl) {
          currEl.textContent = document.querySelector('[data-plan-return-currency]')?.textContent || currEl.textContent;
        }
        if (returnObserver && mainReturnAbsEl) returnObserver.observe(mainReturnAbsEl, observerOpts);
        snapshotFooterAllocBases();
        applyFooterAllocSliderTweak();
        return;
      }

      const slider = document.querySelector('[data-plan-slider]');
      if (slider) {
        if (returnObserver) returnObserver.disconnect();
        const prev = slider.getAttribute('aria-valuenow');
        slider.setAttribute('aria-valuenow', String(amount));
        updatePlanStrategyHistoricalReturn();
        slider.setAttribute('aria-valuenow', prev);
        syncFooterFromMainWidget();
        if (returnObserver && mainReturnAbsEl) returnObserver.observe(mainReturnAbsEl, observerOpts);
        snapshotFooterAllocBases();
        applyFooterAllocSliderTweak();
      }
    };

    document.addEventListener('plan-investment-currency-updated', () => {
      if (!panel.classList.contains('is-open')) return;
      updateDetailReturn();
      panel._planDetailAllocRefreshAmounts?.();
      panel._planDetailAutoAllocRefreshAmounts?.();
    });

    document.addEventListener('prototype-smart-allocation-toggle', () => {
      syncActiveAllocationVariant();
      if (!panel.classList.contains('is-open')) return;
      // Refresh allocation row values before return/continue sync so active variant inputs are current.
      panel._planDetailAllocRefreshAmounts?.();
      panel._planDetailAutoAllocRefreshAmounts?.();
      updateDetailReturn();
      syncPlanDetailContinueState();
      if (panel.querySelector('[data-plan-overview-panel]')?.classList.contains('is-open')) {
        planOverviewApi.sync();
      }
      if (document.querySelector('[data-plan-breakdown-panel]')?.classList.contains('is-open')) {
        planBreakdownApi.sync();
      }
      if (document.querySelector('[data-plan-detail-continue-sheet]')?.classList.contains('is-open')) {
        syncContinueSheetSummary();
      }
    });

    document.addEventListener('plan-schedule-confirmed', () => {
      updatePlanStrategyHistoricalReturn();
      if (panel.classList.contains('is-open')) {
        updateCoverageUI();
        updateDetailReturn();
        if (panel.querySelector('[data-plan-overview-panel]')?.classList.contains('is-open')) {
          planOverviewApi.sync();
        }
      }
    });

    // Watch main widget's return-abs — fires when range or currency changes externally.
    if (mainReturnAbsEl) {
      returnObserver = new MutationObserver(() => {
        if (panel.classList.contains('is-open')) updateDetailReturn();
      });
      returnObserver.observe(mainReturnAbsEl, observerOpts);
    }

    if (amountInput) {
      // Apply live comma formatting, preserving cursor position.
      // Cursor math: track digit-index before the cursor, then re-find it in the
      // newly formatted string (commas shift absolute position).
      const applyLiveFormat = () => {
        const cursor = amountInput.selectionStart;
        const oldVal = amountInput.value;

        // How many digits sit before the cursor in the current (possibly formatted) value
        const digitsBeforeCursor = oldVal.slice(0, cursor).replace(/[^0-9]/g, '').length;

        const MAX_AMOUNT = 99999999;
        const raw = oldVal.replace(/[^0-9]/g, '');
        if (!raw) { amountInput.value = ''; return; }

        const clamped = Math.min(parseInt(raw, 10), MAX_AMOUNT);
        const formatted = clamped.toLocaleString('en-US');
        amountInput.value = formatted;

        // Walk the formatted string to find the new cursor position
        let newCursor = 0;
        let digitsSeen = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (digitsSeen === digitsBeforeCursor) { newCursor = i; break; }
          if (formatted[i] !== ',') digitsSeen++;
          newCursor = i + 1;
        }
        amountInput.setSelectionRange(newCursor, newCursor);
      };

      const setDisplayValue = (n) => {
        amountInput.value = isNaN(n) || n <= 0 ? '' : n.toLocaleString('en-US');
      };

      // Set initial formatted value
      const initialRaw = parseInt(amountInput.value.replace(/[^0-9]/g, ''), 10);
      setDisplayValue(initialRaw);
      syncDetailBreakdownLinkState();

      amountInput.addEventListener('focus', () => {
        const labelEl = amountInput
          .closest('.plan-detail-panel__amount-section')
          ?.querySelector('.plan-detail-panel__section-label');
        //scrollPlanDetailContentTo(labelEl, 0);
      });

      // Input: reformat live + update return
      amountInput.addEventListener('input', () => {
        applyLiveFormat();
        updateDetailReturn();
        panel._planDetailAllocRefreshAmounts?.();
        panel._planDetailAutoAllocRefreshAmounts?.();
        const bp = document.querySelector('[data-plan-breakdown-panel]');
        if (bp?.classList.contains('is-open')) planBreakdownApi.sync();
        const op = panel.querySelector('[data-plan-overview-panel]');
        if (op?.classList.contains('is-open')) planOverviewApi.sync();
      });

      // Blur: handle empty/invalid
      amountInput.addEventListener('blur', () => {
        const raw = parseInt(amountInput.value.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(raw) && raw > 0) {
          setDisplayValue(raw);
        } else {
          // Keep 0/empty as empty; do not repopulate from the main page slider.
          amountInput.value = '';
        }
        updateDetailReturn();
        panel._planDetailAllocRefreshAmounts?.();
        panel._planDetailAutoAllocRefreshAmounts?.();
        const bp = document.querySelector('[data-plan-breakdown-panel]');
        if (bp?.classList.contains('is-open')) planBreakdownApi.sync();
        const op = panel.querySelector('[data-plan-overview-panel]');
        if (op?.classList.contains('is-open')) planOverviewApi.sync();
      });

      // Block non-numeric keys (commas are inserted programmatically, not typed)
      amountInput.addEventListener('keydown', (e) => {
        const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'];
        if (allowed.includes(e.key)) return;
        if (e.ctrlKey || e.metaKey) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
      });
    }

    // Repeats card: collapsible "Details" (coverage rows) — Figma 8527:4738 / 8527:4757
    const detailsCollapse = panel.querySelector('[data-plan-detail-details-collapse]');
    const detailsToggle = panel.querySelector('[data-plan-detail-details-toggle]');
    const detailsChevron = panel.querySelector('[data-plan-detail-details-chevron]');
    if (detailsCollapse && detailsToggle && detailsChevron) {
      detailsToggle.addEventListener('click', () => {
        const expanded = detailsCollapse.classList.toggle('plan-detail-panel__details-collapse--expanded');
        detailsToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        detailsChevron.setAttribute(
          'src',
          expanded ? 'assets/icon_chevron_up_white.svg' : 'assets/icon_chevron_down_white.svg',
        );
      });
    }

    document.addEventListener('plan-schedule-confirmed', () => {
      syncPlanDetailSetLimitDetailRowsVisibility();
    });

    // ── Currency pill: trigger the shared investment currency bottom sheet ────
    // The pill already has data-currency-sheet-trigger="plan" in HTML, so
    // initCurrencySheet() will wire it up automatically. We only need to ensure
    // the panel's currency label and icon stay in sync after the sheet closes.
    // We hook into the existing updatePlanCurrencyUI by extending it.
    const _origUpdatePlanCurrencyUI = typeof updatePlanCurrencyUI === 'function' ? updatePlanCurrencyUI : null;
    if (_origUpdatePlanCurrencyUI) {
      // Patch: after the main UI updates, also refresh the panel's currency pill + icon
      const origRef = updatePlanCurrencyUI;
      // Override at the outer closure level isn't possible here, so observe via MutationObserver
      const planCurrencyLabelMain = document.querySelector('[data-plan-currency-label]');
      if (planCurrencyLabelMain) {
        const obs = new MutationObserver(() => {
          const cur = planCurrencyLabelMain.textContent.trim();
          const detailCur = panel.querySelector('[data-plan-detail-currency]');
          const detailIcon = panel.querySelector('[data-plan-detail-amount-icon]');
          if (detailCur) detailCur.textContent = cur;
          if (detailIcon) detailIcon.src = cur === 'USDT' ? 'assets/icon_currency_usdt.svg' : 'assets/icon_currency_TWD.svg';
          updateCoverageUI();
          panel._planDetailAllocRefreshAmounts?.();
          panel._planDetailAutoAllocRefreshAmounts?.();
        });
        obs.observe(planCurrencyLabelMain, { childList: true, characterData: true, subtree: true });
      }
    }
  };

  initPlanDetailPanel({
    goFinanceAutoInvest,
    openMyPlansAfterPlanFlow: () => {
      myPlansPanelApi.open({ fromPlanSuccessView: true });
    },
  });

  initPrototypeReset();
  syncPrototypeFinanceCurrencySelectorVisible();

  // Drag-to-scroll for spotlight crypto grid.
  // Uses document-level move/up listeners (NOT pointer capture) so that:
  //   a) dragging continues smoothly when the pointer leaves the element, and
  //   b) child .crypto-pill click events are never swallowed by capture.
  const spotlightScroll = document.querySelector('.spotlight__scroll');
  if (spotlightScroll) {
    const DRAG_THRESHOLD = 6; // px of movement before we call it a drag
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let didDrag = false;

    spotlightScroll.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      isDown = true;
      startX = e.clientX;
      scrollLeft = spotlightScroll.scrollLeft;
      didDrag = false;
      spotlightScroll.classList.add('is-dragging');
    });

    document.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const delta = startX - e.clientX;
      if (Math.abs(delta) > DRAG_THRESHOLD) {
        didDrag = true;
        spotlightScroll.scrollLeft = scrollLeft + delta;
      }
    });

    const stopDrag = () => {
      if (!isDown) return;
      isDown = false;
      spotlightScroll.classList.remove('is-dragging');
      // Reset after the click event has had a chance to fire
      setTimeout(() => { didDrag = false; }, 50);
    };

    document.addEventListener('pointerup', stopDrag);
    document.addEventListener('pointercancel', stopDrag);

    // Expose drag state for pill click guard
    spotlightScroll._getDidDrag = () => didDrag;
  }

  const initHeaderScrollSwap = () => {
    const header = document.querySelector('.app-header');
    const topChrome = document.querySelector('.top-chrome');
    const scroller = document.querySelector('.content');
    if (!header || !scroller) return;

    let isScrolled = false;
    let ticking = false;
    const threshold = 4;

    const apply = () => {
      const shouldBeScrolled = scroller.scrollTop > threshold;
      if (shouldBeScrolled !== isScrolled) {
        isScrolled = shouldBeScrolled;
        header.classList.toggle('is-scrolled', isScrolled);
        if (topChrome) topChrome.classList.toggle('is-scrolled', isScrolled);
      }
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    apply();
  };

  initHeaderScrollSwap();

  const initFinanceIntroLearnMorePanel = () => {
    const triggers = Array.from(document.querySelectorAll('.finance-intro__link'));
    const panelEl = document.querySelector('[data-finance-intro-learn-more-panel]');
    if (!triggers.length || !panelEl) return;
    const titleEl = panelEl.querySelector('[data-finance-intro-learn-more-title]');
    const descEl = panelEl.querySelector('[data-finance-intro-learn-more-desc]');
    const visualEl = panelEl.querySelector('[data-finance-intro-learn-more-visual]');
    const stepEls = Array.from(panelEl.querySelectorAll('[data-finance-intro-step]'));
    const backBtn = panelEl.querySelector('[data-finance-intro-learn-more-back]');
    const nextBtn = panelEl.querySelector('[data-finance-intro-learn-more-next]');
    const slides = [
      {
        title: 'Invest automatically: The easiest way to dollar-cost average',
        desc: 'Set a fixed amount and invest on a schedule. No need to time the market, just stay consistent.',
        visual: 'assets/finance_intro_step_1.svg',
      },
      {
        title: 'Pick from coins, curated portfolios, or build your own',
        desc: 'Start quickly with ready-made options, or customize allocations that match your conviction.',
        visual: 'assets/finance_intro_step_2.svg',
      },
      {
        title: 'Track your plan and adjust anytime',
        desc: 'Review performance, edit funding and schedule settings, and keep your strategy running.',
        visual: 'assets/finance_intro_step_3.svg',
      },
    ];
    let activeStep = 0;

    const renderStep = () => {
      const safe = Math.max(0, Math.min(slides.length - 1, activeStep));
      activeStep = safe;
      const slide = slides[safe];
      if (titleEl) titleEl.textContent = slide.title;
      if (descEl) descEl.textContent = slide.desc;
      if (visualEl && slide.visual) visualEl.setAttribute('src', slide.visual);
      stepEls.forEach((el, idx) => el.classList.toggle('is-active', idx <= safe));
      if (backBtn) backBtn.hidden = safe === 0;
      if (backBtn) backBtn.disabled = false;
      if (nextBtn) nextBtn.classList.toggle('finance-intro-learn-more-panel__btn--full', safe === 0);
      if (nextBtn) nextBtn.textContent = safe === slides.length - 1 ? 'Done' : 'Next';
    };

    const open = () => {
      activeStep = 0;
      renderStep();
      panelEl.hidden = false;
      requestAnimationFrame(() => panelEl.classList.add('is-open'));
    };

    const close = (opts = {}) => {
      if (opts.instant) {
        panelEl.classList.remove('is-open');
        panelEl.hidden = true;
        return;
      }
      panelEl.classList.remove('is-open');
      const onEnd = () => {
        if (!panelEl.classList.contains('is-open')) panelEl.hidden = true;
        panelEl.removeEventListener('transitionend', onEnd);
      };
      panelEl.addEventListener('transitionend', onEnd);
      setTimeout(onEnd, 380);
    };

    triggers.forEach((trigger) => trigger.addEventListener('click', open));
    backBtn?.addEventListener('click', () => {
      if (activeStep <= 0) {
        close();
        return;
      }
      activeStep -= 1;
      renderStep();
    });
    nextBtn?.addEventListener('click', () => {
      if (activeStep >= slides.length - 1) {
        close();
        return;
      }
      activeStep += 1;
      renderStep();
    });
    panelEl.querySelectorAll('[data-finance-intro-learn-more-close]')
      .forEach((btn) => btn.addEventListener('click', () => close()));
  };

  initFinanceIntroLearnMorePanel();

  const initFinanceIntroStateControls = () => {
    let forceToCompactTimer = null;
    let dismissAnimating = false;
    const introEl = document.querySelector('.finance-intro');
    const firstStateEl = document.querySelector('[data-finance-intro-state="1"]');
    const compactStateEl = document.querySelector('[data-finance-intro-state="2"]');
    document.querySelector('[data-finance-intro-dismiss]')?.addEventListener('click', () => {
      if (dismissAnimating) return;
      dismissAnimating = true;

      const roundPx = (n) => Math.max(0, Math.round(Number(n) || 0));
      const firstHeight = roundPx(firstStateEl?.getBoundingClientRect().height);
      let compactHeight = firstHeight;

      if (introEl && firstHeight > 0) {
        introEl.style.height = `${firstHeight}px`;
        introEl.classList.add('is-transitioning');
        // Force sync layout so height transition runs on next write.
        void introEl.offsetHeight;
      }

      if (compactStateEl) {
        const wasHidden = compactStateEl.hidden;
        const prevStyle = compactStateEl.getAttribute('style') || '';
        compactStateEl.hidden = false;
        compactStateEl.style.visibility = 'hidden';
        compactStateEl.style.pointerEvents = 'none';
        compactHeight = roundPx(compactStateEl.getBoundingClientRect().height) || firstHeight;
        if (wasHidden) compactStateEl.hidden = true;
        if (prevStyle) compactStateEl.setAttribute('style', prevStyle);
        else compactStateEl.removeAttribute('style');
      }

      setState('financeIntro', 2, { force: true });
      if (introEl && compactHeight > 0) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            introEl.style.height = `${compactHeight}px`;
          });
        });
      }

      let finishFallbackTimer = 0;
      let teardownDone = false;
      const onHeightTransitionEnd = (e) => {
        if (e.target !== introEl || e.propertyName !== 'height') return;
        window.clearTimeout(finishFallbackTimer);
        finishDismiss();
      };
      const finishDismiss = () => {
        if (teardownDone) return;
        teardownDone = true;
        if (introEl) {
          introEl.removeEventListener('transitionend', onHeightTransitionEnd);
          introEl.classList.remove('is-transitioning');
          introEl.style.height = '';
        }
        dismissAnimating = false;
      };
      if (introEl) introEl.addEventListener('transitionend', onHeightTransitionEnd);
      // Match .finance-intro.is-transitioning height duration (0.26s) + small buffer
      finishFallbackTimer = window.setTimeout(finishDismiss, 360);
    });
    document.querySelector('[data-finance-intro-how-it-works-first]')?.addEventListener('click', () => {
      if (forceToCompactTimer) clearTimeout(forceToCompactTimer);
      // Let the tutorial panel open first, then persist intro as compact state.
      forceToCompactTimer = setTimeout(() => {
        setState('financeIntro', 2, { force: true });
      }, 260);
    });
  };

  initFinanceIntroStateControls();

  const initSideMenu = () => {
    const container = document.querySelector('.phone-container');
    const trigger = document.querySelector('[data-menu-trigger]');
    const overlay = document.querySelector('.side-menu-overlay');
    const scrollable = document.querySelector('.side-menu__content');
    if (!container || !trigger || !overlay) return;

    const openMenu = () => {
      container.classList.add('is-menu-open');
      if (scrollable) scrollable.scrollTop = 0;
    };
    const closeMenu = () => container.classList.remove('is-menu-open');

    trigger.addEventListener('click', openMenu);
    overlay.addEventListener('click', (event) => {
      if (event.target.closest('[data-menu-close]')) closeMenu();
    });
  };

  initSideMenu();

  /** Desktop viewport only: show a sliding fake keyboard when a field inside the phone is focused. */
  const initFakeKeyboard = () => {
    const container = document.querySelector('.phone-container');
    const keyboard = document.querySelector('[data-fake-keyboard]');
    if (!container || !keyboard) return;

    const mq = window.matchMedia('(min-width: 641px)');
    const nonKeyboardInputTypes = new Set([
      'button', 'submit', 'reset', 'hidden', 'checkbox', 'radio', 'file', 'image', 'range', 'color',
    ]);

    const isKeyboardField = (el) => {
      if (!el || el.closest('[data-fake-keyboard]')) return false;
      if (el.disabled || el.getAttribute('aria-hidden') === 'true') return false;
      const tag = el.tagName;
      if (tag === 'TEXTAREA') return true;
      if (tag === 'SELECT') return true;
      if (tag !== 'INPUT') return false;
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      return !nonKeyboardInputTypes.has(t);
    };

    const show = () => {
      if (!mq.matches) return;
      keyboard.classList.add('is-visible');
      keyboard.setAttribute('aria-hidden', 'false');
    };

    const hide = () => {
      keyboard.classList.remove('is-visible');
      keyboard.setAttribute('aria-hidden', 'true');
    };

    container.addEventListener('focusin', (e) => {
      if (!mq.matches) return;
      if (!isKeyboardField(e.target)) return;
      show();
    });

    container.addEventListener('focusout', () => {
      if (!mq.matches) return;
      requestAnimationFrame(() => {
        const ae = document.activeElement;
        if (!container.contains(ae) || !isKeyboardField(ae)) hide();
      });
    });

    const onMqChange = () => {
      if (!mq.matches) hide();
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onMqChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onMqChange);
    }
  };

  initFakeKeyboard();

  try {
    window.prototypeStates = {
      get: (group) => states[group],
      set: (group, value) => setState(group, value),
      change: (group, delta) => changeState(group, delta),
      label: (group, value) => getLabel(group, value),
    };
  } catch (_) {
    // ignore exposure errors
  }
})();
