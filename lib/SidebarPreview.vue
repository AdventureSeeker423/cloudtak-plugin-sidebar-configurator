<template>
  <div class='sidebar-preview h-100 d-flex flex-column'>
    <div class='sidebar-preview__header px-3 py-2 flex-shrink-0'>
      <div class='fw-semibold'>Live preview</div>
      <div class='text-secondary small'>
        {{ title }} — as users will see it
      </div>
    </div>

    <div class='sidebar-preview__body flex-grow-1 overflow-auto px-2 pb-2'>
      <div
        v-if='!visibleItems.length'
        class='text-secondary small px-2 py-3'
      >
        No visible items in this layout.
      </div>

      <div
        v-for='item in visibleItems'
        :key='item.key'
        class='sidebar-preview__item d-flex align-items-center gap-3 px-3 py-3'
        :class='{
          "sidebar-preview__item--partial": item.visibility === "partial",
        }'
        :title='item.visibility === "partial" ? "Partial: hidden from compact rail" : item.label'
      >
        <div class='sidebar-preview__icon flex-shrink-0 d-flex align-items-center justify-content-center'>
          <component
            :is='item.icon'
            v-if='item.icon'
            :size='32'
            stroke='1.5'
          />
        </div>
        <div class='flex-grow-1 text-truncate'>
          <div class='sidebar-preview__label text-truncate'>{{ item.label }}</div>
          <div
            v-if='item.visibility === "partial"'
            class='sidebar-preview__hint small text-truncate'
          >
            Compact rail: hidden
          </div>
        </div>
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

/** Match real sidebar: hidden items are not shown. */
const visibleItems = computed(() =>
  orderedItems.value.filter((i) => i.visibility !== 'hidden'),
);
</script>

<style scoped>
.sidebar-preview {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.28);
  min-height: 280px;
}

[data-bs-theme='light'] .sidebar-preview {
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.72);
}

.sidebar-preview__header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

[data-bs-theme='light'] .sidebar-preview__header {
  border-bottom-color: rgba(0, 0, 0, 0.1);
}

.sidebar-preview__item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: inherit;
}

[data-bs-theme='light'] .sidebar-preview__item {
  border-bottom-color: rgba(0, 0, 0, 0.06);
}

.sidebar-preview__item--partial {
  opacity: 0.72;
}

.sidebar-preview__icon {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.22);
  color: inherit;
}

[data-bs-theme='light'] .sidebar-preview__icon {
  background: rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.08);
}

.sidebar-preview__label {
  font-size: 1rem;
  font-weight: 600;
}

.sidebar-preview__hint {
  opacity: 0.75;
}
</style>
