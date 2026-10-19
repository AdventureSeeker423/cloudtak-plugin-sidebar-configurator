<template>
  <div
    class='sidebar-preview'
    :title='`${title} — compact sidebar preview`'
  >
    <div class='sidebar-preview__rail overflow-auto'>
      <div
        v-if='!compactItems.length'
        class='sidebar-preview__empty text-secondary'
      >
        —
      </div>

      <div
        v-for='item in compactItems'
        :key='item.key'
        class='sidebar-preview__icon-btn'
        :title='item.label'
      >
        <component
          :is='item.icon'
          v-if='item.icon'
          :size='28'
          stroke='1.5'
        />
        <span
          v-else
          class='sidebar-preview__fallback'
        >{{ item.label.slice(0, 1) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import type { Component } from 'vue';
import type { MenuPref, MenuVisibility } from './constants.ts';
import type { CatalogItem } from './LayoutEditor.vue';

const props = defineProps<{
  title: string;
  prefs: MenuPref[];
  catalog: CatalogItem[];
}>();

type PreviewItem = {
  key: string;
  label: string;
  icon?: Component;
  visibility: MenuVisibility;
};

const orderedItems = computed((): PreviewItem[] => {
  const byKey = new Map(props.catalog.map((c) => [c.key, c]));
  const prefs = props.prefs.length
    ? props.prefs
    : props.catalog.map((c) => ({ key: c.key, visibility: 'full' as const }));

  const out: PreviewItem[] = [];
  const seen = new Set<string>();

  for (const pref of prefs) {
    const cat = byKey.get(pref.key);
    if (!cat) continue;
    out.push({
      key: cat.key,
      label: cat.label,
      icon: cat.icon,
      visibility: pref.visibility || 'full',
    });
    seen.add(pref.key);
  }
  for (const cat of props.catalog) {
    if (seen.has(cat.key)) continue;
    out.push({
      key: cat.key,
      label: cat.label,
      icon: cat.icon,
      visibility: 'full',
    });
  }
  return out;
});

/** Compact CloudTAK rail: only full-visibility items (partial + hidden omitted). */
const compactItems = computed(() =>
  orderedItems.value.filter((i) => i.visibility === 'full'),
);
</script>

<style scoped>
.sidebar-preview {
  width: 60px;
  height: 100%;
  min-height: 240px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

[data-bs-theme='light'] .sidebar-preview {
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.82);
}

.sidebar-preview__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.25rem;
  height: 100%;
  max-height: calc(100vh - 140px);
}

.sidebar-preview__icon-btn {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  background: rgba(0, 0, 0, 0.22);
  flex-shrink: 0;
}

[data-bs-theme='light'] .sidebar-preview__icon-btn {
  background: rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.08);
}

.sidebar-preview__fallback {
  font-weight: 700;
  font-size: 0.9rem;
}

.sidebar-preview__empty {
  font-size: 0.75rem;
  padding-top: 0.5rem;
}
</style>
