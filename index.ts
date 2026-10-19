import type { App } from 'vue';
import { h } from 'vue';
import type { PluginAPI, PluginInstance } from '@tak-ps/cloudtak';
// Host component (the plugin is built inside app/plugins/<name>/, like rubber-sheet).
import MenuTemplate from '../../src/components/CloudTAK/util/MenuTemplate.vue';
import ConfigPane from './lib/ConfigPane.vue';
import { IconSidebarConfig } from './lib/MenuIcon.ts';
import { MENU_KEY, ROUTE_NAME, ROUTE_PATH } from './lib/constants.ts';
import { applySidebarConfig, teardownSidebarConfig } from './lib/apply.ts';

export default class SidebarConfigurator implements PluginInstance {
  api: PluginAPI;

  constructor(api: PluginAPI) {
    this.api = api;

    // Routes stay registered. CloudTAK calls disable() before enable() on load,
    // and removing the route there makes the following menu.add fail.
    this.api.routes.add({
      path: ROUTE_PATH,
      name: ROUTE_NAME,
      component: {
        render: () => h(MenuTemplate, { name: 'Sidebar Configurator', back: false }, {
          default: () => h(ConfigPane, { api: this.api }),
        }),
      },
    }, 'home-menu');
  }

  static async install(app: App, api: PluginAPI): Promise<PluginInstance> {
    void app;
    return new SidebarConfigurator(api);
  }

  async enable(): Promise<void> {
    try {
      await applySidebarConfig(this.api);
    } catch (err) {
      console.warn('[sidebar-config] apply failed', err);
    }

    this.api.menu.add({
      key: MENU_KEY,
      label: 'Sidebar Configurator',
      route: ROUTE_NAME,
      tooltip: 'Sidebar Configurator (Admin)',
      description: 'Set Default Sidebar Layout For All Users',
      icon: IconSidebarConfig,
      badge: 'A',
      requiresSystemAdmin: true,
    });
  }

  async disable(): Promise<void> {
    await teardownSidebarConfig(this.api);
    try {
      this.api.menu.remove(MENU_KEY);
    } catch {
      // The menu item is already gone.
    }
  }
}
