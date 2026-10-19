import { h, defineComponent } from 'vue';
import { IconLayoutSidebar } from '@tabler/icons-vue';

export const IconSidebarConfig = defineComponent({
  name: 'IconSidebarConfig',
  setup() {
    return () => h(IconLayoutSidebar, {
      size: 32,
      stroke: 1.5,
    });
  },
});
