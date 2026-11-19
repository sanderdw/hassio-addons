# Changelog

## 1.7.0

- **Breaking:** port 7778 is off by default. Open Metabase in Home Assistant (**Open web UI** or the sidebar). To keep using it without Home Assistant, set a port, such as 7778, on the Configuration tab under **Network** (select **Show disabled ports**).
- Home Assistant now stops Metabase while it backs up the app, and starts it again afterwards. Before, it copied the H2 database while Metabase was writing to it, so a restored database could be damaged. Metabase is unavailable during the backup.
- The app has its own AppArmor profile, which limits what it may do on your system. Home Assistant raises its security rating from 7 to 8.
- The documentation moved to the app's **Documentation** tab. The Info tab keeps a short introduction.
- The app's icon is square, as Home Assistant expects.
- Technical: one image for both architectures (`ghcr.io/sanderdw/hassio-addons/ha-metabase`), built with Home Assistant's builder and signed with Cosign. The base image is named in the Dockerfile, so the app also builds where the Supervisor does not pass `BUILD_FROM`.
- Technical: Docker's init process starts the app, as Home Assistant advises for images without S6 overlay. bashio 0.19.0.

## 1.6.3

- Fix the missing gear menu (Admin settings, account settings, help), search and **+ New** when you open Metabase in Home Assistant. Metabase hides them in any frame, as it expects to be embedded in another website; the app now shows them in Home Assistant's frame too.

## 1.6.2

- The H2 database (the default **Database type**) is now in the app's backups. It moves from `/backup/metabase.db` to the app's own folder at the first start: `app_configs/<id>_metabase` in Home Assistant, `/config/metabase.db` in the **Database file** option. Before, no Home Assistant backup contained it, and it stayed behind when you uninstalled the app with its data. The **Database file** option changes with it. A database file you set yourself stays where it is.

## 1.6.1

- Fix "502 Bad Gateway" when you open Metabase while it is still starting. Home Assistant now shows the app as starting until Metabase is ready, and only then offers "Open web UI".
- New option **AI features**: turn it off to switch off Metabot and Metabase's other AI features. It is on by default, so nothing changes until you turn it off.

## 1.6.0

- Open Metabase in Home Assistant: the app now supports ingress. Turn on "Show in sidebar" on the app's Info tab to open Metabase from the sidebar. Port 7778 keeps working as before.
- You log in to Metabase once in Home Assistant, separately from port 7778. Metabase cannot use your Home Assistant login.
- The README is rewritten: installing, the two kinds of application database, opening Metabase, adding Home Assistant's and DSMR Reader's data, and every option.

## 1.5.1

- The Configuration tab shows readable names and explanations for every option, in English and Dutch. Your settings stay as they are.
- Fix a start that took two minutes longer when the update check server does not answer. The check now gives up after 10 seconds.
- Fix Home Assistant showing "Error" after the app is stopped. Metabase shut down cleanly, but its exit code said otherwise.

## 1.5.0

- Update to Metabase 0.65.5.1

## 1.4.0

- Update to Metabase 0.61.3
- Refresh GitHub Actions workflow dependencies to latest major versions

## 1.3.0

- Update to Metabase 0.60.3.6
- Refresh GitHub Actions workflow dependencies to latest major versions

## 1.2.0

- Update to Metabase 0.56.11.1

## 1.1.1

- Update to Metabase 0.53.9

## 1.1.0

- Update to Metabase 0.53.5.5
- Official Arm support

## 1.0.1

- Fix version check
- Beta Arm support, the HEAD of development on the Metabase repository, use at your own risk. Will be replaced with the official Metabase provided ARM Release later.
- NOTE: Standard database [type](https://www.metabase.com/docs/latest/installation-and-operation/configuring-application-database) is changed to h2 to remove the dependency on an external database/addon.

  Using Metabase with an H2 application database is not recommended for production deployments. For production deployments, we highly recommend using Postgres instead. If you decide to continue to use H2, please be sure to back up the database file regularly (stored in the backup folder of HA).

## 1.0.0

- Happy 2025!
- Update to Metabase 0.52.4
- Added Metabase [environment variables](https://www.metabase.com/docs/latest/configuring-metabase/environment-variables) in config:
  - Database [type](https://www.metabase.com/docs/latest/installation-and-operation/configuring-application-database)
  - [Timezone](https://www.metabase.com/docs/latest/installation-and-operation/running-metabase-on-docker#setting-the-java-timezone)
  - Allocating [custom memory](https://www.metabase.com/docs/latest/troubleshooting-guide/running#allocating-more-memory-to-the-jvm) sizing to the addon
- NOTE: Currently only x86 supported, Metabase is currently [testing](https://github.com/metabase/metabase/issues/13119#issuecomment-2539434988) an official ARM Release and will be added again later.

## 0.5.0

- Update to Metabase 0.43.0

## 0.4.0

- Update to Metabase 0.42.4
- Faster install time

## 0.3.0

- Update to Metabase 0.40.0

## 0.2.1

- Update to Metabase 0.39.1

## 0.2.0

- Update to Metabase 0.39.0.1
- NOTE: Check "Before you upgrade" on https://github.com/metabase/metabase/releases/tag/v0.39.0.1

## 0.1.2

- Update to Metabase 0.38.3

## 0.1.1

- Addon image labels fix

## 0.1.0

- Update to Metabase 0.38.2 (patch update)

## 0.0.2

- Update to Metabase 0.38.1 (patch release)
- Standard external port set to 7778 (3000 used for zwaveJS)

## 0.0.1

- Initial Alpha version
