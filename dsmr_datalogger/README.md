# Home Assistant Add-on: DSMR Datalogger

The datalogger only option of DSMR (https://dsmr-reader.readthedocs.io).

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg

### Configure the add-on

The add-on needs to know where your P1 reader can be found, and therefore,
you'll need to configure the add-on to point to the right device.

If you're using Home Assistant you may find the correct value for this on the
`Supervisor -> System -> Host system -> Hardware` page.

1. Replace `/dev/ttyUSBX` in the `DSMR_USB_PORT` option in the add-on configuration and specify
   the device name.
2. Specifiy the correct `http(s)://<YOUR_DSMR_HOST>/api/v1/datalogger/dsmrreading` url in the `DSMR_API_URL` option in the add-on configuration.
3. Replace `<YOUR_API_KEY>` in the `DSMR_API_KEY` option to your API key (see https://dsmr-reader.readthedocs.io/nl/v3/admin/api.html for help).
4. Click on "SAVE" to save the add-on configuration.
5. Start the add-on.
