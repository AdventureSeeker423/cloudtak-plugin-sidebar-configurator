/* eslint-disable */
import { Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import Schema from '@openaddresses/batch-schema';
import Err from '@openaddresses/batch-error';
import Auth, { AuthUserAccess } from '../../common/auth.js';
import type ConfigStateless from '../config.js';

const VisibilitySchema = Type.Union([
  Type.Literal('full'),
  Type.Literal('partial'),
  Type.Literal('hidden'),
]);

const MenuPrefSchema = Type.Object({
  key: Type.String(),
  visibility: VisibilitySchema,
});

const ModeSchema = Type.Union([
  Type.Literal('soft'),
  Type.Literal('forced'),
]);

const ConfigSchema = Type.Object({
  mode: ModeSchema,
  userItems: Type.Array(MenuPrefSchema),
  adminItems: Type.Array(MenuPrefSchema),
  updatedAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  updatedBy: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  writable: Type.Optional(Type.Boolean()),
  isSystemAdmin: Type.Optional(Type.Boolean()),
});

const PushResultSchema = Type.Object({
  mode: ModeSchema,
  updated: Type.Integer(),
  skipped: Type.Integer(),
  message: Type.Optional(Type.String()),
});

type MenuPref = { key: string; visibility: 'full' | 'partial' | 'hidden' };
type ApplyMode = 'soft' | 'forced';
type StoredConfig = {
  mode: ApplyMode;
  userItems: MenuPref[];
  adminItems: MenuPref[];
  updatedAt: string | null;
  updatedBy: string | null;
};

const CONFIG_ID = 1;
const MENU_ORDER_KEY = 'menu::order';

async function query<T>(config: ConfigStateless, statement: ReturnType<typeof sql>): Promise<T[]> {
  const result = await config.pg.execute(statement);
  return result as unknown as T[];
}

function normalizeVisibility(raw: unknown): 'full' | 'partial' | 'hidden' {
  const v = String(raw || 'full');
  if (v === 'partial' || v === 'hidden' || v === 'full') return v;
  return 'full';
}

function normalizeItems(raw: unknown): MenuPref[] {
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
      visibility: normalizeVisibility((row as { visibility?: unknown }).visibility),
    });
  }
  return out;
}

function isEmptyOrder(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '[]' || trimmed === 'null') return true;
    try {
      return isEmptyOrder(JSON.parse(trimmed));
    } catch {
      return false;
    }
  }
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

async function bootstrap(config: ConfigStateless): Promise<void> {
  await config.pg.execute(sql`
    CREATE TABLE IF NOT EXISTS sidebar_config (
      id INTEGER PRIMARY KEY,
      mode TEXT NOT NULL DEFAULT 'soft',
      user_items TEXT NOT NULL DEFAULT '[]',
      admin_items TEXT NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ,
      updated_by TEXT
    )
  `);
  await config.pg.execute(sql`
    INSERT INTO sidebar_config (id, mode, user_items, admin_items)
    VALUES (${CONFIG_ID}, ${'soft'}, ${'[]'}, ${'[]'})
    ON CONFLICT (id) DO NOTHING
  `);
}

async function readConfig(config: ConfigStateless): Promise<StoredConfig> {
  const rows = await query<{
    mode: string;
    user_items: unknown;
    admin_items: unknown;
    updated_at: string | null;
    updated_by: string | null;
  }>(config, sql`
    SELECT mode, user_items, admin_items, updated_at, updated_by
    FROM sidebar_config
    WHERE id = ${CONFIG_ID}
  `);

  if (!rows.length) {
    return {
      mode: 'soft',
      userItems: [],
      adminItems: [],
      updatedAt: null,
      updatedBy: null,
    };
  }

  const row = rows[0];
  const mode = row.mode === 'forced' ? 'forced' : 'soft';

  const parse = (raw: unknown): unknown => {
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return raw;
  };

  return {
    mode,
    userItems: normalizeItems(parse(row.user_items)),
    adminItems: normalizeItems(parse(row.admin_items)),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
  };
}

async function writeConfig(
  config: ConfigStateless,
  body: { mode: ApplyMode; userItems: MenuPref[]; adminItems: MenuPref[] },
  updatedBy: string,
): Promise<StoredConfig> {
  const now = new Date().toISOString();
  const userJson = JSON.stringify(body.userItems);
  const adminJson = JSON.stringify(body.adminItems);
  await config.pg.execute(sql`
    INSERT INTO sidebar_config (id, mode, user_items, admin_items, updated_at, updated_by)
    VALUES (
      ${CONFIG_ID},
      ${body.mode},
      ${userJson},
      ${adminJson},
      ${now}::timestamptz,
      ${updatedBy}
    )
    ON CONFLICT (id) DO UPDATE SET
      mode = EXCLUDED.mode,
      user_items = EXCLUDED.user_items,
      admin_items = EXCLUDED.admin_items,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by
  `);
  return readConfig(config);
}

async function pushConfig(config: ConfigStateless, stored: StoredConfig): Promise<{
  updated: number;
  skipped: number;
  message?: string;
}> {
  const layout = stored.userItems;
  if (!layout.length) {
    return { updated: 0, skipped: 0, message: 'No standard-user layout saved yet' };
  }

  let profiles: { username: string; system_admin: boolean }[];
  try {
    profiles = await query<{ username: string; system_admin: boolean }>(config, sql`
      SELECT username, system_admin
      FROM profile
      WHERE COALESCE(disabled, false) = false
    `);
  } catch (err) {
    console.error('[sidebar-config] profile list failed', err);
    return {
      updated: 0,
      skipped: 0,
      message: 'Could not list profiles; clients will apply on next load',
    };
  }

  const orderRows = await query<{ username: string; value: string }>(config, sql`
    SELECT username, value
    FROM profile_settings
    WHERE key = ${MENU_ORDER_KEY}
  `);
  const orderByUser = new Map(orderRows.map((r) => [String(r.username), r.value]));

  let updated = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const username = String(profile.username || '');
    if (!username) {
      skipped += 1;
      continue;
    }

    const isAdmin = !!profile.system_admin;
    if (isAdmin) {
      skipped += 1;
      continue;
    }

    if (stored.mode === 'soft') {
      const existing = orderByUser.get(username);
      if (!isEmptyOrder(existing)) {
        skipped += 1;
        continue;
      }
    }

    try {
      await config.models.ProfileConfig.commit(username, {
        [MENU_ORDER_KEY]: layout,
      });
      updated += 1;
    } catch (err) {
      console.error('[sidebar-config] push failed for', username, err);
      skipped += 1;
    }
  }

  return { updated, skipped };
}

export default async function router(schema: Schema, config: ConfigStateless) {
  try {
    await bootstrap(config);
  } catch (err) {
    console.error('[sidebar-config] table bootstrap failed', err);
  }

  await schema.get('/sidebar-config', {
    name: 'Get Sidebar Config',
    group: 'SidebarConfigurator',
    description: 'Server-wide default sidebar layouts and apply mode',
    res: ConfigSchema,
  }, async (req, res) => {
    try {
      const user = await Auth.as_user(config, req);
      const stored = await readConfig(config);
      res.json({
        ...stored,
        writable: user.access === AuthUserAccess.ADMIN,
        isSystemAdmin: user.access === AuthUserAccess.ADMIN,
      });
    } catch (err) {
      Err.respond(err, res);
    }
  });

  await schema.put('/sidebar-config', {
    name: 'Save Sidebar Config',
    group: 'SidebarConfigurator',
    description: 'Save Soft/Forced mode and user/admin sidebar layouts (system admin only)',
    body: Type.Object({
      mode: ModeSchema,
      userItems: Type.Array(MenuPrefSchema),
      adminItems: Type.Array(MenuPrefSchema),
    }),
    res: ConfigSchema,
  }, async (req, res) => {
    try {
      const user = await Auth.as_user(config, req, { admin: true });
      const mode = req.body.mode === 'forced' ? 'forced' : 'soft';
      const userItems = normalizeItems(req.body.userItems);
      const adminItems = normalizeItems(req.body.adminItems);
      const stored = await writeConfig(config, { mode, userItems, adminItems }, user.email);
      res.json({
        ...stored,
        writable: true,
        isSystemAdmin: true,
      });
    } catch (err) {
      Err.respond(err, res);
    }
  });

  await schema.post('/sidebar-config/push', {
    name: 'Push Sidebar Config',
    group: 'SidebarConfigurator',
    description: 'Apply saved standard-user layout to profiles (Soft: empty only; Forced: all non-admins)',
    res: PushResultSchema,
  }, async (req, res) => {
    try {
      await Auth.as_user(config, req, { admin: true });
      const stored = await readConfig(config);
      const result = await pushConfig(config, stored);
      res.json({
        mode: stored.mode,
        updated: result.updated,
        skipped: result.skipped,
        ...(result.message ? { message: result.message } : {}),
      });
    } catch (err) {
      Err.respond(err, res);
    }
  });
}
