# Sidebar Configurator

CloudTAK plugin that lets a **system admin** set the default main-menu (sidebar) layout for everyone on the server — including installed plugins that register menu items.

Requires CloudTAK **13.102** or newer. Apache-2.0.

## What it does

- **Admin-only menu entry** — “Sidebar Configurator” appears only for CloudTAK system admins (`requiresSystemAdmin`).
- **Two layouts**
  - **Standard users** — applied to non-admins
  - **Admins** — optional; **off by default** so system admin sidebars are never touched. Enable “Manage admin sidebars” to Soft-seed admins, and use **Copy From Standard Users** to start from the standard layout.
- **Order + visibility** for each item: Full, Partial (hidden from compact rail), or Hidden
- **Apply modes**
  - **Soft (default)** — apply the matching layout only when that user’s `menu_order` is empty. Users can customize afterward and are not overwritten.
  - **Forced** — non-admins always get the Standard Users layout and cannot change order/visibility. **System admins are exempt** and keep their own bars.
- **Save** stores the server-wide config.
- **Push now** bulk-writes `menu::order` on profiles:
  - Soft: only users with an empty order
  - Forced: all non-admin users  
  If push cannot list profiles, clients still apply on the next load.

## Install

Do not rely on `WEB_PLUGINS` alone — the shared config API must be installed too:

```bash
git clone https://github.com/AdventureSeeker423/cloudtak-plugin-sidebar-configurator.git
cd cloudtak-plugin-sidebar-configurator
./install.sh
```

Or pass the CloudTAK path:

```bash
./install.sh /path/to/CloudTAK
```

The script finds CloudTAK at `$CLOUDTAK`, `~/CloudTAK`, `/home/takwerx/CloudTAK`, or `/home/*/CloudTAK`. It copies into `app/plugins/sidebar-configurator/` and `api/stateless/routes/plugin-sidebar-config.ts`, then rebuilds the API image.

After it finishes: **Settings → Refresh App**. A normal browser refresh is not enough.

```bash
./install.sh --remove
```

### Local development

Symlink this checkout to `CloudTAK/app/plugins/sidebar-configurator`, copy or symlink `server/plugin-sidebar-config.ts` into `api/stateless/routes/`, run `npm install` here (with `@tak-ps/cloudtak` pointing at your CloudTAK `app` package), and restart `npm run serve` in `app`.

## How to use

1. Sign in as a CloudTAK **system admin**.
2. Open **Sidebar Configurator** from the right-side menu.
3. Choose **Soft** or **Forced**.
4. Edit **Standard users** and **Admins** tabs (drag to reorder, eye icon for visibility).
5. Optionally click **Use my current sidebar** to seed a tab from your live menu.
6. **Save**, then **Push now** if you want existing users updated immediately.

## Notes

- Forced lock of the pencil/reorder UI is best-effort (CSS + client method wrap) and only affects non-admins.
- New plugin menu keys that appear after a layout was saved append at the end until an admin re-saves.
- The configurator button itself is admin-only; Soft/Forced apply still runs for every user on plugin `enable()`.
