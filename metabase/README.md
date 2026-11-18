# Home Assistant App: Metabase

[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fsanderdw%2Fhassio-addons)
[![Community Forum][forum-shield]][forum]

Meet the easy, open source way for everyone to ask questions and learn from data. See for more information https://www.metabase.com.

[![GitHub Build Status](https://github.com/sanderdw/hassio-addons/workflows/Metabase/badge.svg?logo=github)](https://github.com/sanderdw/hassio-addons/actions) ![metabase-shield] ![addon-shield] ![aarch64-shield] ![amd64-shield]

![Metabase](https://raw.githubusercontent.com/sanderdw/hassio-addons/main/images/metabase.png)

## Install the app

1. Add this repository to Home Assistant: use the button above, or see https://github.com/sanderdw/hassio-addons.
2. Install the **Metabase** app.
3. Choose where Metabase keeps its own data (below), then start the app.

## Where Metabase keeps its own data

Metabase stores its questions, dashboards and users in an application database. Set it with
**Database type** on the app's Configuration tab.

- **`h2` (the default):** a file, `/backup/metabase.db`. It needs nothing else and is included in
  Home Assistant's backups. Metabase [recommends PostgreSQL](https://www.metabase.com/docs/latest/installation-and-operation/migrating-from-h2)
  for long-term use.
- **`postgres`:** a PostgreSQL database, such as the
  [TimescaleDB app](https://community.home-assistant.io/t/home-assistant-add-on-postgresql-timescaledb/198176) by Expaso:
  1. Install the TimescaleDB app.
  2. On its Configuration tab, add `metabase` to **databases**. It does not need to be in
     `timescale_enabled`.
  3. Start the TimescaleDB app once, so it creates the database.
  4. In the Metabase app, set **Database type** to `postgres`. The other database options have
     the TimescaleDB app's defaults; change them if you changed them there.

## Open Metabase

1. Start the app. The first start takes a few minutes, longer on a Raspberry Pi. The app's Log
   tab shows when Metabase is ready.
2. Click **Open web UI** on the app's Info tab. Turn on **Show in sidebar** there to open Metabase
   from Home Assistant's sidebar.
3. Walk through Metabase's setup, which creates your administrator account.

Metabase also answers on port 7778 (http://homeassistant.local:7778), without Home Assistant.
If you only use it in Home Assistant, you can switch that port off on the app's Configuration tab,
under **Network**.

## Add your data

In Metabase, go to Admin settings, Databases, and add a database:

- **Home Assistant's history**, when your [recorder](https://www.home-assistant.io/integrations/recorder/)
  writes to PostgreSQL.
- **DSMR Reader's readings** from the [DSMR Reader app](https://github.com/sanderdw/hassio-addons/blob/main/dsmr_reader/README.md): PostgreSQL, host
  `77b2833f-timescaledb`, database `dsmrreader`, with the user and password of the TimescaleDB app.
- [Any other source](https://www.metabase.com/data_sources/) that Metabase supports.

## In Home Assistant and on port 7778

- **Logging in:** Metabase cannot use your Home Assistant login. You log in to Metabase once in
  Home Assistant, and separately on port 7778.
- **Site URL:** Metabase sets its **Site URL** (Admin settings, General) on the first visit of
  an administrator. Links in e-mails and alerts use it, so set it to the address where those links
  should open, such as http://homeassistant.local:7778. Do not add a path such as `/metabase`:
  Metabase then loads its pages from that path, also in Home Assistant, where they are not found.

## Options

| Option | What it does |
| --- | --- |
| Database type | `h2` or `postgres`, see above. |
| Database file | Type `h2` only. Where Metabase keeps its file. The default in `/backup` is included in Home Assistant's backups. |
| Database name, user, password, host, port | Type `postgres` only. The defaults are those of the TimescaleDB app. |
| Time zone | The time zone Metabase works in, such as `Europe/Amsterdam`. |
| Java options | `-Xmx` sets the most memory Metabase may use; the default `-Xmx2g` allows 2 GB. Lower it on a device with little memory. |

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg?style=flat-square
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg?style=flat-square
[metabase-shield]: https://img.shields.io/badge/Metabase%20Version-%200.65.5.1-purple.svg?style=flat-square
[addon-shield]: https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fgithub.com%2Fsanderdw%2Fhassio-addons%2Fraw%2Frefs%2Fheads%2Fmain%2Fmetabase%2Fconfig.json&query=version&style=flat-square&label=Addon%20Version
[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=for-the-badge
[forum]: https://community.home-assistant.io/t/metabase-add-on-for-home-assistant/286413
