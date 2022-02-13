# Home Assistant Add-on: DSMR Datalogger
[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fsanderdw%2Fhassio-addons)

The datalogger only option of DSMR (https://dsmr-reader.readthedocs.io). This will install a datalogger that will forward telegrams to another fully installed instance of DSMR-reader, using its API.

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield] [![Community Forum][forum-shield]][forum]

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg?style=flat-square
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg?style=flat-square
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg?style=flat-square
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg?style=flat-square
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg?style=flat-square
[forum-shield]: https://img.shields.io/badge/community-forum-brightgreen.svg?style=flat-square
[forum]: https://community.home-assistant.io/t/dsmr-datalogger-add-on-for-home-assistant/181123

## Configure the repository

See config instructions here: https://github.com/sanderdw/hassio-addons

## Prepare API
Make sure to prepare the API at the DSMR-reader instance you’ll forward the telegrams to. For more information configuring it, see the API settings (https://dsmr-reader.readthedocs.io/en/v4/api.html).

## Configure the add-on

The add-on needs to know where your P1 reader can be found, and therefore,
you'll need to configure the add-on to point to the right device.

If you're using Home Assistant you may find the correct value for this on the
`Supervisor -> System -> Host system -> Hardware` page.

1. When updated, please reset configuration to it's default first ("RESET TO DEFAULTS" on the Configuration tab after installing/updating).
2. Replace `/dev/ttyUSBX` in the `DATALOGGER_SERIAL_PORT` option in the add-on configuration and specify
   the device name.
3. Specifiy the correct `http(s)://<YOUR_DSMR_HOST>:<PORT>` url in the `DATALOGGER_API_HOSTS` option in the add-on configuration.
4. Replace `<YOUR_API_KEY>` in the `DATALOGGER_API_KEYS` option to your API key (see https://dsmr-reader.readthedocs.io/en/v4/api.html for help).
5. Click on "SAVE" to save the add-on configuration.
6. Start the add-on.

### Note for DSMR v2/3 try to use this configuration:
```
DATALOGGER_SERIAL_BAUDRATE: '9600'
DATALOGGER_SERIAL_BYTESIZE: '7'
DATALOGGER_SERIAL_PARITY: 'E'
```