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

  const initPlanStrategySlider = () => {
    const slider = document.querySelector('[data-plan-slider]');
    const fill = document.querySelector('[data-plan-slider-fill]');
    const thumb = document.querySelector('[data-plan-slider-thumb]');
    const amountEl = document.querySelector('[data-plan-amount]');
    if (!slider || !fill || !thumb || !amountEl) return;

    const min = parseInt(slider.getAttribute('data-min') || '500', 10);
    const max = parseInt(slider.getAttribute('data-max') || '100000', 10);

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const formatNumber = (n) => n.toLocaleString('en-US');

    let value = clamp(parseInt(slider.getAttribute('aria-valuenow') || '5000', 10), min, max);

    const pctFromValue = (v) => (max === min ? 0 : (v - min) / (max - min));
    const stepForPct = (pct) => {
      if (pct < 1 / 3) return 500;
      if (pct < 2 / 3) return 1000;
      return 5000;
    };
    const roundToStep = (v, step) => Math.round(v / step) * step;

    const setValue = (next, pctHint) => {
      const pctRaw = typeof pctHint === 'number' ? pctHint : pctFromValue(next);
      const step = stepForPct(pctRaw);
      value = clamp(roundToStep(next, step), min, max);
      const pct = pctFromValue(value);
      fill.style.width = `${pct * 100}%`;
      thumb.style.left = `calc(${pct * 100}% - ${pct * 24}px)`;
      amountEl.textContent = formatNumber(value);
      slider.setAttribute('aria-valuenow', String(value));
    };

    const setFromClientX = (clientX) => {
      const rect = slider.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const pct = rect.width === 0 ? 0 : x / rect.width;
      const raw = min + pct * (max - min);
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

    // Keyboard support (optional but cheap)
    slider.tabIndex = 0;
    slider.addEventListener('keydown', (e) => {
      const step = stepForPct(pctFromValue(value));
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setValue(value - step);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setValue(value + step);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setValue(min);
      } else if (e.key === 'End') {
        e.preventDefault();
        setValue(max);
      }
    });

    setValue(value);
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

  initStates();
  initBadgeControls();
  initTabs();
  initFinanceHeaderTabs();
  initFinanceSectionNav();
  initPlanStrategySlider();
  initLimitsPanel();
  initPrototypeReset();

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
