import { std } from '../../../src/std.ts';
import {
  API_BASE,
  DEFAULT_CONFIG,
  normalizeApplyMode,
  type ApplyMode,
  type MenuPref,
  type MenuVisibility,
  type SidebarConfig,
} from './constants.ts';

function asVisibility(raw: unknown): MenuVisibility {
  const v = String(raw || 'full');
  if (v === 'partial' || v === 'hidden' || v === 'full') return v;
  return 'full';
}

function asItems(raw: unknown): MenuPref[] {
  if (!Array.isArray(raw)) return [];
  const out: MenuPref[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const key = String((row as { key?: unknown }).key || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      visibility: asVisibility((row as { visibility?: unknown }).visibility),
    });
  }
  return out;
}

function parseConfig(raw: unknown): SidebarConfig {
  const row = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const updatedAt = row.updatedAt != null ? String(row.updatedAt) : null;
  // Until an admin saves a layout, treat apply mode as Off regardless of DB default.
  const mode = updatedAt ? normalizeApplyMode(row.mode) : 'off';
  return {
    mode,
    manageAdminSidebar: !!row.manageAdminSidebar,
    userItems: asItems(row.userItems),
    adminItems: asItems(row.adminItems),
    updatedAt,
    updatedBy: row.updatedBy != null ? String(row.updatedBy) : null,
    writable: !!row.writable,
    isSystemAdmin: !!row.isSystemAdmin,
  };
}

export async function fetchConfig(): Promise<SidebarConfig> {
  try {
    const r = await std(API_BASE, { method: 'GET' });
    return parseConfig(r);
  } catch (err) {
    console.warn('[sidebar-config] fetch failed', err);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(payload: {
  mode: ApplyMode;
  manageAdminSidebar: boolean;
  userItems: MenuPref[];
  adminItems: MenuPref[];
}): Promise<SidebarConfig> {
  const r = await std(API_BASE, {
    method: 'PUT',
    body: payload,
  });
  return parseConfig(r);
}

export type PushResult = {
  mode: ApplyMode;
  updated: number;
  skipped: number;
  message?: string;
};

export async function pushConfig(): Promise<PushResult> {
  const r = await std(`${API_BASE}/push`, { method: 'POST' }) as Record<string, unknown>;
  return {
    mode: normalizeApplyMode(r.mode),
    updated: Number(r.updated) || 0,
    skipped: Number(r.skipped) || 0,
    message: r.message != null ? String(r.message) : undefined,
  };
}
