import type { PluginAPI } from '@tak-ps/cloudtak';
import { useMapStore } from '../../../src/stores/map.ts';
import type { MenuPref } from './constants.ts';

const STYLE_ID = 'sidebar-configurator-forced-lock';

type MenuManagerLike = {
  setOrder: (keys: string[]) => Promise<void>;
  setVisibility: (key: string, visible: 'full' | 'partial' | 'hidden') => Promise<void>;
  preferenceOrder: { value: MenuPref[] };
};

let locked = false;
let originalSetOrder: MenuManagerLike['setOrder'] | null = null;
let originalSetVisibility: MenuManagerLike['setVisibility'] | null = null;
let forcedLayout: MenuPref[] = [];

function injectCss(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Sidebar Configurator: hide reorder / visibility chrome while Forced */
    .main-menu-layout .drag-handle,
    .main-menu-layout .sortable-ghost,
    .main-menu-layout button:has(svg.icon-tabler-pencil),
    .main-menu-layout button:has(svg.icon-tabler-pencil-check),
    .main-menu-layout button:has(svg.icon-tabler-eye),
    .main-menu-layout button:has(svg.icon-tabler-eye-dotted),
    .main-menu-layout button:has(svg.icon-tabler-eye-off) {
      display: none !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
}

function removeCss(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(STYLE_ID)?.remove();
}

async function reapplyForced(menu: MenuManagerLike): Promise<void> {
  if (!forcedLayout.length) return;
  menu.preferenceOrder.value = forcedLayout.map((p) => ({ ...p }));
  if (originalSetOrder) {
    await originalSetOrder(forcedLayout.map((p) => p.key));
  }
}

export function isForcedLocked(): boolean {
  return locked;
}

export function enableForcedLock(api: PluginAPI, layout: MenuPref[]): void {
  forcedLayout = layout.map((p) => ({ ...p }));
  if (locked) return;

  try {
    const mapStore = useMapStore(api.pinia);
    const menu = mapStore.menu as unknown as MenuManagerLike;
    if (!menu?.setOrder || !menu?.setVisibility) return;

    originalSetOrder = menu.setOrder.bind(menu);
    originalSetVisibility = menu.setVisibility.bind(menu);

    menu.setOrder = async () => {
      await reapplyForced(menu);
    };
    menu.setVisibility = async () => {
      await reapplyForced(menu);
    };

    injectCss();
    locked = true;
  } catch (err) {
    console.warn('[sidebar-config] failed to enable forced lock', err);
  }
}

export function disableForcedLock(api: PluginAPI): void {
  if (!locked) {
    removeCss();
    return;
  }

  try {
    const mapStore = useMapStore(api.pinia);
    const menu = mapStore.menu as unknown as MenuManagerLike;
    if (menu && originalSetOrder) menu.setOrder = originalSetOrder;
    if (menu && originalSetVisibility) menu.setVisibility = originalSetVisibility;
  } catch {
    // ignore
  }

  originalSetOrder = null;
  originalSetVisibility = null;
  forcedLayout = [];
  removeCss();
  locked = false;
}
