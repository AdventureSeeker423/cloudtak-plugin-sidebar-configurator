<template>
  <div class='px-2 pb-3'>
    <div class='d-flex align-items-center justify-content-between mb-2 gap-2 flex-wrap'>
      <div class='text-secondary small'>
        Drag to reorder. Click the eye to cycle Full → Partial → Hidden.
      </div>
      <div class='d-flex flex-wrap gap-2'>
        <slot name='actions' />
        <button
          type='button'
          class='btn btn-sm btn-outline-secondary'
          :disabled='disabled'
          @click='seedFromLive'
        >
          Use my current sidebar
        </button>
      </div>
    </div>

    <div
      v-if='!items.length'
      class='text-secondary small py-3'
    >
      No menu items available yet. Open the main menu once, then return here.
    </div>

    <div
      v-else
      ref='listEl'
      class='list-group list-group-flush sidebar-config-layout-list'
      :class='{ "sidebar-config-layout--disabled": disabled }'
    >
      <div
        v-for='item in items'
        :key='item.key'
        class='list-group-item d-flex align-items-center gap-2 px-2 py-2'
        :data-key='item.key'
      >
        <span
          class='drag-handle text-secondary'
          :style='disabled ? "cursor: not-allowed" : "cursor: grab"'
        >
          <IconGripVertical :size='18' stroke='1.5' />
        </span>
        <component
          :is='item.icon'
          v-if='item.icon'
          class='sidebar-config-item-icon flex-shrink-0'
          :size='24'
          stroke='1.5'
        />
        <div class='flex-grow-1 text-truncate fw-semibold'>
          {{ item.label }}
        </div>
        <button
          type='button'
          class='btn btn-sm btn-ghost-secondary'
          :title='`Visibility: ${item.visibility}`'
          :disabled='disabled'
          @click='cycleVisibility(item.key)'
        >
          <IconEye v-if='item.visibility === "full"' :size='18' stroke='1.5' />
          <IconEyeDotted v-else-if='item.visibility === "partial"' :size='18' stroke='1.5' />
          <IconEyeOff v-else :size='18' stroke='1.5' />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { Component } from 'vue';
import Sortable from 'sortablejs';
import {
  IconEye,
  IconEyeDotted,
  IconEyeOff,
  IconGripVertical,
} from '@tabler/icons-vue';
import type { MenuPref, MenuVisibility } from './constants.ts';

export type CatalogItem = {
  key: string;
  label: string;
  icon?: Component;
};

const props = defineProps<{
  modelValue: MenuPref[];
  catalog: CatalogItem[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [MenuPref[]];
}>();

const listEl = ref<HTMLElement | null>(null);
let sortable: Sortable | undefined;

const items = computed(() => {
  const byKey = new Map(props.catalog.map((c) => [c.key, c]));
  const prefs = props.modelValue.length
    ? props.modelValue
    : props.catalog.map((c) => ({ key: c.key, visibility: 'full' as const }));

  const ordered: Array<CatalogItem & { visibility: MenuVisibility }> = [];
  const seen = new Set<string>();

  for (const pref of prefs) {
    const cat = byKey.get(pref.key);
    if (!cat) continue;
    ordered.push({ ...cat, visibility: pref.visibility || 'full' });
    seen.add(pref.key);
  }
  for (const cat of props.catalog) {
    if (seen.has(cat.key)) continue;
    ordered.push({ ...cat, visibility: 'full' });
  }
  return ordered;
});

function emitFromItems(next: Array<{ key: string; visibility: MenuVisibility }>): void {
  emit('update:modelValue', next.map((i) => ({
    key: i.key,
    visibility: i.visibility,
  })));
}

function cycleVisibility(key: string): void {
  if (props.disabled) return;
  const nextMap: Record<MenuVisibility, MenuVisibility> = {
    full: 'partial',
    partial: 'hidden',
    hidden: 'full',
  };
  emitFromItems(items.value.map((i) => (
    i.key === key
      ? { key: i.key, visibility: nextMap[i.visibility] || 'full' }
      : { key: i.key, visibility: i.visibility }
  )));
}

function seedFromLive(): void {
  if (props.disabled) return;
  emitFromItems(props.catalog.map((c) => {
    const existing = props.modelValue.find((p) => p.key === c.key);
    return {
      key: c.key,
      visibility: existing?.visibility || 'full',
    };
  }));
}

function syncSortable(): void {
  if (sortable) {
    sortable.destroy();
    sortable = undefined;
  }
  if (props.disabled || !listEl.value || items.value.length < 2) return;
  sortable = new Sortable(listEl.value, {
    animation: 150,
    handle: '.drag-handle',
    dataIdAttr: 'data-key',
    onEnd: () => {
      if (!sortable) return;
      const keys = sortable.toArray();
      const byKey = new Map(items.value.map((i) => [i.key, i]));
      emitFromItems(keys.map((k) => {
        const item = byKey.get(k);
        return {
          key: k,
          visibility: item?.visibility || 'full',
        };
      }));
    },
  });
}

watch(
  () => [listEl.value, items.value.map((i) => i.key).join('|'), props.disabled],
  async () => {
    await nextTick();
    syncSortable();
  },
  { flush: 'post' },
);

onBeforeUnmount(() => {
  if (sortable) sortable.destroy();
});

// Ensure parent has a concrete list when catalog arrives and value is empty.
watch(
  () => props.catalog,
  (catalog) => {
    if (!props.length) return;
    if (props.modelValue.length) return;
    emitFromItems(catalog.map((c) => ({ key: c.key, visibility: 'full' })));
  },
  { immediate: true, deep: true },
);
</script>

<style scoped>
.sidebar-config-item-icon {
  width: 24px;
  height: 24px;
  color: inherit;
}

.sidebar-config-layout--disabled {
  opacity: 0.55;
  pointer-events: none;
}
</style>
