<template>
    <div class='col-12 sidebar-config-pane'>
        <div
            v-if='error || status'
            class='px-2 pt-2'
        >
            <TablerInlineAlert
                v-if='error'
                severity='danger'
                title='Something Went Wrong'
                :description='error'
            />
            <TablerInlineAlert
                v-else-if='status'
                severity='success'
                :title='status'
            />
        </div>

        <div class='sidebar-config-pane__row'>
            <div class='sidebar-config-pane__editor'>
                <div class='px-2 pt-3 pb-2'>
                    <div class='fw-semibold mb-1'>
                        Apply Mode
                    </div>
                    <div
                        class='btn-group w-100'
                        role='group'
                    >
                        <button
                            type='button'
                            class='btn'
                            :class='mode === "off" ? "btn-primary" : "btn-outline-secondary"'
                            :disabled='!writable || !!busy'
                            @click='mode = "off"'
                        >
                            Off
                        </button>
                        <button
                            type='button'
                            class='btn'
                            :class='mode === "soft" ? "btn-primary" : "btn-outline-secondary"'
                            :disabled='!writable || !!busy'
                            @click='mode = "soft"'
                        >
                            New Users Only
                        </button>
                        <button
                            type='button'
                            class='btn'
                            :class='mode === "forced" ? "btn-primary" : "btn-outline-secondary"'
                            :disabled='!writable || !!busy'
                            @click='mode = "forced"'
                        >
                            Forced
                        </button>
                    </div>
                </div>

                <ul class='nav nav-tabs px-2'>
                    <li class='nav-item'>
                        <button
                            type='button'
                            class='nav-link'
                            :class='{ active: tab === "user" }'
                            @click='tab = "user"'
                        >
                            Standard Users
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

                <div
                    v-if='tab === "admin"'
                    class='px-2 pt-2 pb-1'
                >
                    <label class='form-check'>
                        <input
                            v-model='manageAdminSidebar'
                            class='form-check-input'
                            type='checkbox'
                            :disabled='!writable || !!busy'
                        >
                        <span class='form-check-label'>
                            Manage Admin Sidebars
                        </span>
                    </label>
                </div>

                <LayoutEditor
                    v-if='tab === "user"'
                    v-model='userItems'
                    :catalog='catalog'
                    :disabled='!writable'
                />
                <LayoutEditor
                    v-else
                    v-model='adminItems'
                    :catalog='catalog'
                    :disabled='!writable || !manageAdminSidebar'
                >
                    <template #actions>
                        <button
                            type='button'
                            class='btn btn-sm btn-outline-secondary'
                            :disabled='!writable || !manageAdminSidebar || !userItems.length || !!busy'
                            @click='copyFromStandardUsers'
                        >
                            Copy From Standard Users
                        </button>
                    </template>
                </LayoutEditor>

                <div class='px-2 pb-3 d-flex flex-wrap gap-2 align-items-center'>
                    <button
                        type='button'
                        class='btn btn-outline-primary'
                        :disabled='busy || !writable'
                        @click='onPush'
                    >
                        {{ busy === 'push' ? 'Overwriting…' : 'Overwrite All Toolbars' }}
                    </button>
                    <span
                        v-if='busy === "save"'
                        class='text-secondary small'
                    >
                        Saving…
                    </span>
                </div>

                <p
                    v-if='meta'
                    class='px-2 text-secondary small'
                >
                    {{ meta }}
                </p>
            </div>

            <aside
                class='sidebar-config-pane__preview'
                aria-label='Compact Sidebar Preview'
            >
                <SidebarPreview
                    v-if='tab === "user" || manageAdminSidebar'
                    :title='tab === "user" ? "Standard Users" : "Admins"'
                    :prefs='activePrefs'
                    :catalog='catalog'
                />
                <div
                    v-else
                    class='sidebar-config-pane__preview-off text-secondary small text-center px-1'
                    title='Admin Sidebar Management Is Off'
                >
                    Off
                </div>
            </aside>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Component } from 'vue';
import type { PluginAPI } from '@tak-ps/cloudtak';
import { TablerInlineAlert } from '@tak-ps/vue-tabler';
import { useMapStore } from '../../../src/stores/map.ts';
import LayoutEditor, { type CatalogItem } from './LayoutEditor.vue';
import SidebarPreview from './SidebarPreview.vue';
import { fetchConfig, pushConfig, saveConfig } from './api.ts';
import type { ApplyMode, MenuPref } from './constants.ts';

const props = defineProps<{
  api: PluginAPI;
}>();

const AUTOSAVE_MS = 400;

const mode = ref<ApplyMode>('off');
const manageAdminSidebar = ref(false);
const userItems = ref<MenuPref[]>([]);
const adminItems = ref<MenuPref[]>([]);
const writable = ref(false);
const tab = ref<'user' | 'admin'>('user');
const busy = ref<false | 'save' | 'push'>(false);
const error = ref('');
const status = ref('');
const meta = ref('');
const hydrating = ref(true);

type MenuSourceItem = {
  key: string;
  label: string;
  icon?: Component;
};

const catalog = ref<CatalogItem[]>([]);

const activePrefs = computed(() =>
  tab.value === 'user' ? userItems.value : adminItems.value,
);

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function clearSaveTimer(): void {
  if (saveTimer !== undefined) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
}

function scheduleAutosave(): void {
  if (hydrating.value || !writable.value || busy.value === 'push') return;
  clearSaveTimer();
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void persist();
  }, AUTOSAVE_MS);
}

async function persist(): Promise<boolean> {
  if (!writable.value) return false;
  if (busy.value === 'push') return false;

  clearSaveTimer();
  const prevBusy = busy.value;
  busy.value = 'save';
  error.value = '';

  try {
    const cfg = await saveConfig({
      mode: mode.value,
      manageAdminSidebar: manageAdminSidebar.value,
      userItems: userItems.value,
      adminItems: adminItems.value,
    });

    // Avoid writing local state back from the response — that re-fires the
    // deep watch and loops autosave. Only refresh metadata.
    if (cfg.updatedAt) {
      meta.value = `Last Saved ${cfg.updatedAt}${cfg.updatedBy ? ` By ${cfg.updatedBy}` : ''}`;
    } else {
      meta.value = 'Last Saved Just Now.';
    }
    return true;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Save Failed';
    return false;
  } finally {
    busy.value = prevBusy === 'push' ? 'push' : false;
  }
}

function copyFromStandardUsers(): void {
  if (!manageAdminSidebar.value || !writable.value) return;
  adminItems.value = userItems.value.map((item) => ({
    key: item.key,
    visibility: item.visibility,
  }));
  status.value = 'Copied Standard Users Layout Into Admins.';
}

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
  clearSaveTimer();
  hydrating.value = true;
  error.value = '';
  status.value = '';
  refreshCatalog();
  try {
    const cfg = await fetchConfig();
    mode.value = cfg.mode;
    manageAdminSidebar.value = !!cfg.manageAdminSidebar;
    userItems.value = cfg.userItems;
    adminItems.value = cfg.adminItems;
    writable.value = !!cfg.writable;
    if (cfg.updatedAt) {
      meta.value = `Last Saved ${cfg.updatedAt}${cfg.updatedBy ? ` By ${cfg.updatedBy}` : ''}`;
    } else {
      meta.value = 'No Server Layout Saved Yet.';
    }
  } finally {
    hydrating.value = false;
  }
}

async function onPush(): Promise<void> {
  if (!writable.value) return;

  const adminNote = manageAdminSidebar.value
    ? ' System Admins Will Get The Admins Layout.'
    : ' System Admins Will Be Left Alone.';
  const ok = window.confirm(
    'Overwrite All Toolbars Will Replace Every Non-Admin User’s Sidebar With The Standard Users Layout'
    + ' — Including People Who Already Customized Theirs.'
    + adminNote
    + '\n\nThis Ignores New Users Only Mode. Continue?',
  );
  if (!ok) return;

  clearSaveTimer();
  error.value = '';
  status.value = '';
  try {
    const saved = await persist();
    if (!saved) return;
    busy.value = 'push';
    const result = await pushConfig();
    const extra = result.message ? ` ${result.message}` : '';
    status.value = `Push Complete: Updated ${result.updated}, Skipped ${result.skipped}.${extra}`;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Push Failed';
  } finally {
    busy.value = false;
  }
}

watch(
  [mode, manageAdminSidebar, userItems, adminItems],
  () => {
    scheduleAutosave();
  },
  { deep: true },
);

onMounted(() => {
  void reload();
});

onBeforeUnmount(() => {
  clearSaveTimer();
});
</script>

<style scoped>
.sidebar-config-pane {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  /* Sit inside MenuTemplate's Bootstrap .row without wrapping/overlapping */
  flex: 0 0 100%;
  padding-left: 0;
  padding-right: 0;
  color: var(--cloudtak-surface-color, var(--tblr-body-color));
}

@media (pointer: coarse) {
  .sidebar-config-pane :deep(.btn) {
    min-height: 44px;
  }
}

.sidebar-config-pane__row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  gap: 0.5rem;
  padding: 0 0.5rem 0.75rem 0;
}

.sidebar-config-pane__editor {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: hidden;
}

.sidebar-config-pane__preview {
  flex: 0 0 60px;
  width: 60px;
  max-width: 60px;
  align-self: stretch;
  padding-top: 0.75rem;
}

.sidebar-config-pane__preview-off {
  width: 60px;
  min-height: 240px;
  border: 1px dashed var(--cloudtak-surface-border, var(--tblr-border-color, rgba(128, 128, 128, 0.35)));
  border-radius: 6px;
  background: var(--cloudtak-inset-bg, transparent);
  color: var(--tblr-secondary-color, var(--tblr-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
