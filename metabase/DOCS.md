# Home Assistant App: Metabase

## Install the app

1. Add this repository to Home Assistant, as https://github.com/sanderdw/hassio-addons explains.
2. Install the **Metabase** app.
3. Choose where Metabase keeps its own data (below), then start the app.

## Where Metabase keeps its own data

Metabase stores its questions, dashboards and users in an application database. Set it with
**Database type** on the app's Configuration tab.

- **`h2` (the default):** a file in the app's own folder. It needs nothing else. In Home Assistant
  that folder is `app_configs/<id>_metabase` (`addon_configs` in older versions), for example in
  the Samba app's `app_configs` share. Inside the app it is `/config`, so the **Database file**
  option says `/config/metabase.db`. The file is in the app's backups. When you uninstall the app
  and choose to delete its data, the file is deleted too. Metabase
  [recommends PostgreSQL](https://www.metabase.com/docs/latest/installation-and-operation/migrating-from-h2)
  for long-term use.

  Up to version 1.6.1 the default was `/backup/metabase.db`, which is in no backup and stays
  after an uninstall. The app moves it to `/config/metabase.db` at its first start and changes
  the **Database file** option. A database file you set yourself stays where it is.
- **`postgres`:** a PostgreSQL database, such as the
  [TimescaleDB app](https://community.home-assistant.io/t/home-assistant-add-on-postgresql-timescaledb/198176) by Expaso:
  1. Install the TimescaleDB app.
  2. On its Configuration tab, add `metabase` to **databases**. It does not need to be in
     `timescale_enabled`.
  3. Start the TimescaleDB app once, so it creates the database.
  4. In the Metabase app, set **Database type** to `postgres`. The other database options have
     the TimescaleDB app's defaults; change them if you changed them there.

## Open Metabase

1. Start the app. The first start takes a few minutes, longer on a Raspberry Pi. Home Assistant
   shows the app as starting until Metabase is ready.
2. Click **Open web UI** on the app's Info tab; it appears once Metabase is ready. Turn on
   **Show in sidebar** there to open Metabase from Home Assistant's sidebar.
3. Walk through Metabase's setup, which creates your administrator account.

### Without Home Assistant

To open Metabase without Home Assistant, give it a port on the app's Configuration tab, under
**Network** (select **Show disabled ports**), for example `7778`. Metabase then also answers on
http://homeassistant.local:7778. The port is off until you set it; up to version 1.6.3 it was 7778
by default.

## Add your data

In Metabase, go to Admin settings, Databases, and add a database:

- **Home Assistant's history**, when your [recorder](https://www.home-assistant.io/integrations/recorder/)
  writes to PostgreSQL.
- **DSMR Reader's readings** from the [DSMR Reader app](https://github.com/sanderdw/hassio-addons/blob/main/dsmr_reader/README.md): PostgreSQL, host
  `77b2833f-timescaledb`, database `dsmrreader`, with the user and password of the TimescaleDB app.
- [Any other source](https://www.metabase.com/data_sources/) that Metabase supports.

## In Home Assistant and on its own port

- **Logging in:** Metabase cannot use your Home Assistant login. You log in to Metabase once in
  Home Assistant, and separately on its own port.
- **Site URL:** Metabase sets its **Site URL** (Admin settings, General) on the first visit of
  an administrator. Links in e-mails and alerts use it, so set it to the address where those links
  should open, such as http://homeassistant.local:7778. Do not add a path such as `/metabase`:
  Metabase then loads its pages from that path, also in Home Assistant, where they are not found.

## Backups

Home Assistant stops Metabase while it backs up the app, and starts it again afterwards, so the H2
database in the backup is complete. Metabase is unavailable for that time, a minute or more on a
Raspberry Pi. With **Database type** `postgres`, back up that database with its own app, such as
TimescaleDB.

## Options

| Option | What it does |
| --- | --- |
| Database type | `h2` or `postgres`, see above. |
| Database file | Type `h2` only. Where Metabase keeps its file, see above. Paths in `/config` are in the app's backups. |
| Database name, user, password, host, port | Type `postgres` only. The defaults are those of the TimescaleDB app. |
| Time zone | The time zone Metabase works in, such as `Europe/Amsterdam`. |
| Java options | `-Xmx` sets the most memory Metabase may use; the default `-Xmx2g` allows 2 GB. Lower it on a device with little memory. |
| AI features | Metabot and Metabase's other AI features (on by default). They need an AI provider, which you set up in Metabase's admin settings; without one, Metabase logs warnings about a missing LLM provider. Turn this off to switch AI off completely. |
