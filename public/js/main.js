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
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const states = {};

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
    if (group === 'flow') syncFinanceSummaryVisibility();
    return clamped;
  };

  const changeState = (group, delta) => setState(group, states[group] + (delta || 0));

  const initStates = () => {
    Object.keys(STATE_CONFIGS).forEach((group) => {
      const config = STATE_CONFIGS[group];
      const clamped = clamp(config.min, config.min, config.max);
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

  const initPrototypeReset = () => {
    const resetBtn = document.querySelector('[data-prototype-reset]');
    if (!resetBtn) return;
    resetBtn.addEventListener('click', () => {
      Object.keys(STATE_CONFIGS).forEach((group) => {
        setState(group, STATE_CONFIGS[group].min, { force: true });
      });
    });
  };

  const initTabs = () => {
    const content = document.querySelector('[data-content]');
    const tabButtons = Array.from(document.querySelectorAll('[data-tab-target]'));
    const tabViews = Array.from(document.querySelectorAll('[data-tab-view]'));
    const openTabTriggers = Array.from(document.querySelectorAll('[data-open-tab]'));

    if (!content || tabViews.length === 0) return;

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
  };

  const initFinanceHeaderTabs = () => {
    const tabButtons = Array.from(document.querySelectorAll('[data-finance-header-tab]'));
    const pages = Array.from(document.querySelectorAll('[data-finance-page]'));
    if (tabButtons.length === 0 || pages.length === 0) return;

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

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.detailPanel] — write to plan-detail footer only (do not change main widget)
   * @param {number} [opts.amount] — override slider amount
   * @param {string} [opts.planKey] — override carousel plan (e.g. curated basket)
   * @param {string} [opts.freq] — 'daily' | 'weekly' | 'monthly' (override active freq chip)
   */
  const updatePlanStrategyHistoricalReturn = (opts = {}) => {
    const detailPanel = !!opts.detailPanel;
    const pctEl = detailPanel
      ? document.querySelector('[data-plan-detail-return-pct]')
      : document.querySelector('.plan-strategy__return-pct');
    const absEl = detailPanel
      ? document.querySelector('[data-plan-detail-return-abs]')
      : document.querySelector('.plan-strategy__return-abs');
    const slider = document.querySelector('[data-plan-slider]');
    const freqActive = document.querySelector('[data-plan-freq-item].is-active');
    const carousel = document.querySelector('[data-plan-carousel]');
    if (!pctEl || !absEl) return;
    if (!detailPanel && (!slider || !freqActive)) return;

    const amount = opts.amount !== undefined
      ? opts.amount
      : parseInt(slider.getAttribute('aria-valuenow') || '0', 10);
    const freq = (opts.freq || freqActive?.getAttribute('data-plan-freq-item') || 'monthly').toLowerCase();
    const activePlan = opts.planKey
      ? String(opts.planKey).toLowerCase()
      : (carousel?.getAttribute('data-active-plan') || 'bitcoin').toLowerCase();

    // Rough offline DCA estimate over 5Y anchor data (Jan 2020 → Dec 2024).
    // Shorter ranges (3Y / 1Y) start later into the same dataset.
    const fxTwdPerUsd = 32; // intentionally fixed/rough
    const totalDataMonths = 60; // full anchor dataset length
    const rangeMonthsMap = { '5Y': 60, '3Y': 36, '1Y': 12 };
    const periodMonths = rangeMonthsMap[(typeof rangeState !== 'undefined' ? rangeState.plan : '5Y')] || 60;
    const startMonth = totalDataMonths - periodMonths;
    const months = totalDataMonths; // used for anchor clamping

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
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

    // Rough anchor curves (USD) used for offline, directional simulations.
    const anchorsByPlan = {
      bitcoin: [
        { m: 0, usd: 9000 },
        { m: 11, usd: 29000 },
        { m: 23, usd: 47000 },
        { m: 35, usd: 16500 },
        { m: 47, usd: 42000 },
        { m: 59, usd: 52000 },
      ],
      ethereum: [
        { m: 0, usd: 180 },
        { m: 11, usd: 740 },
        { m: 23, usd: 3700 },
        { m: 35, usd: 1200 },
        { m: 47, usd: 2300 },
        { m: 59, usd: 2800 },
      ],
      solana: [
        { m: 0, usd: 1.6 },
        { m: 11, usd: 2.0 },
        { m: 23, usd: 170 },
        { m: 35, usd: 10 },
        { m: 47, usd: 95 },
        { m: 59, usd: 110 },
      ],
      digitalgold: [
        { m: 0, usd: 1550 },
        { m: 11, usd: 1900 },
        { m: 23, usd: 1800 },
        { m: 35, usd: 1950 },
        { m: 47, usd: 2050 },
        { m: 59, usd: 2150 },
      ],
    };

    const interpolateUsd = (anchors, m) => {
      const month = clamp(m, 0, months - 1);
      let i = 0;
      while (i < anchors.length - 1 && month > anchors[i + 1].m) i += 1;
      const a = anchors[i];
      const b = anchors[Math.min(i + 1, anchors.length - 1)];
      if (!a || !b) return anchors[anchors.length - 1].usd;
      if (a.m === b.m) return a.usd;
      const t = (month - a.m) / (b.m - a.m);
      return a.usd + t * (b.usd - a.usd);
    };

    const priceUsdAtMonth = (planKey, m) => {
      if (planKey === 'bigthree') {
        const btc = interpolateUsd(anchorsByPlan.bitcoin, m);
        const eth = interpolateUsd(anchorsByPlan.ethereum, m);
        const sol = interpolateUsd(anchorsByPlan.solana, m);
        const btc0 = interpolateUsd(anchorsByPlan.bitcoin, 0);
        const eth0 = interpolateUsd(anchorsByPlan.ethereum, 0);
        const sol0 = interpolateUsd(anchorsByPlan.solana, 0);
        // Weighted normalized basket index (BTC 45% / ETH 35% / SOL 20%).
        return 100 * ((btc / btc0) * 0.45 + (eth / eth0) * 0.35 + (sol / sol0) * 0.2);
      }
      if (planKey === 'aiessentials') {
        // Prototype: RENDER / NEAR / SOL style basket → SOL-heavy + ETH + BTC blend
        const btc = interpolateUsd(anchorsByPlan.bitcoin, m);
        const eth = interpolateUsd(anchorsByPlan.ethereum, m);
        const sol = interpolateUsd(anchorsByPlan.solana, m);
        const btc0 = interpolateUsd(anchorsByPlan.bitcoin, 0);
        const eth0 = interpolateUsd(anchorsByPlan.ethereum, 0);
        const sol0 = interpolateUsd(anchorsByPlan.solana, 0);
        return 100 * ((btc / btc0) * 0.2 + (eth / eth0) * 0.3 + (sol / sol0) * 0.5);
      }
      const anchors = anchorsByPlan[planKey] || anchorsByPlan.bitcoin;
      return interpolateUsd(anchors, m);
    };

    const isUsdt = (typeof currencyState !== 'undefined' ? currencyState.plan : 'TWD') === 'USDT';
    const fxMultiplier = isUsdt ? 1 : fxTwdPerUsd;

    const occurrencesPerMonth = (() => {
      if (freq === 'daily') return 365.0 / 12.0; // ≈ 30.42
      if (freq === 'weekly') return 52.0 / 12.0; // ≈ 4.33
      return 1.0; // monthly
    })();

    const investPerMonth = amount * occurrencesPerMonth;
    const totalInvested = investPerMonth * periodMonths;

    let assetAccum = 0;
    for (let m = startMonth; m < months; m += 1) {
      const priceLocal = priceUsdAtMonth(activePlan, m) * fxMultiplier;
      if (priceLocal <= 0) continue;
      assetAccum += investPerMonth / priceLocal;
    }

    const endPriceLocal = priceUsdAtMonth(activePlan, months - 1) * fxMultiplier;
    const finalValue = assetAccum * endPriceLocal;
    const profit = finalValue - totalInvested;
    const returnPct = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    absEl.textContent = `${profit >= 0 ? '+' : '-'}${formatTwdNumber(profit)}`;
    pctEl.textContent = formatPct(returnPct);
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
      return mx === mn ? 0 : (v - mn) / (mx - mn);
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
  const rangeState = { plan: '5Y', curated: '5Y', spotlight: '5Y' };

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
  };

  const updatePlanCurrencyUI = () => {
    const cur = currencyState.plan;
    const isUsdt = cur === 'USDT';

    // Labels
    document.querySelectorAll('[data-plan-currency-label]').forEach((el) => { el.textContent = cur; });
    document.querySelectorAll('[data-plan-return-currency]').forEach((el) => { el.textContent = ` ${cur}`; });

    // Amount icon
    const amountIcon = document.querySelector('[data-plan-amount-icon]');
    if (amountIcon) {
      amountIcon.src = isUsdt ? 'assets/icon_currency_usdt.svg' : 'assets/icon_currency_TWD.svg';
    }

    // Slider range
    const slider = document.querySelector('[data-plan-slider]');
    if (slider) {
      const min = isUsdt ? 15 : 500;
      const max = isUsdt ? 3000 : 100000;
      const defaultVal = isUsdt ? 300 : 10000;
      slider.setAttribute('data-min', String(min));
      slider.setAttribute('data-max', String(max));
      slider.setAttribute('aria-valuemin', String(min));
      slider.setAttribute('aria-valuemax', String(max));

      const clamped = defaultVal;
      if (typeof slider._planSliderSetValue === 'function') {
        slider._planSliderSetValue(clamped);
      } else {
        slider.setAttribute('aria-valuenow', String(clamped));
      }
    }

    // updatePlanStrategyHistoricalReturn is called by setValue above; skip if slider existed
    if (!slider || typeof slider._planSliderSetValue !== 'function') {
      updatePlanStrategyHistoricalReturn();
    }
  };

  const initCurrencySheet = () => {
    const sheet = document.querySelector('[data-currency-sheet]');
    if (!sheet) return;

    const panel = sheet.querySelector('.currency-sheet__panel');
    const titleEl = sheet.querySelector('[data-currency-sheet-title]');
    const options = sheet.querySelectorAll('[data-currency-sheet-option]');
    let currentContext = null;

    const setSelected = (value) => {
      options.forEach((opt) => {
        opt.classList.toggle('is-selected', opt.getAttribute('data-currency-sheet-option') === value);
      });
    };

    const open = (context) => {
      currentContext = context;
      const isSummary = context === 'summary';
      if (titleEl) titleEl.textContent = isSummary ? 'Display currency' : 'Investment currency';
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
      setTimeout(onEnd, 400);
    };

    // Open triggers
    document.querySelectorAll('[data-currency-sheet-trigger]').forEach((btn) => {
      btn.addEventListener('click', () => open(btn.getAttribute('data-currency-sheet-trigger')));
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
        if (currentContext === 'plan') updatePlanCurrencyUI();
        close();
      });
    });
  };
  const updateRangeUI = (context, range) => {
    document.querySelectorAll(`[data-range-label="${context}"]`).forEach((el) => { el.textContent = range; });
    if (context === 'plan') {
      document.querySelectorAll('[data-plan-return-title]').forEach((el) => {
        el.textContent = `${range} historical return ≈`;
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
      setTimeout(onEnd, 400);
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
        close();
      });
    });
  };
  // ─────────────────────────────────────────────────────────────────────────────

  initStates();
  initBadgeControls();
  initTabs();
  initFinanceHeaderTabs();
  initFinanceSectionNav();
  initPlanStrategySlider();
  initPlanStrategyFreq();
  initPlanStrategyCarousel();
  initLimitsPanel();
  initCurrencySheet();
  initRangeSheet();

  // ─── Plan Detail Panel ──────────────────────────────────────────────────────
  const initPlanDetailPanel = () => {
    const panel = document.querySelector('[data-plan-detail-panel]');
    const container = document.querySelector('.phone-container');
    if (!panel) return;

    /** @type {{ source: 'plan' | 'curated', curatedKey?: string, card?: Element }} */
    let panelOpenContext = { source: 'plan' };

    const openBtn = document.querySelector('.plan-strategy__cta');
    const closeButtons = panel.querySelectorAll('[data-plan-detail-close]');
    const scroller = panel.querySelector('[data-plan-detail-scroller]');
    const productArea = panel.querySelector('[data-plan-detail-product-area]');
    const header = panel.querySelector('[data-plan-detail-header]');
    const pageTitle = panel.querySelector('[data-plan-detail-page-title]');

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

    // Sync all footer return elements from the main widget's currently displayed values.
    const syncFooterFromMainWidget = () => {
      const absEl = panel.querySelector('[data-plan-detail-return-abs]');
      const currEl = panel.querySelector('[data-plan-detail-return-currency]');
      const titleEl = panel.querySelector('[data-plan-detail-return-title]');
      const pctEl = panel.querySelector('[data-plan-detail-return-pct]');
      if (absEl) absEl.textContent = document.querySelector('.plan-strategy__return-abs')?.textContent || absEl.textContent;
      if (currEl) currEl.textContent = document.querySelector('[data-plan-return-currency]')?.textContent || currEl.textContent;
      if (titleEl) titleEl.textContent = document.querySelector('[data-plan-return-title]')?.textContent || titleEl.textContent;
      if (pctEl) pctEl.textContent = document.querySelector('.plan-strategy__return-pct')?.textContent || pctEl.textContent;
    };

    const populatePanel = () => {
      const ctx = panelOpenContext;
      const cur = currencyState.plan;
      const carousel = document.querySelector('[data-plan-carousel]');
      let planKey = (carousel?.getAttribute('data-active-plan') || 'bitcoin').toLowerCase();
      let title = 'Bitcoin';
      let iconSrc = 'assets/icon_currency_btc.svg';
      let ticker = 'BTC';

      const amountInput = panel.querySelector('[data-plan-detail-amount-input]');

      if (ctx.source === 'curated' && ctx.curatedKey && ctx.card) {
        planKey = ctx.curatedKey.toLowerCase();
        const card = ctx.card;
        title = card.querySelector('.curated-portfolios__name')?.textContent?.trim() || 'Portfolio';
        ticker = card.querySelector('.curated-portfolios__tickers')?.textContent?.trim() || planTicker[planKey] || '';
        iconSrc = card.querySelector('.curated-portfolios__icon')?.getAttribute('src') || iconSrc;
        if (amountInput) amountInput.value = '';
      } else {
        const activeSlide = carousel?.querySelector('[data-plan-carousel-item].swiper-slide-active')
          || carousel?.querySelector('[data-plan-carousel-item]');
        planKey = (carousel?.getAttribute('data-active-plan') || 'bitcoin').toLowerCase();
        title = activeSlide?.getAttribute('data-title') || 'Bitcoin';
        iconSrc = activeSlide?.querySelector('img')?.getAttribute('src') || 'assets/icon_currency_btc.svg';
        ticker = planTicker[planKey] || 'BTC';
        const amountRaw = document.querySelector('[data-plan-amount]')?.textContent?.replace(/,/g, '') || '10000';
        if (amountInput) {
          const amountNum = parseInt(amountRaw, 10);
          amountInput.value = !isNaN(amountNum) ? amountNum.toLocaleString('en-US') : amountRaw;
        }
      }

      // Product hero
      panel.querySelector('[data-plan-detail-name]').textContent = title;
      panel.querySelector('[data-plan-detail-ticker]').textContent = ticker;
      panel.querySelector('[data-plan-detail-icon]').src = iconSrc;

      // Collapsed header state
      panel.querySelector('[data-plan-detail-header-name]').textContent = title;
      panel.querySelector('[data-plan-detail-header-ticker]').textContent = ticker;
      panel.querySelector('[data-plan-detail-header-icon]').src = iconSrc;

      panel.querySelector('[data-plan-detail-currency]').textContent = cur;
      panel.querySelector('[data-plan-detail-amount-icon]').src =
        cur === 'USDT' ? 'assets/icon_currency_usdt.svg' : 'assets/icon_currency_TWD.svg';

      // Coverage currency labels
      panel.querySelectorAll('[data-plan-detail-coverage-currency], [data-plan-detail-coverage-currency2]')
        .forEach((el) => { el.textContent = cur; });

      // Repeats schedule
      const freqLabels = { daily: 'Daily · every day at 12:00', weekly: 'Weekly · Mon at 12:00', monthly: 'Monthly · 15th at 12:00' };
      const scheduleEl = panel.querySelector('[data-plan-detail-schedule]');
      if (scheduleEl) {
        if (ctx.source === 'curated') {
          scheduleEl.textContent = freqLabels.monthly;
        } else {
          const freqItem = document.querySelector('[data-plan-freq-item].is-active');
          const freqKey = (freqItem?.getAttribute('data-plan-freq-item') || 'monthly').toLowerCase();
          scheduleEl.textContent = freqLabels[freqKey] || freqLabels.monthly;
        }
      }

      // Return footer: full sync from main widget only for carousel "Use this plan" flow
      if (ctx.source === 'curated') {
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
      const allocItems = planAllocation[planKey] || planAllocation.bitcoin;
      allocList.innerHTML = allocItems.map((item) => `
        <div class="plan-detail-panel__alloc-item">
          <img class="plan-detail-panel__alloc-icon" src="${item.icon}" alt="" />
          <div class="plan-detail-panel__alloc-info">
            <span class="plan-detail-panel__alloc-name">${item.name}</span>
            <span class="plan-detail-panel__alloc-ticker">${item.ticker}</span>
          </div>
        </div>`).join('');
      if (allocCountEl) allocCountEl.textContent = String(allocItems.length);
      const addAssetsBtn = panel.querySelector('.plan-detail-panel__add-assets');
      if (addAssetsBtn) {
        addAssetsBtn.textContent =
          allocItems.length > 1 ? 'Add / remove assets' : 'Add assets';
      }

      if (ctx.source === 'curated') {
        // Amount 0 + curated basket → footer return from detail calculation only
        updateDetailReturn();
      }
    };

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

    // ── Open / close ──────────────────────────────────────────────────────────
    const setOpen = (nextOpen, openCtx = null) => {
      if (nextOpen) {
        panelOpenContext = openCtx && openCtx.source === 'curated' && openCtx.curatedKey
          ? { source: 'curated', curatedKey: String(openCtx.curatedKey).toLowerCase(), card: openCtx.card }
          : { source: 'plan' };
        populatePanel();
        resetScrollState();
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
      }
    };

    if (openBtn) openBtn.addEventListener('click', () => setOpen(true));
    closeButtons.forEach((btn) => btn.addEventListener('click', () => setOpen(false)));

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
          if (inp && inp.value === '') inp.select();
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

    // ── Amount input ──────────────────────────────────────────────────────────
    const amountInput = panel.querySelector('[data-plan-detail-amount-input]');

    const formatWithCommas = (n) => n.toLocaleString('en-US');

    // Recalculate the footer return using the same logic as the main widget,
    // but reading the amount from this panel's input instead of the slider.
    // The observer is disconnected during the update to prevent infinite loops.
    let returnObserver = null;
    const mainReturnAbsEl = document.querySelector('.plan-strategy__return-abs');
    const observerOpts = { childList: true, characterData: true, subtree: true };

    const updateDetailReturn = () => {
      const ctx = panelOpenContext;
      const amount = parseInt(amountInput?.value?.replace(/[^0-9]/g, '') || '0', 10);

      if (ctx.source === 'curated' && ctx.curatedKey) {
        if (returnObserver) returnObserver.disconnect();
        updatePlanStrategyHistoricalReturn({
          detailPanel: true,
          amount,
          planKey: ctx.curatedKey,
          freq: 'monthly',
        });
        const titleEl = panel.querySelector('[data-plan-detail-return-title]');
        const currEl = panel.querySelector('[data-plan-detail-return-currency]');
        if (titleEl) {
          titleEl.textContent = document.querySelector('[data-plan-return-title]')?.textContent || titleEl.textContent;
        }
        if (currEl) {
          currEl.textContent = document.querySelector('[data-plan-return-currency]')?.textContent || currEl.textContent;
        }
        if (returnObserver && mainReturnAbsEl) returnObserver.observe(mainReturnAbsEl, observerOpts);
        return;
      }

      if (!amount) return;

      const slider = document.querySelector('[data-plan-slider]');
      if (slider) {
        if (returnObserver) returnObserver.disconnect();
        const prev = slider.getAttribute('aria-valuenow');
        slider.setAttribute('aria-valuenow', String(amount));
        updatePlanStrategyHistoricalReturn();
        slider.setAttribute('aria-valuenow', prev);
        syncFooterFromMainWidget();
        if (returnObserver && mainReturnAbsEl) returnObserver.observe(mainReturnAbsEl, observerOpts);
      }
    };

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

      // Focus: just select all (value is already formatted — no need to strip)
      amountInput.addEventListener('focus', () => amountInput.select());

      // Input: reformat live + update return
      amountInput.addEventListener('input', () => {
        applyLiveFormat();
        updateDetailReturn();
      });

      // Blur: handle empty/invalid
      amountInput.addEventListener('blur', () => {
        const raw = parseInt(amountInput.value.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(raw) && raw > 0) {
          setDisplayValue(raw);
        } else if (panelOpenContext.source === 'curated') {
          amountInput.value = '';
        } else {
          const fallbackRaw = parseInt(
            document.querySelector('[data-plan-amount]')?.textContent?.replace(/,/g, '') || '10000', 10
          );
          setDisplayValue(fallbackRaw);
        }
        updateDetailReturn();
      });

      // Block non-numeric keys (commas are inserted programmatically, not typed)
      amountInput.addEventListener('keydown', (e) => {
        const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'];
        if (allowed.includes(e.key)) return;
        if (e.ctrlKey || e.metaKey) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
      });
    }

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
          const coverageCurrencies = panel.querySelectorAll('[data-plan-detail-coverage-currency], [data-plan-detail-coverage-currency2]');
          if (detailCur) detailCur.textContent = cur;
          if (detailIcon) detailIcon.src = cur === 'USDT' ? 'assets/icon_currency_usdt.svg' : 'assets/icon_currency_TWD.svg';
          coverageCurrencies.forEach((el) => { el.textContent = cur; });
        });
        obs.observe(planCurrencyLabelMain, { childList: true, characterData: true, subtree: true });
      }
    }
  };

  initPlanDetailPanel();

  initPrototypeReset();

  // Drag-to-scroll for spotlight crypto grid
  const spotlightScroll = document.querySelector('.spotlight__scroll');
  if (spotlightScroll) {
    let isDragging = false;
    let startX = 0;
    let scrollLeft = 0;

    spotlightScroll.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.pageX - spotlightScroll.offsetLeft;
      scrollLeft = spotlightScroll.scrollLeft;
      spotlightScroll.classList.add('is-dragging');
    });

    const stopDrag = () => {
      isDragging = false;
      spotlightScroll.classList.remove('is-dragging');
    };

    spotlightScroll.addEventListener('mouseleave', stopDrag);
    spotlightScroll.addEventListener('mouseup', stopDrag);

    spotlightScroll.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const x = e.pageX - spotlightScroll.offsetLeft;
      const delta = x - startX;
      spotlightScroll.scrollLeft = scrollLeft - delta;
    });
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
