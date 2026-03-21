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

    // Map spotlight crypto keys → the closest existing anchor curves.
    // This lets the detail panel reuse the same offline return simulation.
    const activeAnchorPlan = (() => {
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
      return map[activePlan] || activePlan;
    })();

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

    // Use a unit amount for % calculation so it is independent of the invested
    // amount — DCA return % is scale-invariant (only timing matters, not size).
    const unitPerMonth = occurrencesPerMonth;

    let assetAccum = 0;
    let unitAccum = 0;
    for (let m = startMonth; m < months; m += 1) {
      const priceLocal = priceUsdAtMonth(activeAnchorPlan, m) * fxMultiplier;
      if (priceLocal <= 0) continue;
      assetAccum += investPerMonth / priceLocal;
      unitAccum  += unitPerMonth  / priceLocal;
    }

    const endPriceLocal = priceUsdAtMonth(activeAnchorPlan, months - 1) * fxMultiplier;
    const finalValue = assetAccum * endPriceLocal;
    const profit = finalValue - totalInvested;

    const unitTotalInvested = unitPerMonth * periodMonths;
    const unitFinalValue    = unitAccum * endPriceLocal;
    const returnPct = unitTotalInvested > 0
      ? ((unitFinalValue - unitTotalInvested) / unitTotalInvested) * 100
      : 0;

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
    const options = sheet.querySelectorAll('[data-currency-sheet-option]');
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
      setTimeout(onEnd, 400);
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

  /** Plan detail: auto-invest schedule sheet (currency-sheet chrome). */
  const initScheduleSheet = () => {
    const sheet = document.querySelector('[data-schedule-sheet]');
    if (!sheet) return;

    const panel = sheet.querySelector('.currency-sheet__panel');
    const planDetail = document.querySelector('[data-plan-detail-panel]');
    const freqButtons = sheet.querySelectorAll('[data-schedule-freq]');
    const timingLabelEl = sheet.querySelector('[data-schedule-timing-label]');
    const timingValueEl = sheet.querySelector('[data-schedule-timing-value]');
    const endButtons = sheet.querySelectorAll('[data-schedule-end]');

    const timingSectionLabels = {
      daily: 'Every day at',
      weekly: 'Every week on',
      monthly: 'Every month on',
    };
    const defaultTimingDetail = {
      daily: '12:00',
      weekly: 'Mon at 12:00',
      monthly: '15th at 12:00',
    };
    const freqSchedulePrefix = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

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

    const parseFreqFromScheduleText = (text) => {
      const head = (text || '').split('·')[0]?.trim().toLowerCase() || '';
      if (head.startsWith('daily')) return 'daily';
      if (head.startsWith('weekly')) return 'weekly';
      return 'monthly';
    };

    const parseTimingFromScheduleText = (text, freq) => {
      const parts = (text || '').split('·').map((s) => s.trim());
      if (parts.length >= 2) return parts.slice(1).join(' · ');
      return defaultTimingDetail[freq];
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
        timingValueEl.textContent = scheduleText
          ? parseTimingFromScheduleText(scheduleText, freq)
          : defaultTimingDetail[freq];
      }

      let end = 'continuous';
      const endText = endEl?.textContent?.trim() || '';
      if (endText === 'End on date') end = 'enddate';
      else if (endText.startsWith('After')) end = 'buys';
      setEndUI(end);

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
      if (scheduleEl) scheduleEl.textContent = `${prefix} · ${timing}`;
      if (endEl) {
        if (end === 'continuous') endEl.textContent = 'Continuous';
        else if (end === 'enddate') endEl.textContent = 'End on date';
        else endEl.textContent = 'After number of buys';
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

    freqButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const freq = (btn.getAttribute('data-schedule-freq') || 'monthly').toLowerCase();
        setFreqUI(freq);
        if (timingLabelEl) timingLabelEl.textContent = timingSectionLabels[freq] || timingSectionLabels.monthly;
        if (timingValueEl) timingValueEl.textContent = defaultTimingDetail[freq];
      });
    });

    endButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        setEndUI(btn.getAttribute('data-schedule-end') || 'continuous');
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
  initTopupSheet();
  initScheduleSheet();

  /** Fictional % delta from plan-detail allocation sliders (prototype feel). */
  let detailPanelAllocPctTweakFn = null;
  let refreshPlanDetailAllocTweak = () => {};

  // ─── Plan Detail Panel ──────────────────────────────────────────────────────
  const initPlanDetailPanel = () => {
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
      if (pctEl) {
        const raw = parseFloat(String(pctEl.textContent).replace(/[^0-9.\-]/g, ''));
        if (isFinite(raw)) pctEl.dataset.allocBasePct = String(raw);
      }
      if (absEl) {
        const profit = parseDetailFooterAbsText(absEl.textContent);
        if (isFinite(profit)) absEl.dataset.allocBaseAbs = String(profit);
      }
    };

    const applyFooterAllocSliderTweak = () => {
      const pctEl = panel.querySelector('[data-plan-detail-return-pct]');
      const absEl = panel.querySelector('[data-plan-detail-return-abs]');
      if (!pctEl || typeof detailPanelAllocPctTweakFn !== 'function') return;
      const base = parseFloat(pctEl.dataset.allocBasePct || '');
      if (!isFinite(base)) return;
      const tw = detailPanelAllocPctTweakFn();
      if (!isFinite(tw)) return;
      const nextPct = base + tw;
      pctEl.textContent = `${nextPct.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;

      if (absEl) {
        const baseAbs = parseFloat(absEl.dataset.allocBaseAbs || '');
        if (isFinite(baseAbs) && Math.abs(base) > 1e-6) {
          const nextAbs = baseAbs * (nextPct / base);
          const sign = nextAbs >= 0 ? '+' : '-';
          absEl.textContent = `${sign}${formatDetailFooterProfit(Math.abs(nextAbs))}`;
        }
      }
    };

    refreshPlanDetailAllocTweak = () => {
      if (panel.classList.contains('is-open')) applyFooterAllocSliderTweak();
    };

    /** @type {{ source: 'plan' | 'curated' | 'spotlight' | 'newplan', curatedKey?: string, spotlightKey?: string, card?: Element }} */
    let panelOpenContext = { source: 'plan' };

    const openBtn = document.querySelector('.plan-strategy__cta');
    const newPlanBtn = document.querySelector('.finance-summary__btn--primary');
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

    // Static balances for the prototype
    const BALANCES = { TWD: 75000, USDT: 2750 };

    // Recalculate "Avail." + "Available X covers ≈ N buys" from balance ÷ per-buy amount.
    const updateCoverageUI = () => {
      const cur = currencyState.plan;
      const balance = BALANCES[cur] ?? BALANCES.TWD;

      // "Avail. 15,000 TWD"
      const availEl = panel.querySelector('.plan-detail-panel__avail-text');
      if (availEl) {
        availEl.innerHTML = `Avail. ${balance.toLocaleString('en-US')} <span data-plan-detail-coverage-currency>${cur}</span>`;
      }

      // "Available TWD covers ≈ X"
      const coverageLabelEl = panel.querySelector('.plan-detail-panel__coverage-label');
      if (coverageLabelEl) {
        coverageLabelEl.innerHTML = `Available <span data-plan-detail-coverage-currency2>${cur}</span> covers ≈`;
      }

      const coverageValueEl = panel.querySelector('.plan-detail-panel__coverage-value');
      const errorEl = panel.querySelector('[data-plan-detail-amount-error]');
      const errorCurEl = errorEl?.querySelector('[data-plan-detail-error-currency]');

      // Keep error currency label in sync
      if (errorCurEl) errorCurEl.textContent = cur;

      const setError = (isError) => {
        if (coverageValueEl) coverageValueEl.style.color = isError ? '#EB5347' : '';
        if (errorEl) errorEl.classList.toggle('is-visible', isError);
      };

      if (!coverageValueEl) return;

      const amount = parseInt(amountInput?.value?.replace(/[^0-9]/g, '') || '0', 10);
      if (!amount || amount <= 0) {
        coverageValueEl.textContent = '—';
        setError(false);
        return;
      }

      // How many buys fit in the available balance (same for daily / weekly / monthly).
      const buys = Math.floor(balance / amount);

      if (buys === 0) {
        coverageValueEl.textContent = '0 buys';
        setError(true);
        return;
      }

      setError(false);
      coverageValueEl.textContent = `${buys.toLocaleString('en-US')} buy${buys !== 1 ? 's' : ''}`;
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

    // ── Multi-asset allocation sliders ────────────────────────────────────────
    // Called after multi-asset HTML is rendered into the allocation list.
    // Manages per-asset % sliders, % inputs, and the lock feature (3-asset only).
    const initAllocSliders = (panelEl, count) => {
      const allocPanelAbortKey = '_allocPanelControlsAbort';
      if (panelEl[allocPanelAbortKey]) panelEl[allocPanelAbortKey].abort();

      if (count < 2) {
        detailPanelAllocPctTweakFn = null;
        panelEl._planDetailAllocRefreshAmounts = null;
        const resetBtnEarly = panelEl.querySelector('[data-alloc-reset]');
        if (resetBtnEarly) resetBtnEarly.hidden = true;
        return;
      }

      const panelAc = new AbortController();
      panelEl[allocPanelAbortKey] = panelAc;
      const panelCtlSignal = panelAc.signal;

      // Hide stale lock tooltip when switching to a 2-asset plan
      if (count < 3) {
        document.querySelector('[data-alloc-lock-tooltip]')?.classList.remove('is-visible');
      }

      const defaultPcts = count === 2 ? [50, 50] : [34, 33, 33];
      const pcts = [...defaultPcts];
      const locked = new Array(count).fill(false);

      const svgUnlock = `<img src="assets/icon_unlock.svg" width="20" height="20" alt="" />`;
      const svgLock = `<img src="assets/icon_lock.svg" width="20" height="20" alt="" />`;

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
        if (inputMode === 'amount') {
          const total = getPlanDetailInvestTotal();
          const cur = getPlanDetailCurrency();
          const numStr = total > 0 ? total.toLocaleString('en-US') : '0';
          el.textContent = `Total ${numStr} ${cur}`;
        } else {
          el.textContent = 'Total 100%';
        }
      };

      const renderItem = (i) => {
        const item = items[i];
        if (!item) return;
        const fill = item.querySelector('[data-alloc-fill]');
        const thumb = item.querySelector('[data-alloc-thumb]');
        const input = item.querySelector('[data-alloc-pct-input]');
        const lockBtn = item.querySelector('[data-alloc-lock-btn]');
        const symbolEl = item.querySelector('.alloc-multi__pct-symbol');
        const p = pcts[i] / 100;
        const isLocked = locked[i];

        if (fill) fill.style.width = `${p * 100}%`;
        if (thumb) thumb.style.left = `calc(${p * 100}% - ${p * 24}px)`;
        if (symbolEl) {
          symbolEl.textContent = inputMode === 'amount' ? getPlanDetailCurrency() : '%';
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
          } else {
            input.value = String(Math.round(pcts[i]));
            input.setAttribute('aria-label', 'Allocation percent');
          }
        }

        // Toggle locked class on the row for CSS-driven visual + pointer blocking
        item.classList.toggle('is-locked', isLocked);

        // Lock icon: toggle class every frame; swap img src only when needed (no innerHTML — avoids blink)
        if (lockBtn) {
          lockBtn.classList.toggle('is-locked', isLocked);
          const lockSrc = 'assets/icon_lock.svg';
          const unlockSrc = 'assets/icon_unlock.svg';
          const img = lockBtn.querySelector('img');
          if (!img) {
            lockBtn.innerHTML = isLocked ? svgLock : svgUnlock;
          } else {
            const cur = img.getAttribute('src') || '';
            const wantFile = isLocked ? 'icon_lock.svg' : 'icon_unlock.svg';
            if (!cur.endsWith(wantFile)) img.setAttribute('src', isLocked ? lockSrc : unlockSrc);
          }
          lockBtn.setAttribute('aria-label', isLocked ? 'Unlock allocation' : 'Lock allocation');
        }
      };

      const isAtDefaultAllocation = () =>
        pcts.every((p, i) => Math.abs(p - defaultPcts[i]) < 0.45);

      const updateAllocResetVisibility = () => {
        const btn = panelEl.querySelector('[data-alloc-reset]');
        if (!btn) return;
        const anyLock = locked.some((x) => x);
        btn.hidden = isAtDefaultAllocation() && !anyLock;
      };

      const renderAll = () => {
        items.forEach((_, i) => renderItem(i));
        updateAllocResetVisibility();
        updateAllocHeaderSubtitle();
        syncAllocAmountWrapDisabled();
      };

      // Tooltip when a 3-asset lock caps how far another slider can move.
      // Lives inside .plan-detail-panel__content so it scrolls with the page.
      const contentEl = panelEl.querySelector('.plan-detail-panel__content');
      const scrollRoot = panelEl.querySelector('[data-plan-detail-scroller]');
      let tipEl = contentEl?.querySelector('[data-alloc-lock-tooltip]')
        || document.querySelector('[data-alloc-lock-tooltip]');
      if (!tipEl) {
        tipEl = document.createElement('div');
        tipEl.className = 'alloc-multi__lock-tooltip';
        tipEl.setAttribute('data-alloc-lock-tooltip', '');
        tipEl.setAttribute('role', 'tooltip');
      }
      if (contentEl) contentEl.appendChild(tipEl);

      let hideTooltipTimer = null;
      /** @type {Element | null} */
      let lastTooltipAnchor = null;

      const clipBoundsEl =
        panelEl.closest('.phone-container') || scrollRoot || panelEl;

      /** Position tooltip on the knob, nudge horizontally to stay inside clip bounds, aim arrow at knob. */
      const updateAllocLockTooltipPosition = () => {
        if (!lastTooltipAnchor || !tipEl || !contentEl) return;
        const a = lastTooltipAnchor.getBoundingClientRect();
        const c = contentEl.getBoundingClientRect();
        const left = a.left - c.left + a.width / 2;
        const top = a.top - c.top;
        tipEl.style.left = `${left}px`;
        tipEl.style.top = `${top}px`;
        tipEl.style.setProperty('--alloc-tip-nudge', '0px');

        const bounds = clipBoundsEl.getBoundingClientRect();
        const margin = 8;
        const knobCX = a.left + a.width / 2;

        void tipEl.offsetWidth;
        const W = tipEl.getBoundingClientRect().width;
        const idealLeft = knobCX - W / 2;
        const minL = bounds.left + margin;
        const maxL = bounds.right - margin - W;
        const clampedLeft = maxL >= minL
          ? Math.max(minL, Math.min(maxL, idealLeft))
          : minL;
        const nudge = clampedLeft - idealLeft;
        tipEl.style.setProperty('--alloc-tip-nudge', `${nudge}px`);

        void tipEl.offsetWidth;
        const finalR = tipEl.getBoundingClientRect();
        let arrowLeft = knobCX - finalR.left;
        const pad = 18;
        arrowLeft = Math.max(pad, Math.min(finalR.width - pad, arrowLeft));
        tipEl.style.setProperty('--alloc-tip-arrow-left', `${arrowLeft}px`);
      };

      const hideAllocLockTooltip = () => {
        lastTooltipAnchor = null;
        if (hideTooltipTimer) {
          clearTimeout(hideTooltipTimer);
          hideTooltipTimer = null;
        }
        tipEl.classList.remove('is-visible');
        tipEl.style.removeProperty('--alloc-tip-nudge');
        tipEl.style.removeProperty('--alloc-tip-arrow-left');
      };

      const resetAllocLockTooltipAutoHide = () => {
        if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
        hideTooltipTimer = setTimeout(() => {
          tipEl.classList.remove('is-visible');
          lastTooltipAnchor = null;
          hideTooltipTimer = null;
        }, 3800);
      };

      const showAllocLockTooltip = (anchorEl, lockedIdx) => {
        if (count !== 3 || lockedIdx < 0 || !anchorEl || !tipEl || !contentEl) return;
        lastTooltipAnchor = anchorEl;
        const lockedItem = items[lockedIdx];
        const name = lockedItem?.querySelector('.alloc-multi__name')?.textContent?.trim() || 'Asset';
        const pct = Math.round(pcts[lockedIdx]);
        tipEl.textContent = `${name} locked at ${pct}%: unlock it to increase this asset's allocation`;
        tipEl.classList.add('is-visible');
        updateAllocLockTooltipPosition();
        resetAllocLockTooltipAutoHide();
      };

      // Reposition on scroll (new closure each init — abort prior listener to avoid stacking)
      const scrollAbortKey = '_allocLockTooltipScrollAbort';
      if (scrollRoot) {
        const prevAbort = scrollRoot[scrollAbortKey];
        if (prevAbort) prevAbort.abort();
        const ac = new AbortController();
        scrollRoot[scrollAbortKey] = ac;
        scrollRoot.addEventListener(
          'scroll',
          () => {
            if (tipEl.classList.contains('is-visible')) updateAllocLockTooltipPosition();
          },
          { passive: true, signal: ac.signal },
        );
      }

      // Dismiss on any tap outside the tooltip (e.g. after slider release)
      const docAbortKey = '_allocLockTooltipDocPointerAbort';
      {
        const prevDoc = document[docAbortKey];
        if (prevDoc) prevDoc.abort();
        const acDoc = new AbortController();
        document[docAbortKey] = acDoc;
        document.addEventListener(
          'pointerdown',
          (e) => {
            if (!tipEl?.classList.contains('is-visible')) return;
            if (tipEl.contains(e.target)) return;
            hideAllocLockTooltip();
          },
          { capture: true, signal: acDoc.signal },
        );
      }

      // Redistribute: set changedIdx to newPct and spread the remainder
      // proportionally among unlocked others. Never returns early — always
      // clamps to a valid range so fast drags can never freeze the slider.
      /**
       * Amount mode: min % so Math.round(total × pct / 100) ≥ 1 → pct ≥ 50/t (ceil).
       * (Using 100/t was too loose and still allowed 0 after rounding.)
       * % mode: legacy 1% minimum per unlocked slot.
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

      /** @returns {{ hitLockedCap: boolean, lockedIdx: number }} */
      const redistribute = (changedIdx, newPct) => {
        const others = items
          .map((_, j) => j)
          .filter((j) => j !== changedIdx && !locked[j]);

        if (others.length === 0) return { hitLockedCap: false, lockedIdx: -1 };

        const minSlot = getMinPctPerOpenSlot();

        // Sum of locked assets that can't move
        const lockedSum = pcts.reduce((s, p, j) => (locked[j] ? s + p : s), 0);

        // Each unlocked other needs at least minSlot%; changed asset also ≥ minSlot.
        const maxForChanged = 100 - lockedSum - others.length * minSlot;
        const raw = newPct;
        const clamped = Math.max(minSlot, Math.min(maxForChanged, newPct));
        const triedToExceedMax = raw > maxForChanged + 0.08;
        const lockedIdx = locked.findIndex((l) => l);
        const hitLockedCap = count === 3 && lockedIdx >= 0 && lockedSum > 0 && triedToExceedMax;

        pcts[changedIdx] = clamped;

        // Amount left to share among unlocked others
        const toShare = 100 - clamped - lockedSum;

        if (others.length === 1) {
          pcts[others[0]] = toShare;
        } else {
          // Distribute proportionally to current values (feels natural on sliders)
          const othersSum = others.reduce((s, j) => s + pcts[j], 0);
          if (othersSum > 0) {
            others.forEach((j) => {
              pcts[j] = Math.max(minSlot, (pcts[j] / othersSum) * toShare);
            });
          } else {
            others.forEach((j) => { pcts[j] = toShare / others.length; });
          }

          // Absorb any floating-point rounding into the first other
          const pSum = pcts.reduce((a, b) => a + b, 0);
          pcts[others[0]] += 100 - pSum;
        }

        // Amount mode: absorb can leave a slot rounding to 0 TWD/USDT — bump then trim donors
        if (inputMode === 'amount') {
          const t = getPlanDetailInvestTotal();
          const minS = getMinPctPerOpenSlot();
          if (t >= count && t > 0) {
            let adjusted = false;
            for (let j = 0; j < count; j += 1) {
              if (locked[j]) continue;
              if (Math.round((t * pcts[j]) / 100) < 1) {
                pcts[j] = minS;
                adjusted = true;
              }
            }
            if (adjusted) {
              let sum = pcts.reduce((a, b) => a + b, 0);
              let over = sum - 100;
              if (over > 1e-6) {
                for (let j = count - 1; j >= 0 && over > 1e-6; j -= 1) {
                  if (locked[j]) continue;
                  const room = pcts[j] - minS;
                  if (room > 1e-6) {
                    const d = Math.min(room, over);
                    pcts[j] -= d;
                    over -= d;
                  }
                }
              }
            }
          }
        }

        renderAll();
        refreshPlanDetailAllocTweak();
        return { hitLockedCap, lockedIdx };
      };

      // Tiny synthetic sensitivity vs default split → footer % moves slightly (prototype only)
      const allocBaseline = [...defaultPcts];
      detailPanelAllocPctTweakFn = () => {
        const sens = count === 3 ? [0.018, 0.01, -0.007] : [0.014, -0.014];
        let t = 0;
        for (let i = 0; i < count; i += 1) {
          t += (pcts[i] - allocBaseline[i]) * sens[i];
        }
        return Math.max(-1.6, Math.min(1.6, t));
      };

      items.forEach((item, i) => {
        const slider = item.querySelector('[data-alloc-slider]');
        const input = item.querySelector('[data-alloc-pct-input]');
        const lockBtn = item.querySelector('[data-alloc-lock-btn]');

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
            hideAllocLockTooltip();
            slider.setPointerCapture(e.pointerId);
            const ret = redistribute(i, getSliderPct(e.clientX));
            if (count === 3 && ret.hitLockedCap) {
              const thumb = items[i].querySelector('[data-alloc-thumb]');
              showAllocLockTooltip(thumb, ret.lockedIdx);
            }
          });

          slider.addEventListener('pointermove', (e) => {
            if (!slider.hasPointerCapture(e.pointerId)) return;
            e.preventDefault();
            const ret = redistribute(i, getSliderPct(e.clientX));
            if (count === 3 && ret.hitLockedCap) {
              const thumb = items[i].querySelector('[data-alloc-thumb]');
              showAllocLockTooltip(thumb, ret.lockedIdx);
            } else {
              hideAllocLockTooltip();
            }
          });

          slider.addEventListener('pointerup', (e) => {
            if (slider.hasPointerCapture(e.pointerId)) {
              slider.releasePointerCapture(e.pointerId);
            }
          });

          // pointercancel can still fire (e.g. stylus loss-of-contact).
          // Release capture gracefully without stopping redistribution.
          slider.addEventListener('pointercancel', (e) => {
            if (slider.hasPointerCapture(e.pointerId)) {
              slider.releasePointerCapture(e.pointerId);
            }
            hideAllocLockTooltip();
          });
        }

        // % or amount input (mode toggled in header)
        if (input) {
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
                hideAllocLockTooltip();
                return;
              }
              const newPct = Math.round((raw / total) * 100);
              const ret = redistribute(i, newPct);
              if (count === 3 && ret.hitLockedCap) {
                const anchor = input.closest('.alloc-multi__pct-wrap');
                showAllocLockTooltip(anchor || input, ret.lockedIdx);
              } else {
                hideAllocLockTooltip();
              }
              return;
            }

            const val = parseInt(input.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 99) {
              const ret = redistribute(i, val);
              if (count === 3 && ret.hitLockedCap) {
                const anchor = input.closest('.alloc-multi__pct-wrap');
                showAllocLockTooltip(anchor || input, ret.lockedIdx);
              } else {
                hideAllocLockTooltip();
              }
            } else {
              input.value = String(Math.round(pcts[i]));
              hideAllocLockTooltip();
            }
          });

          input.addEventListener('input', () => {
            if (inputMode === 'amount') {
              applyAllocInputLiveFormat(input);
              return;
            }
            const val = parseInt(input.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 99) {
              const ret = redistribute(i, val);
              if (count === 3 && ret.hitLockedCap) {
                const anchor = input.closest('.alloc-multi__pct-wrap');
                showAllocLockTooltip(anchor || input, ret.lockedIdx);
              } else {
                hideAllocLockTooltip();
              }
            }
          });
        }

        // Lock button (3-asset only) — only one asset can be locked at a time
        if (lockBtn) {
          lockBtn.addEventListener('click', () => {
            hideAllocLockTooltip();
            const willLock = !locked[i];
            // Unlock all others first
            locked.fill(false);
            locked[i] = willLock;
            renderAll();
            refreshPlanDetailAllocTweak();
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
            locked.fill(false);
            hideAllocLockTooltip();
            renderAll();
            refreshPlanDetailAllocTweak();
          },
          { signal: panelCtlSignal },
        );
      }

      panelEl._planDetailAllocRefreshAmounts = () => {
        if (inputMode === 'amount') renderAll();
      };

      // Initial render (starts at default split — Reset hidden)
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

    const populatePanel = () => {
      const ctx = panelOpenContext;
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
        if (amountInput) amountInput.value = '';
      } else if (ctx.source === 'curated' && ctx.curatedKey && ctx.card) {
        planKey = ctx.curatedKey.toLowerCase();
        const card = ctx.card;
        title = card.querySelector('.curated-portfolios__name')?.textContent?.trim() || 'Portfolio';
        ticker = card.querySelector('.curated-portfolios__tickers')?.textContent?.trim() || planTicker[planKey] || '';
        iconSrc = card.querySelector('.curated-portfolios__icon')?.getAttribute('src') || iconSrc;
        if (amountInput) amountInput.value = '';
      } else if (ctx.source === 'spotlight' && ctx.spotlightKey && ctx.card) {
        const card = ctx.card;
        title = card.querySelector('.crypto-pill__name')?.textContent?.trim() || 'Crypto';
        ticker = card.querySelector('.crypto-pill__ticker')?.textContent?.trim() || String(ctx.spotlightKey).toUpperCase();
        iconSrc = card.querySelector('.crypto-pill__icon')?.getAttribute('src') || iconSrc;
        planKey = String(ctx.spotlightKey).toLowerCase();
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

      updateCoverageUI();

      // Repeats schedule
      const freqLabels = { daily: 'Daily · 12:00', weekly: 'Weekly · Mon at 12:00', monthly: 'Monthly · 15th at 12:00' };
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
      const allocSection = panel.querySelector('.plan-detail-panel__allocation-section');
      const allocSubtitleEl = panel.querySelector('[data-plan-detail-alloc-subtitle]');

      if (ctx.source === 'newplan') {
        // Empty state: no assets selected yet
        if (allocCountEl) allocCountEl.textContent = '0';
        allocList.innerHTML = '';
        if (allocSection) allocSection.classList.add('is-empty');
        const allocModeToggleNewplan = panel.querySelector('[data-alloc-mode-toggle]');
        if (allocModeToggleNewplan) allocModeToggleNewplan.classList.add('is-hidden');
        panel.querySelectorAll('.plan-detail-panel__add-assets').forEach((btn) => {
          btn.textContent = 'Add assets';
        });
        const resetNewplan = panel.querySelector('[data-alloc-reset]');
        if (resetNewplan) resetNewplan.hidden = true;
        if (allocSubtitleEl) allocSubtitleEl.hidden = true;
        updateDetailReturn();
        return;
      }

      if (allocSection) allocSection.classList.remove('is-empty');

      const allocItems =
        (ctx.source === 'spotlight' && ctx.card)
          ? [{
              name: ctx.card.querySelector('.crypto-pill__name')?.textContent?.trim() || 'Crypto',
              ticker: ctx.card.querySelector('.crypto-pill__ticker')?.textContent?.trim() || ticker,
              icon: ctx.card.querySelector('.crypto-pill__icon')?.getAttribute('src') || iconSrc,
            }]
          : (planAllocation[planKey] || planAllocation.bitcoin);

      if (allocCountEl) allocCountEl.textContent = String(allocItems.length);

      const addLabel = allocItems.length > 1 ? 'Add / remove assets' : 'Add assets';
      panel.querySelectorAll('.plan-detail-panel__add-assets').forEach((btn) => {
        btn.textContent = addLabel;
      });

      // Show mode toggle + allocation subtitle for 2+ assets only
      const allocModeToggle = panel.querySelector('[data-alloc-mode-toggle]');
      if (allocModeToggle) allocModeToggle.classList.toggle('is-hidden', allocItems.length < 2);
      if (allocSubtitleEl) allocSubtitleEl.hidden = allocItems.length < 2;

      if (allocItems.length >= 2) {
        // Multi-asset layout with sliders + optional lock
        const svgUnlock = `<img src="assets/icon_unlock.svg" width="20" height="20" alt="" />`;
        const svgLock = `<img src="assets/icon_lock.svg" width="20" height="20" alt="" />`;
        const showLock = allocItems.length === 3;

        allocList.innerHTML = `<div class="alloc-multi">${
          allocItems.map((item, i) => `
            <div class="alloc-multi__item" data-alloc-idx="${i}">
              <div class="alloc-multi__row">
                <img class="alloc-multi__icon" src="${item.icon}" alt="" />
                <div class="alloc-multi__info">
                  <span class="alloc-multi__name">${item.name}</span>
                  <span class="alloc-multi__ticker">${item.ticker}</span>
                </div>
                <div class="alloc-multi__pct-wrap">
                  <div class="alloc-multi__pct-inner">
                    <input class="alloc-multi__pct-input" type="text" inputmode="numeric" data-alloc-pct-input />
                    <span class="alloc-multi__pct-symbol">%</span>
                  </div>
                </div>
              </div>
              <div class="alloc-multi__slider-row">
                <div class="alloc-multi__slider" data-alloc-slider>
                  <div class="alloc-multi__slider-bg"></div>
                  <div class="alloc-multi__slider-fill" data-alloc-fill></div>
                  <div class="alloc-multi__slider-thumb" data-alloc-thumb></div>
                </div>
                ${showLock ? `<button class="alloc-multi__lock-btn" type="button" aria-label="Lock allocation" data-alloc-lock-btn>${svgUnlock}</button>` : ''}
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

      if (ctx.source === 'curated' || ctx.source === 'spotlight') {
        updateDetailReturn();
      } else if (ctx.source === 'plan') {
        // Footer % was synced from main widget earlier; capture base + alloc slider tweak
        snapshotFooterAllocBases();
        applyFooterAllocSliderTweak();
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
        panelOpenContext =
          openCtx?.source === 'newplan'
            ? { source: 'newplan' }
            : openCtx && openCtx.source === 'curated' && openCtx.curatedKey
              ? { source: 'curated', curatedKey: String(openCtx.curatedKey).toLowerCase(), card: openCtx.card }
              : openCtx && openCtx.source === 'spotlight' && openCtx.spotlightKey
                ? { source: 'spotlight', spotlightKey: String(openCtx.spotlightKey).toLowerCase(), card: openCtx.card }
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

    if (openBtn) openBtn.addEventListener('click', () => setOpen(true));
    if (newPlanBtn) {
      newPlanBtn.addEventListener('click', () => {
        setOpen(true, { source: 'newplan' });
        setTimeout(() => {
          const inp = panel.querySelector('[data-plan-detail-amount-input]');
          inp?.focus();
        }, 380);
      });
    }
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
      const titleEl = panel.querySelector('[data-plan-detail-return-title]');
      const currEl = panel.querySelector('[data-plan-detail-return-currency]');

      // Always recalculate coverage whenever amount or currency changes
      updateCoverageUI();

      if (ctx.source === 'newplan') {
        // No allocation yet — show blank return footer
        const absEl = panel.querySelector('[data-plan-detail-return-abs]');
        const pctEl = panel.querySelector('[data-plan-detail-return-pct]');
        if (absEl) absEl.textContent = amount > 0 ? '+0' : '+0';
        if (pctEl) {
          pctEl.textContent = '0.0%';
          pctEl.removeAttribute('data-alloc-base-pct');
        }
        if (absEl) absEl.removeAttribute('data-alloc-base-abs');
        if (titleEl) titleEl.textContent = document.querySelector('[data-plan-return-title]')?.textContent || titleEl.textContent;
        if (currEl) currEl.textContent = document.querySelector('[data-plan-return-currency]')?.textContent || currEl.textContent;
        return;
      }

      if (ctx.source === 'curated' && ctx.curatedKey) {
        if (returnObserver) returnObserver.disconnect();
        const freqItemCurated = document.querySelector('[data-plan-freq-item].is-active');
        const freqCurated = (freqItemCurated?.getAttribute('data-plan-freq-item') || 'monthly').toLowerCase();
        updatePlanStrategyHistoricalReturn({
          detailPanel: true,
          amount,
          planKey: ctx.curatedKey,
          freq: freqCurated,
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
    });

    document.addEventListener('plan-schedule-confirmed', () => {
      updatePlanStrategyHistoricalReturn();
      if (panel.classList.contains('is-open')) {
        updateCoverageUI();
        updateDetailReturn();
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

      // Input: reformat live + update return
      amountInput.addEventListener('input', () => {
        applyLiveFormat();
        updateDetailReturn();
        panel._planDetailAllocRefreshAmounts?.();
      });

      // Blur: handle empty/invalid
      amountInput.addEventListener('blur', () => {
        const raw = parseInt(amountInput.value.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(raw) && raw > 0) {
          setDisplayValue(raw);
        } else if (panelOpenContext.source === 'curated' || panelOpenContext.source === 'spotlight' || panelOpenContext.source === 'newplan') {
          amountInput.value = '';
        } else {
          const fallbackRaw = parseInt(
            document.querySelector('[data-plan-amount]')?.textContent?.replace(/,/g, '') || '10000', 10
          );
          setDisplayValue(fallbackRaw);
        }
        updateDetailReturn();
        panel._planDetailAllocRefreshAmounts?.();
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
          if (detailCur) detailCur.textContent = cur;
          if (detailIcon) detailIcon.src = cur === 'USDT' ? 'assets/icon_currency_usdt.svg' : 'assets/icon_currency_TWD.svg';
          updateCoverageUI();
          panel._planDetailAllocRefreshAmounts?.();
        });
        obs.observe(planCurrencyLabelMain, { childList: true, characterData: true, subtree: true });
      }
    }
  };

  initPlanDetailPanel();

  initPrototypeReset();

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
