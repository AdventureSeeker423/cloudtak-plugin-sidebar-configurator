/*
 * Sidebar Configurator menu icon.
 *
 * CloudTAK's MenuItemCard renders menu icons as
 * <component :is='icon' :size :color stroke='1'>. Forward those props so the
 * Tabler glyph follows the host light/dark text colour (same pattern as
 * cloudtak-plugin-rubbersheet's IconRubberSheet).
 */
import { defineComponent, h } from 'vue';
import { IconLayoutSidebar } from '@tabler/icons-vue';

export const IconSidebarConfig = defineComponent({
  name: 'IconSidebarConfig',
  props: {
    size: { type: [Number, String], default: 32 },
    color: { type: String, default: 'currentColor' },
    stroke: { type: [Number, String], default: 1 },
  },
  setup(props) {
    return () => h(IconLayoutSidebar, {
      size: props.size,
      color: props.color,
      stroke: props.stroke,
    });
  },
});
