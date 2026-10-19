export const MENU_KEY = 'sidebar-configurator';
export const ROUTE_NAME = 'home-menu-plugin-sidebar-configurator';
export const ROUTE_PATH = 'plugin-sidebar-configurator';
export const API_BASE = '/api/sidebar-config';

export type MenuVisibility = 'full' | 'partial' | 'hidden';
export type ApplyMode = 'off' | 'soft' | 'forced';

export type MenuPref = {
  key: string;
  visibility: MenuVisibility;
};

export type SidebarConfig = {
  mode: ApplyMode;
  /** When false (default), system admin sidebars are never seeded or overwritten. */
  manageAdminSidebar: boolean;
  userItems: MenuPref[];
  adminItems: MenuPref[];
  updatedAt?: string | null;
  updatedBy?: string | null;
  writable?: boolean;
  isSystemAdmin?: boolean;
};

export const DEFAULT_CONFIG: SidebarConfig = {
  mode: 'off',
  manageAdminSidebar: false,
  userItems: [],
  adminItems: [],
};

export function normalizeApplyMode(raw: unknown): ApplyMode {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'forced') return 'forced';
  if (v === 'soft') return 'soft';
  return 'off';
}
