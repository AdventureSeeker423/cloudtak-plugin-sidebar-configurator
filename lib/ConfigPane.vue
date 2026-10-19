<template>
  <div class='w-100 sidebar-config-pane'>
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

    <div class='sidebar-config-pane__grid px-2 pt-3 pb-3'>
      <div class='sidebar-config-pane__editor d-flex flex-column min-w-0'>
        <div class='pb-2'>
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

        <ul class='nav nav-tabs'>
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

        <div class='sidebar-config-pane__editor-scroll flex-grow-1 min-h-0'>
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
        </div>

        <div class='pt-2 d-flex flex-wrap gap-2 flex-shrink-0'>
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
          class='text-secondary small mb-0 mt-2'
        >
          {{ meta }}
        </p>
      </div>

      <aside class='sidebar-config-pane__preview min-w-0'>
        <SidebarPreview
          :title='tab === "user" ? "Standard users" : "Admins"'
          :prefs='activePrefs'
          :catalog='catalog'
        />
      </aside>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue';
import type { Component } from 'vue';
import type { PluginAPI } from '@tak-ps/cloudtak';
import { useMapStore } from '../../src/stores/map.ts';
import LayoutEditor, { type CatalogItem } from './LayoutEditor.vue';
import SidebarPreview from './SidebarPreview.vue';
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

type MenuSourceItem = {
  key: string;
  label: string;
  icon?: Component;
};

const catalog = ref<CatalogItem[]>([]);

const activePrefs = computed(() =>
  tab.value === 'user' ? userItems.value : adminItems.value,
);

function refreshCatalog(): void {
  try {
    const mapStore = useMapStore(props.api.pinia);
    const menu = mapStore.menu as {
      baseMenuItems?: MenuSourceItem[];
      pluginMenuItems?: { value: MenuSourceItem[] };
      items?: { value: MenuSourceItem[] };
    };

    const base = menu.baseMenuItems || [];
    const plugins = menu.pluginMenuItems?.value || [];
    const live = menu.items?.value || [];

    const seen = new Set<string>();
    const next: CatalogItem[] = [];
    for (const item of [...base, ...plugins, ...live]) {
      if (!item?.key || seen.has(item.key)) continue;
      seen.add(item.key);
      next.push({
        key: item.key,
        label: item.label || item.key,
        icon: item.icon,
      });
    }
    catalog.value = next;
  } catch (err) {
    console.warn('[sidebar-config] catalog refresh failed', err);
  }
}

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

<style scoped>
.sidebar-config-pane__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
  gap: 1rem;
  align-items: stretch;
}

.sidebar-config-pane__editor-scroll {
  overflow: auto;
}

.sidebar-config-pane__preview {
  position: sticky;
  top: 0.5rem;
  align-self: start;
  max-height: calc(100vh - 120px);
}

.sidebar-config-pane__preview :deep(.sidebar-preview) {
  max-height: calc(100vh - 120px);
}

@media (max-width: 900px) {
  .sidebar-config-pane__grid {
    grid-template-columns: 1fr;
  }

  .sidebar-config-pane__preview {
    position: static;
    max-height: none;
  }

  .sidebar-config-pane__preview :deep(.sidebar-preview) {
    max-height: 420px;
  }
}
</style>
