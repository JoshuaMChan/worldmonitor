/**
 * Standalone settings window: panel toggles only.
 * Loaded when the app is opened with ?settings=1 (e.g. from the main window's Settings button).
 */
import type { PanelConfig } from '@/types';
import { DEFAULT_PANELS, STORAGE_KEYS, ALL_PANELS, VARIANT_DEFAULTS, getEffectivePanelConfig, isPanelEntitled, FREE_MAX_PANELS } from '@/config';
import { isProUser } from '@/services/widget-store';
import { SITE_VARIANT } from '@/config/variant';
import { loadFromStorage, saveToStorage } from '@/utils';
import { getLocale, t } from '@/services/i18n';
import { escapeHtml } from '@/utils/sanitize';
import { isDesktopRuntime } from '@/services/runtime';

function getLocalizedPanelName(panelKey: string, fallback: string): string {
  if (panelKey === 'runtime-config') {
    return t('modals.runtimeConfig.title');
  }
  const key = panelKey.replace(/-([a-z])/g, (_match, group: string) => group.toUpperCase());
  const lookup = `panels.${key}`;
  const localized = t(lookup);
  if (localized !== lookup) return localized;
  if (!getLocale().toLowerCase().startsWith('zh')) return fallback;
  if (/[\u4e00-\u9fff]/.test(fallback)) return fallback;
  return fallback
    .replace(/\bAI\b/g, 'AI')
    .replace(/\bNews\b/gi, '新闻')
    .replace(/\bWorld\b/gi, '世界')
    .replace(/\bGlobal\b/gi, '全球')
    .replace(/\bMarket(s)?\b/gi, '市场')
    .replace(/\bCrypto\b/gi, '加密货币')
    .replace(/\bFinance\b/gi, '金融')
    .replace(/\bTech(nology)?\b/gi, '科技')
    .replace(/\bPolicy\b/gi, '政策')
    .replace(/\bRisk\b/gi, '风险')
    .replace(/\bSignal(s)?\b/gi, '信号')
    .replace(/\bTracker\b/gi, '追踪')
    .replace(/\bAnalysis\b/gi, '分析')
    .replace(/\bWatch\b/gi, '观察')
    .replace(/\bClock\b/gi, '时钟')
    .replace(/\bCalendar\b/gi, '日历')
    .replace(/\bStress\b/gi, '压力')
    .replace(/\bCurve\b/gi, '曲线')
    .replace(/\bCounter(s)?\b/gi, '计数器')
    .replace(/\bCommodit(y|ies)\b/gi, '大宗商品')
    .replace(/\bGood\b/gi, '好')
    .replace(/\bFeed\b/gi, '流')
    .replace(/\s+/g, ' ')
    .trim();
}

export function initSettingsWindow(): void {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  // This window shows only "which panels to display" (panel display settings).
  document.title = `${t('header.settings')} - World Monitor`;

  const panelSettings = loadFromStorage<Record<string, PanelConfig>>(
    STORAGE_KEYS.panels,
    DEFAULT_PANELS
  );
  // Prune stale panel keys not in current registry (e.g. renamed panels)
  const validPanelKeys = new Set(Object.keys(ALL_PANELS));
  for (const key of Object.keys(panelSettings)) {
    if (!validPanelKeys.has(key) && key !== 'runtime-config') delete panelSettings[key];
  }
  const variantDefaults = new Set(VARIANT_DEFAULTS[SITE_VARIANT] ?? []);
  for (const key of Object.keys(ALL_PANELS)) {
    if (!(key in panelSettings)) {
      panelSettings[key] = { ...getEffectivePanelConfig(key, SITE_VARIANT), enabled: variantDefaults.has(key) };
    }
  }

  const isDesktopApp = isDesktopRuntime();

  function render(): void {
    const panelEntries = Object.entries(panelSettings).filter(
      ([key, panel]) =>
        (key !== 'runtime-config' || isDesktopApp) &&
        (!key.startsWith('cw-') || isProUser()) &&
        isPanelEntitled(key, ALL_PANELS[key] ?? panel, isProUser())
    );
    const panelHtml = panelEntries
      .map(
        ([key, panel]) => `
        <div class="panel-toggle-item ${panel.enabled ? 'active' : ''}" data-panel="${escapeHtml(key)}">
          <div class="panel-toggle-checkbox">${panel.enabled ? '✓' : ''}</div>
          <span class="panel-toggle-label">${escapeHtml(getLocalizedPanelName(key, panel.name))}</span>
        </div>
      `
      )
      .join('');

    const grid = document.getElementById('panelToggles');
    if (grid) {
      grid.innerHTML = panelHtml;
      grid.querySelectorAll('.panel-toggle-item').forEach((item) => {
        item.addEventListener('click', () => {
          const panelKey = (item as HTMLElement).dataset.panel!;
          const config = panelSettings[panelKey];
          if (config) {
            if (!config.enabled && !isPanelEntitled(panelKey, ALL_PANELS[panelKey] ?? config, isProUser())) return;
            if (!config.enabled && !isProUser()) {
              const enabledCount = Object.entries(panelSettings).filter(([k, p]) => p.enabled && !k.startsWith('cw-')).length;
              if (enabledCount >= FREE_MAX_PANELS) return;
            }
            config.enabled = !config.enabled;
            saveToStorage(STORAGE_KEYS.panels, panelSettings);
            render();
          }
        });
      });
    }
  }

  appEl.innerHTML = `
    <div class="settings-window-shell">
      <div class="settings-window-header">
        <div class="settings-window-header-text">
          <span class="settings-window-title">${escapeHtml(t('header.settings'))}</span>
          <p class="settings-window-caption">${escapeHtml(t('header.panelDisplayCaption'))}</p>
        </div>
        <button type="button" class="modal-close" id="settingsWindowClose">×</button>
      </div>
      <div class="panel-toggle-grid" id="panelToggles"></div>
    </div>
  `;

  document.getElementById('settingsWindowClose')?.addEventListener('click', () => {
    window.close();
  });

  render();
}
