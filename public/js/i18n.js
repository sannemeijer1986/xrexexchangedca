(() => {
  const STORAGE_KEY = 'xrexexchange.prototype.locale.v1';
  const SUPPORTED = ['en', 'zh'];
  const DEFAULT_LOCALE = 'en';
  const EXTERNAL_ZH_PATH = 'i18n/zh.json';

  /** Single source of truth for UI translations.
   *  Key = canonical English source string/template.
   *  Value = localized string/template.
   */
  const translations = {
    en: {},
    zh: {
      // Add ZH translations here incrementally.
      // Example:
      // 'How it works': '運作方式',
      // 'Not enough balance for {count} {periodLabel}': '餘額不足，無法支應 {count} {periodLabel}',
    },
  };

  let locale = DEFAULT_LOCALE;
  const textSourceMap = new WeakMap(); // Text -> canonical EN source
  const attrSourceMap = new WeakMap(); // Element -> { attrName: canonical EN source }
  const discoveredSources = new Set(); // Canonical EN strings seen in UI
  const missingByLocale = {
    zh: new Set(),
  };
  let observer = null;
  let isApplying = false;

  const normalizeLocale = (value) => {
    const next = String(value || '').trim().toLowerCase();
    return SUPPORTED.includes(next) ? next : DEFAULT_LOCALE;
  };

  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const toCanonicalSource = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const toTemplatedSource = (value) => {
    let s = toCanonicalSource(value);
    if (!s) return s;
    // Domain-specific dynamic phrases first (most reliable).
    s = s.replace(
      /^Not enough balance for \d+ (buy|buys|day|days|week|weeks|month|months)$/i,
      'Not enough balance for {count} {periodLabel}',
    );
    s = s.replace(
      /^Covers \d+ (buy|buys|day|days|week|weeks|month|months) • runs out [A-Za-z]{3} \d{1,2}, \d{4}$/i,
      'Covers {count} {periodLabel} • runs out {date}',
    );
    s = s.replace(
      /^runs out [A-Za-z]{3} \d{1,2}, \d{4}$/i,
      'runs out {date}',
    );
    s = s.replace(
      /^Max \d[\d,]* (USDT|TWD|USD|BTC|ETH|XRP|XAUT|LINK|NEAR|MATIC|ONDO|AAVE|RENDER)$/i,
      'Max {amount} {currency}',
    );
    s = s.replace(
      /^Max \d[\d,]*$/i,
      'Max {count}',
    );
    s = s.replace(
      /^Avail\. \d[\d,]* (USDT|TWD|USD|BTC|ETH|XRP|XAUT|LINK|NEAR|MATIC|ONDO|AAVE|RENDER)$/i,
      'Avail. {amount} {currency}',
    );
    // Generic fallback for count + period label patterns.
    s = s.replace(
      /^(\d+) (buy|buys|day|days|week|weeks|month|months)$/i,
      '{count} {periodLabel}',
    );
    return s;
  };
  const hasLetters = (value) => /[A-Za-z\u00C0-\u024F\u4E00-\u9FFF]/.test(value);
  const isMostlyNumericOrSymbols = (value) => /^[-+≈~•/\\%().,:\d\s]+$/.test(value);
  const isDynamicMoneyLike = (value) => /^[-+]?\d[\d,]*(?:\.\d+)?\s+[A-Z]{3,5}(?:\b|$)/.test(value);
  const looksLikeTicker = (value) => /^[A-Z]{2,8}$/.test(value);
  const looksLikePair = (value) => /^[A-Z]{2,8}\s*\/\s*[A-Z]{2,8}$/.test(value);
  const looksLikeRangeChip = (value) => /^\d+Y$/i.test(value);
  const looksLikeOrdinal = (value) => /^\d{1,2}(st|nd|rd|th)$/i.test(value);
  const looksLikeValueSnippet = (value) => /^(~|≈|\+|-|•|\/|%|\(|\)|\{|\$)/.test(value);
  const noisyFragments = new Set([
    '{$value}',
    '• Plan ID',
    '/TWD',
    '/USDT',
    '/ — buys',
    '/ — months',
    '(Basic limits)',
  ]);
  const shouldCollectSource = (value) => {
    const s = toCanonicalSource(value);
    if (!s) return false;
    if (noisyFragments.has(s)) return false;
    if (!hasLetters(s)) return false;
    if (isMostlyNumericOrSymbols(s)) return false;
    if (isDynamicMoneyLike(s)) return false;
    if (looksLikeTicker(s)) return false;
    if (looksLikePair(s)) return false;
    if (looksLikeRangeChip(s)) return false;
    if (looksLikeOrdinal(s)) return false;
    if (looksLikeValueSnippet(s) && s.length < 32) return false;
    if (/^@\w+$/.test(s)) return false;
    return true;
  };

  const interpolate = (template, params) => {
    if (!params || typeof params !== 'object') return template;
    let out = String(template);
    Object.entries(params).forEach(([key, value]) => {
      out = out.replace(new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g'), String(value));
    });
    return out;
  };

  const reverseLookupSource = (text, forLocale = locale) => {
    const current = String(text ?? '');
    if (!current) return current;
    const target = normalizeLocale(forLocale);
    if (target === 'en') return current;
    const table = translations[target] || {};
    for (const [source, localized] of Object.entries(table)) {
      if (String(localized) === current) return source;
    }
    return current;
  };

  const translate = (source, params) => {
    const raw = String(source ?? '');
    if (!raw) return raw;
    const canonical = toTemplatedSource(raw);
    if (shouldCollectSource(canonical)) discoveredSources.add(canonical);
    if (locale === 'en') return interpolate(raw, params);
    const table = translations[locale] || {};
    const hasRaw = Object.prototype.hasOwnProperty.call(table, raw);
    const hasCanonical = Object.prototype.hasOwnProperty.call(table, canonical);
    if (shouldCollectSource(canonical) && !hasRaw && !hasCanonical) {
      if (!missingByLocale[locale]) missingByLocale[locale] = new Set();
      missingByLocale[locale].add(canonical);
    }
    const localized = hasRaw ? table[raw] : (hasCanonical ? table[canonical] : raw);
    return interpolate(localized, params);
  };

  const shouldTranslateText = (node) => {
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    const tag = parent.tagName?.toLowerCase() || '';
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return false;
    const value = String(node.nodeValue || '');
    if (!value.trim()) return false;
    return true;
  };

  const rememberAttrSource = (el, attrName, sourceText) => {
    const prev = attrSourceMap.get(el) || {};
    prev[attrName] = sourceText;
    attrSourceMap.set(el, prev);
  };

  const applyTextNodeLocale = (node) => {
    if (!shouldTranslateText(node)) return;
    const currentText = String(node.nodeValue || '');
    const source = textSourceMap.get(node) || reverseLookupSource(currentText);
    if (!textSourceMap.has(node)) textSourceMap.set(node, source);
    const translated = translate(source);
    if (translated !== currentText) node.nodeValue = translated;
  };

  const TRANSLATABLE_ATTRS = ['aria-label', 'title', 'placeholder'];

  const applyElementAttrLocale = (el) => {
    if (!(el instanceof Element)) return;
    TRANSLATABLE_ATTRS.forEach((attrName) => {
      if (!el.hasAttribute(attrName)) return;
      const current = String(el.getAttribute(attrName) || '');
      if (!current.trim()) return;
      const remembered = (attrSourceMap.get(el) || {})[attrName];
      const source = remembered || reverseLookupSource(current);
      if (!remembered) rememberAttrSource(el, attrName, source);
      const translated = translate(source);
      if (translated !== current) el.setAttribute(attrName, translated);
    });
  };

  const applyLocaleToTree = (root = document.body) => {
    if (!root) return;
    isApplying = true;
    try {
      if (root instanceof Element) applyElementAttrLocale(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let node = walker.nextNode();
      while (node) {
        applyTextNodeLocale(node);
        node = walker.nextNode();
      }
      if (root instanceof Element) {
        root.querySelectorAll('*').forEach((el) => applyElementAttrLocale(el));
      }
      document.documentElement.setAttribute('lang', locale === 'zh' ? 'zh-Hant' : 'en');
    } finally {
      isApplying = false;
    }
  };

  const setLocale = (nextLocale) => {
    locale = normalizeLocale(nextLocale);
    localStorage.setItem(STORAGE_KEY, locale);
    const select = document.querySelector('[data-prototype-language]');
    if (select instanceof HTMLSelectElement && select.value !== locale) {
      select.value = locale;
    }
    applyLocaleToTree(document.body);
    document.dispatchEvent(new CustomEvent('prototype-locale-changed', { detail: { locale } }));
  };

  const getLocale = () => locale;

  const initLocale = () => {
    locale = normalizeLocale(localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE);
  };

  const loadExternalZhTranslations = async () => {
    try {
      const response = await fetch(EXTERNAL_ZH_PATH, { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      const next = { ...data };
      delete next['_meta.locale'];
      delete next['_meta.note'];
      Object.assign(translations.zh, next);
    } catch (_) {
      // Keep runtime resilient if file is missing/invalid.
    }
  };

  const bindLocaleSelector = () => {
    const select = document.querySelector('[data-prototype-language]');
    if (!(select instanceof HTMLSelectElement)) return;
    select.value = locale;
    select.addEventListener('change', () => setLocale(select.value));
  };

  const initObserver = () => {
    observer = new MutationObserver((records) => {
      if (isApplying) return;
      isApplying = true;
      try {
        records.forEach((record) => {
          if (record.type === 'characterData') {
            const node = record.target;
            if (!shouldTranslateText(node)) return;
            // Treat runtime updates as canonical EN source strings.
            textSourceMap.set(node, reverseLookupSource(String(node.nodeValue || '')));
            applyTextNodeLocale(node);
            return;
          }
          if (record.type === 'attributes') {
            const el = record.target;
            if (!(el instanceof Element)) return;
            const attrName = record.attributeName;
            if (!attrName || !TRANSLATABLE_ATTRS.includes(attrName)) return;
            const current = String(el.getAttribute(attrName) || '');
            if (!current.trim()) return;
            rememberAttrSource(el, attrName, reverseLookupSource(current));
            applyElementAttrLocale(el);
            return;
          }
          if (record.type === 'childList') {
            record.addedNodes.forEach((node) => {
              if (node.nodeType === Node.TEXT_NODE) {
                textSourceMap.set(node, reverseLookupSource(String(node.nodeValue || '')));
                applyTextNodeLocale(node);
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                applyLocaleToTree(node);
              }
            });
          }
        });
      } finally {
        isApplying = false;
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRS,
    });
  };

  const init = async () => {
    initLocale();
    await loadExternalZhTranslations();
    bindLocaleSelector();
    applyLocaleToTree(document.body);
    initObserver();
  };

  const getDiscoveredStrings = () => Array.from(discoveredSources).sort((a, b) => a.localeCompare(b));

  const getMissingStrings = (forLocale = locale) => {
    const key = normalizeLocale(forLocale);
    const set = missingByLocale[key];
    return set ? Array.from(set).sort((a, b) => a.localeCompare(b)) : [];
  };

  const buildCatalog = (forLocale = 'zh') => {
    const target = normalizeLocale(forLocale);
    const table = translations[target] || {};
    return getDiscoveredStrings().reduce((acc, source) => {
      acc[source] = Object.prototype.hasOwnProperty.call(table, source) ? table[source] : '';
      return acc;
    }, {});
  };

  const seedLocaleFromDiscovered = (forLocale = 'zh', { overwrite = false } = {}) => {
    const target = normalizeLocale(forLocale);
    if (!translations[target]) translations[target] = {};
    const table = translations[target];
    getDiscoveredStrings().forEach((source) => {
      if (!Object.prototype.hasOwnProperty.call(table, source) || overwrite) {
        table[source] = overwrite ? table[source] ?? '' : '';
      }
    });
    return table;
  };

  const exportCatalogJson = (forLocale = 'zh') => JSON.stringify(buildCatalog(forLocale), null, 2);

  const shouldIncludeInUiCatalog = (source) => {
    const s = toCanonicalSource(source);
    if (!s) return false;
    if (!shouldCollectSource(s)) return false;
    // Extra strict pass for translation deliverables.
    if (looksLikeTicker(s) || looksLikePair(s) || looksLikeRangeChip(s) || looksLikeOrdinal(s)) return false;
    if (/^\d/.test(s) && !/\s/.test(s)) return false;
    return true;
  };

  const buildUiCatalog = (forLocale = 'zh') => {
    const target = normalizeLocale(forLocale);
    const table = translations[target] || {};
    return getDiscoveredStrings()
      .filter(shouldIncludeInUiCatalog)
      .reduce((acc, source) => {
        acc[source] = Object.prototype.hasOwnProperty.call(table, source) ? table[source] : '';
        return acc;
      }, {});
  };

  const exportUiCatalogJson = (forLocale = 'zh') => JSON.stringify(buildUiCatalog(forLocale), null, 2);

  window.I18N = {
    getLocale,
    setLocale,
    t: translate,
    translations,
    applyLocaleToTree: (root) => applyLocaleToTree(root || document.body),
    getDiscoveredStrings,
    getMissingStrings,
    buildCatalog,
    seedLocaleFromDiscovered,
    exportCatalogJson,
    buildUiCatalog,
    exportUiCatalogJson,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); }, { once: true });
  } else {
    init();
  }
})();

