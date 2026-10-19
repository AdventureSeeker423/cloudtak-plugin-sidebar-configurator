<template>
  <div class='w-100'>
    <div
      v-if='error'
      class='alert alert-danger mx-2 mt-2 mb-0'
      role='alert'
    >
      {{ error }}
    </div>
    <div
      v-if='status'
      class='alert alert-success mx-2 mt-2 mb-0'
      role='alert'
    >
      {{ status }}
    </div>

    <div class='px-2 pt-3 pb-2'>
      <div class='fw-semibold mb-1'>Apply mode</div>
      <div class='btn-group w-100' role='group'>
        <button
          type='button'
          class='btn'
          :class='mode === "soft" ? "btn-primary" : "btn-outline-secondary"'
          @click='mode = "soft"'
        >
          Soft
        </button>
        <button
          type='button'
          class='btn'
          :class='mode === "forced" ? "btn-primary" : "btn-outline-secondary"'
          @click='mode = "forced"'
        >
          Forced
        </button>
      </div>
      <p class='text-secondary small mt-2 mb-0'>
        <template v-if='mode === "soft"'>
          Soft (default): apply the matching layout only when a user has never customized
          their sidebar. They can change it afterward.
        </template>
        <template v-else>
          Forced: non-admins always get the Standard Users layout and cannot edit order/visibility.
          System admins are exempt and keep their own bars.
        </template>
      </p>
    </div>

    <ul class='nav nav-tabs px-2'>
      <li class='nav-item'>
        <button
          type='button'
          class='nav-link'
          :class='{ active: tab === "user" }'
          @click='tab = "user"'
        >
          Standard users
        </button>
      </li>
      <li class='nav-item'>
        <button
          type='button'
          class='nav-link'
          :class='{ active: tab === "admin" }'
          @click='tab = "admin"'
        >
          Admins
        </button>
      </li>
    </ul>

    <LayoutEditor
      v-if='tab === "user"'
      v-model='userItems'
      :catalog='catalog'
    />
    <LayoutEditor
      v-else
      v-model='adminItems'
      :catalog='catalog'
    />

    <div class='px-2 pb-2'>
      <div class='fw-semibold mb-1'>Preview</div>
      <ol class='small mb-0 ps-3'>
        <li
          v-for='item in previewItems'
          :key='item.key'
          class='mb-1'
        >
          <span :class='item.visibility === "hidden" ? "text-secondary text-decoration-line-through" : ""'>
            {{ item.label }}
          </span>
          <span class='text-secondary'> ({{ item.visibility }})</span>
        </li>
      </ol>
    </div>

    <div class='px-2 pb-3 d-flex flex-wrap gap-2'>
      <button
        type='button'
        class='btn btn-primary'
        :disabled='busy || !writable'
        @click='onSave'
      >
        {{ busy === 'save' ? 'Saving…' : 'Save' }}
      </button>
      <button
        type='button'
        class='btn btn-outline-primary'
        :disabled='busy || !writable'
        @click='onPush'
      >
        {{ busy === 'push' ? 'Pushing…' : 'Push now' }}
      </button>
      <button
        type='button'
        class='btn btn-outline-secondary'
        :disabled='!!busy'
        @click='reload'
      >
        Reload
      </button>
    </div>

    <p
      v-if='meta'
      class='px-2 text-secondary small'
    >
      {{ meta }}
    </p>
  </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue';
import type { PluginAPI } from '@tak-ps/cloudtak';
import { useMapStore } from '../../src/stores/map.ts';
import LayoutEditor from './LayoutEditor.vue';
import { fetchConfig, pushConfig, saveConfig } from './api.ts';
import type { ApplyMode, MenuPref } from './constants.ts';

const props = defineProps<{
  api: PluginAPI;
}>();

const mode = ref<ApplyMode>('soft');
const userItems = ref<MenuPref[]>([]);
const adminItems = ref<MenuPref[]>([]);
const writable = ref(false);
const tab = ref<'user' | 'admin'>('user');
const busy = ref<false | 'save' | 'push'>(false);
const error = ref('');
const status = ref('');
const meta = ref('');

type CatalogItem = { key: string; label: string };

const catalog = ref<CatalogItem[]>([]);

function refreshCatalog(): void {
  try {
    const mapStore = useMapStore(props.api.pinia);
    const menu = mapStore.menu as {
      baseMenuItems?: Array<{ key: string; label: string }>;
      pluginMenuItems?: { value: Array<{ key: string; label: string }> };
      items?: { value: Array<{ key: string; label: string }> };
    };

    const base = menu.baseMenuItems || [];
    const plugins = menu.pluginMenuItems?.value || [];
    const live = menu.items?.value || [];

    const seen = new Set<string>();
    const next: CatalogItem[] = [];
    for (const item of [...base, ...plugins, ...live]) {
      if (!item?.key || seen.has(item.key)) continue;
      seen.add(item.key);
      next.push({ key: item.key, label: item.label || item.key });
    }
    catalog.value = next;
  } catch (err) {
    console.warn('[sidebar-config] catalog refresh failed', err);
  }
}

const previewItems = computed(() => {
  const prefs = tab.value === 'user' ? userItems.value : adminItems.value;
  const byKey = new Map(catalog.value.map((c) => [c.key, c.label]));
  const out: Array<{ key: string; label: string; visibility: string }> = [];
  const seen = new Set<string>();
  for (const pref of prefs) {
    out.push({
      key: pref.key,
      label: byKey.get(pref.key) || pref.key,
      visibility: pref.visibility,
    });
    seen.add(pref.key);
  }
  for (const c of catalog.value) {
    if (seen.has(c.key)) continue;
    out.push({ key: c.key, label: c.label, visibility: 'full' });
  }
  return out;
});

async function reload(): Promise<void> {
  error.value = '';
  status.value = '';
  refreshCatalog();
  const cfg = await fetchConfig();
  mode.value = cfg.mode;
  userItems.value = cfg.userItems;
  adminItems.value = cfg.adminItems;
  writable.value = !!cfg.writable;
  if (cfg.updatedAt) {
    meta.value = `Last saved ${cfg.updatedAt}${cfg.updatedBy ? ` by ${cfg.updatedBy}` : ''}`;
  } else {
    meta.value = 'No server layout saved yet.';
  }
}

async function onSave(): Promise<void> {
  if (!writable.value) return;
  busy.value = 'save';
  error.value = '';
  status.value = '';
  try {
    const cfg = await saveConfig({
      mode: mode.value,
      userItems: userItems.value,
      adminItems: adminItems.value,
    });
    mode.value = cfg.mode;
    userItems.value = cfg.userItems;
    adminItems.value = cfg.adminItems;
    status.value = 'Layout saved.';
    if (cfg.updatedAt) {
      meta.value = `Last saved ${cfg.updatedAt}${cfg.updatedBy ? ` by ${cfg.updatedBy}` : ''}`;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Save failed';
  } finally {
    busy.value = false;
  }
}

async function onPush(): Promise<void> {
  if (!writable.value) return;
  busy.value = 'push';
  error.value = '';
  status.value = '';
  try {
    // Persist first so push uses the latest editor state.
    await saveConfig({
      mode: mode.value,
      userItems: userItems.value,
      adminItems: adminItems.value,
    });
    const result = await pushConfig();
    const extra = result.message ? ` ${result.message}` : '';
    status.value = `Push complete: updated ${result.updated}, skipped ${result.skipped}.${extra}`;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Push failed';
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void reload();
});
</script>
