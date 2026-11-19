# Changelog

## 2.3.1

- The app has its own AppArmor profile, which limits what it may do on your system. Home Assistant raises its security rating from 7 to 8.
- The documentation moved to the app's **Documentation** tab. The Info tab keeps a short introduction.
- Technical: one image for both architectures (`ghcr.io/sanderdw/hassio-addons/ha-dsmr-reader`), built with Home Assistant's builder and signed with Cosign. The base image is named in the Dockerfile, so the app also builds where the Supervisor does not pass `BUILD_FROM`.
- Technical: bashio 0.19.0.

## 2.3.0

- The Configuration tab shows readable names and explanations for every option, in English and Dutch. The option `MQTT_HOME_ASSISTANT` (Connect to Home Assistant through MQTT) is now at the top. Your settings stay as they are.
- New option `INGRESS_AUTO_LOGIN` (on by default): Home Assistant admins who open DSMR Reader through Ingress are logged in to its configuration without a login page. See "Ingress auto-login" in the README.
- New option `MQTT_HOME_ASSISTANT` (off by default): sets up MQTT for the [DSMR Reader integration](https://www.home-assistant.io/integrations/dsmr_reader) in Home Assistant. See "Home Assistant integration" in the README.
  - With the Mosquitto broker app, DSMR Reader gets its broker from Home Assistant, and Home Assistant then shows DSMR Reader as a discovered integration.
  - The app switches on the data sources the integration reads (the "Split topic" sources for telegrams, day consumption, gas consumption, quarter-hour peak consumption, meter statistics and current month/year totals). It does not change their topics.
  - A broker you entered in DSMR Reader yourself is kept.
- Drop support for 32-bit systems (`armv7`): Home Assistant no longer supports them. The app runs on 64-bit systems (`aarch64`, `amd64`) only.
- Fix a slow start (2 to 5 minutes, with a start timeout in the Supervisor log) when the update check server does not answer. The check now gives up after 10 seconds.
- Fix Home Assistant showing "Error" after the app is stopped. The app did not stop by itself and was killed after 10 seconds; it now stops in about 5 seconds.
- Fix Home Assistant showing the app as starting for up to 2 minutes after it was ready, when the start took longer than a minute (a database migration, a slow machine, the database starting late).

## 2.2.1

- As always, backup database first!
- Update to [DSMR Reader v6.2](https://dsmr-reader.readthedocs.io/en/v6/reference/changelog/)
  - Image `xirixiz/dsmr-reader-docker:6.2.2`
  - Fixes peak power readings on some Belgian Fluvius meters
  - Fixes gas readings on setups with more than one MBus device (for example a gas and a water meter)
  - Fixes electricity values in the Trends graphs for setups with two tariffs
- Docs: the container is now named `app_0826754b_dsmr_reader` (was `addon_0826754b_dsmr_reader`)

## 2.2.0

- As always, backup database first!
- Update to [DSMR Reader v6.2](https://dsmr-reader.readthedocs.io/en/v6/reference/changelog/)
  - Image `xirixiz/dsmr-reader-docker:6.2.0`
  - Fixes midnight-border gap that silently dropped a slice of electricity consumption at day/hour boundaries

## 2.1.2

- As always, backup database first!
- Update to [DSMR Reader v6.1](https://dsmr-reader.readthedocs.io/en/v6/reference/changelog/)
  - Image `xirixiz/dsmr-reader-docker:6.1.2`

## 2.1.0

- As always, backup database first!
- Update to [DSMR Reader v6.1](https://dsmr-reader.readthedocs.io/en/v6/reference/changelog/)
  - Image `xirixiz/dsmr-reader-docker:6.1.0`
- Add Supervisor `watchdog` targeting the upstream `/healthcheck` endpoint so Home Assistant auto-restarts the add-on when the web stack stops responding (note: only relevant for `standalone` and `server_remote_datalogger`; `remote_datalogger` mode has no web UI and should not be used together with this watchdog)

## 2.0.0

- As always, backup database first!
- After updating, it's adviced to reset options. Go to configuration tab -> Menu -> `Reset to defaults` -> set it up again
- **Breaking:** Update to [DSMR Reader v6](https://dsmr-reader.readthedocs.io/en/v6/)
  - Image `xirixiz/dsmr-reader-docker:6.0.2`
- **Breaking:** `DSMRREADER_OPERATION_MODE` renamed to `CONTAINER_RUN_MODE` with new values: `standalone`, `server_remote_datalogger`, `remote_datalogger` (previously `standalone`, `api_server`, `api_client`)
- New option `DJANGO_TIME_ZONE` (replaces TZ env var, recommended: `Europe/Amsterdam`)
- New option `DJANGO_SECRET_KEY`
- Fix/New option `DJANGO_CSRF_TRUSTED_ORIGINS` to fix [CSRF 403 errors](https://github.com/sanderdw/hassio-addons/issues/95) when using SSL on configuration page

## 1.12.3

- Technical: Bashio update to v0.17.5
- Technical: GitHub Actions workflow and base image tag updates
- Remove unsupported `armhf` architecture
- Note: This is just a technical update

## 1.12.2

- Update to DSMR-reader v5.12 (This is the final v5 release)
  - Updated Dropbox SDK to latest version in favor of incompatible API changes on January 1st, 2026.
- DSMR-reader v6 upcoming release [information](https://dsmr-reader.readthedocs.io/en/v6/reference/changelog/)

## 1.12.1

- Fix sending e-mail [issue](https://community.home-assistant.io/t/dsmr-reader-app-for-home-assistant/279087/446)

## 1.12.0

- Happy 2025!
- Use a remote share as backup folder [issue](https://github.com/sanderdw/hassio-addons/issues/82)
- Support for PostgreSQL 17
- Technical: Github Action workflow updated (switch to ghcr.io)

## 1.11.3

- Datalogger automatically restarts again
- From 1.11.1
  - Support for PostgreSQL 16.2
  - Technical: Bashio update to v0.16.2
  - Technical: Github Action workflow updated
  - Technical: S6 Overlay v3

## 1.11.2

- Some users are noticing stability issues so revert until [issue](https://https://github.com/sanderdw/hassio-addons/issues/86) is resolved

## 1.11.1

- Support for PostgreSQL 16.2
- Technical: Bashio update to v0.16.2
- Technical: Github Action workflow updated
- Technical: S6 Overlay v3

## 1.11.0

- Update to DSMR-reader v5.11

## 1.10.2

- Update base image to support PostgreSQL 15

## 1.10.1

- Update to DSMR-reader v5.10.3
- NOTE: Check configuration as DSMRREADER_REMOTE_DATALOGGER_MODE" has become "DSMRREADER_OPERATION_MODE"

  - 'sender' changed to 'api_client'
  - 'receiver' changed to 'api_server'

  Reset configuration if you don't see the updated settings.
- Github Action workflow updated/fixes

## 1.9.0

- Update to DSMR-reader v5.9

## 1.8.0

- Update to DSMR-reader v5.8
- Continue when update check fails

## 1.7.0

- Update to DSMR-reader v5.6

## 1.6.1

- Update to DSMR-reader v5.5.1
- New cli-helper to fix (https://community.home-assistant.io/t/dsmr-reader-app-for-home-assistant/279087/286)

## 1.6.0

- Update to DSMR-reader v5.5

## 1.5.0

- Update to DSMR-reader v5.4

## 1.4.0

- Update to DSMR-reader v5.3

## 1.3.1

- Fix panel icon https://github.com/sanderdw/hassio-addons/issues/53

## 1.3.0

- As always, backup first!
- Update to DSMR-reader v5.2

## 1.2.1

- As always, backup first!
- Ingress support now standard enabled and port forward removed (reset configuration could be required)
- Additional Reverse Proxy support, see https://github.com/sanderdw/hassio-addons/issues/24
- Added Datalogger API configuration

## 1.2.0

- As always, backup first!
- Don't use the 'OPEN WEB UI' button as it's used for Ingress only, so open the url (you can find it in the addon log) manually
- Ingress support in BETA (need to be specifically enabled in configuration for now and needs a reinstall of the addon)
- Technical: bashio support and code cleanup

## 1.1.2

- As always, backup first!
- Uninstall and reinstall/reconfigure if "image does not exist" error pops up.
- Faster install time (moved to Github Actions)

## 1.1.1

- As always, backup first!
- Support for PostgreSQL 14 (such as the TimescaleDB 2.0.0 Addon)

## 1.1.0

- Update to DSMR-reader v5.1
- Use log level "ERROR" (standard)

## 1.0.0

- Backup first! Make a db backup first if you want to be able to revert.
- Updating from previous version? After the update go to the addon "Configuration" tab and next to "Options" choose "Reset to defaults" (Not the one below "Network") and apply your settings again.
- Update to DSMR-reader v5.0
- Refactor code and using new s6 image
- Big Thanks to Dennis Siemensma and Bram van Dartel for this new release

## 0.7.4

- Revert to older image (again) to fix high cpu and performance

## 0.7.3

- Fixes to underlying image applied (Thanks Xirixiz)
- Added debug mode

## 0.7.2

- Revert to older image to fix usb errors

## 0.7.1 (Beta)

- Try to fix underlying image, don't update yet!

## 0.7.0

- Update to DSMR-reader v4.19

## 0.6.0

- Update to DSMR-reader v4.18

## 0.5.1

- Update to DSMR-reader v4.16.3

## 0.5.0

- Update to DSMR-reader v4.16.2

## 0.4.2

- Update to DSMR-reader v4.15.2

## 0.4.1

- Update to DSMR-reader v4.15.1

## 0.4.0

- Update to DSMR-reader v4.15.0

## 0.3.1

- Support for DATALOGGER_SLEEP

## 0.3.0

- Update to DSMR-reader v4.14.0

## 0.2.1

- DSMR-reader v4.13.0 available for arm32v7
- Base image updates for amd64 & arm64v8

## 0.2.0

- Update to DSMR-reader v4.13.0 (amd64 & arm64v8 only)
- Simplified configuration with dropdowns
- NOTE: Check DATALOGGER_MODE & DATALOGGER_INPUT_METHOD configurations after updating

## 0.1.3

- Update base images (PostgreSQL 12.6 client working on arm32v7, arm32v6 is deprecated)

## 0.1.2

- Fixed PostgreSQL 12.6 client version (arm32 is deprecated and not updated)

## 0.1.1

- Added script to help with commandline actions

## 0.1.0

- Update to DSMR-reader v4.12.0

## 0.0.4

- Extended configuration options
- Added arm32v6

## 0.0.3

- Bugfix Webui link

## 0.0.2

- Easy Webui link
- Added backup option and instructions (see step 10)
- NOTE: Make sure to perform step 10 and configure the backup functionality, even after upgrading from 0.0.1
- Added DJANGO_DATABASE_PORT option
- Corrected mismatch version numbering from 0.1 to 0.0.2

## 0.0.1

- Initial Alpha version (DSMR-reader v4.11)
