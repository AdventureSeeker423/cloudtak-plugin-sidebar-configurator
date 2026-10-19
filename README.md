# Sidebar Configurator

CloudTAK plugin that lets a **system admin** set the default main-menu (sidebar) layout for everyone on the server — including installed plugins that register menu items.

Requires CloudTAK **13.102** or newer. Apache-2.0.

## What it does

- **Admin-only menu entry** — “Sidebar Configurator” appears only for CloudTAK system admins (`requiresSystemAdmin`).
- **Two layouts**
  - **Standard users** — applied to non-admins
  - **Admins** — optional; **off by default** so system admin sidebars are never touched. Enable “Manage Admin Sidebars” to seed admins, and use **Copy From Standard Users** to start from the standard layout.
- **Order + visibility** for each item: eye = visible, eye-off = hidden (hidden items sort to the bottom of the configurator list)
- **Apply modes** (listed Off → New Users Only → Forced)
  - **Off (default on install / until a layout is saved)** — do not change anyone’s sidebar.
  - **New Users Only** — apply the matching layout only when that user’s `menu_order` is empty. Users can customize afterward and are not overwritten.
  - **Forced** — non-admins always get the Standard Users layout and cannot change order/visibility. **System admins are exempt** and keep their own bars.
- **Autosave** — mode, layouts, and admin options persist automatically after each change.
- **Overwrite All Toolbars** (with confirm) force-overwrites `menu::order` for all non-admin users — even when mode is New Users Only. System admins are skipped unless “Manage Admin Sidebars” is on. Off mode still no-ops. If push cannot list profiles, clients still apply on the next load.

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
3. Choose **Off**, **New Users Only**, or **Forced** (Off is first and is the default until you save a layout).
4. Edit **Standard users** and **Admins** tabs (drag to reorder; eye toggle to show/hide).
5. Optionally click **Use my current sidebar** to seed a tab from your live menu.
6. Changes autosave. Use **Overwrite All Toolbars** if you want existing users updated immediately (no effect while Off).

## Notes

- Forced lock of the pencil/reorder UI is best-effort (CSS + client method wrap) and only affects non-admins.
- New plugin menu keys that appear after a layout was saved append at the end until an admin re-saves.
- The configurator button itself is admin-only; New Users Only / Forced apply still runs for every user on plugin `enable()` when that mode is active.
