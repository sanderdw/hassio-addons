# Changelog

## 1.3.1

- The app stops with a clear message in its log when an option still needs a value: the DSMR Reader address or API key is still the example, or input `ipv4` has no network host or port. Before, it tried again every 10 seconds with a Python error.
- The Configuration tab offers **Input** and **Parity** as a choice, checks the **Network port**, and hides the **API key**. Your settings stay as they are.
- The datalogger script is the current one of DSMR Reader v6. It refuses an input other than `serial` or `ipv4`, and its "Failed to connect" message is readable now.
- Technical: the datalogger runs as the service's own process instead of under a shell, so the stop signal reaches it.
- The documentation is up to date with Home Assistant's menus and links to DSMR Reader v6's documentation.
- Technical: requests 2.34.2.

## 1.3.0

- Python 3.14 on Alpine Linux 3.24 (`ghcr.io/home-assistant/base-python:3.14-alpine3.24`). Alpine 3.21 is no longer supported since 1 November 2026.
- The app has its own AppArmor profile, which limits what it may do on your system. Home Assistant raises its security rating from 7 to 8.
- The documentation moved to the app's **Documentation** tab. The Info tab keeps a short introduction.
- Technical: one image for both architectures (`ghcr.io/sanderdw/hassio-addons/ha-dsmr-datalogger`), built with Home Assistant's builder and signed with Cosign.
- Technical: the datalogger is an s6-rc service, the current S6 overlay layout.

## 1.2.2

- The Configuration tab shows readable names and explanations for every option, in English and Dutch. Your settings stay as they are.
- Drop support for 32-bit systems (`armhf`, `armv7`, `i386`): Home Assistant no longer supports them. The app runs on 64-bit systems (`aarch64`, `amd64`) only.
- Fix the datalogger not starting when the update check server does not answer: it waited about two minutes and then stopped. The check now gives up after 10 seconds and the datalogger starts anyway.
- The datalogger now starts again by itself after a failure, such as the P1 cable being pulled out or the meter not sending for a while. Before, the app stopped and stayed stopped. It tries again every 10 seconds; the reason is in the log.

## 1.2.1

- Technical: Update GitHub Actions workflow to the latest action versions

## 1.2.0

- Happy 2025!
- Use of base-python:3.13-alpine3.21
- Update packages
- Technical: Github Action workflow updated (switch to ghcr.io)
- Technical: S6 Overlay v3

## 1.1.0

- As always, backup first!
- Refactor for DSMR Reader v5
- Extra options (may be required to reset the addon configuration to see them all)
- Uninstall and reinstall/reconfigure if "image does not exist" error pops up.
- Faster install time (moved to Github Actions)

## 1.0.3

- Support for DATALOGGER_SLEEP

## 1.0.2

- Changed auto_uart to uart config.json (https://github.com/home-assistant/supervisor/issues/2533). Make sure to run a recent version of Home Assistant before you upgrade
- NOTE: Just released the DSMR Reader Add-on! See https://community.home-assistant.io/t/dsmr-reader-add-on-for-home-assistant/279087

## 1.0.1

- Ready for DSMR meter versions 2/3 (Added DATALOGGER_SERIAL_BYTESIZE and DATALOGGER_SERIAL_PARITY configuration parameters)

## 1.0.0

- Switch to the most recent dsmr_datalogger_api_client.py v4
- NOTE: As the configuration options are changed, please reset configuration to it's default first after installing/updating ("RESET TO DEFAULTS" on the Configuration tab).
- NOTE: You don't have to specifiy the full API url anymore. http(s)://<YOUR_DSMR_HOST>:<PORT> is enough.

## 0.1.0

- Switch to the most recent dsmr_datalogger_api_client.py and updated pip packages

## 0.0.4

- Switch to Home Assistant Python Base images

## 0.0.3

- Initial Beta version