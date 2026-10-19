export const MENU_KEY = 'sidebar-configurator';
export const ROUTE_NAME = 'home-menu-plugin-sidebar-configurator';
export const ROUTE_PATH = 'plugin-sidebar-configurator';
export const API_BASE = '/api/sidebar-config';

export type MenuVisibility = 'full' | 'partial' | 'hidden';
export type ApplyMode = 'soft' | 'forced';

export type MenuPref = {
  key: string;
  visibility: MenuVisibility;
};

export type SidebarConfig = {
  mode: ApplyMode;
  userItems: MenuPref[];
  adminItems: MenuPref[];
  updatedAt?: string | null;
  updatedBy?: string | null;
  writable?: boolean;
  isSystemAdmin?: boolean;
};

export const DEFAULT_CONFIG: SidebarConfig = {
  mode: 'soft',
  userItems: [],
  adminItems: [],
};
