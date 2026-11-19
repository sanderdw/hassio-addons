# Home Assistant App: DSMR Datalogger

## Prepare API
Make sure to prepare the API at the DSMR-reader instance you’ll forward the telegrams to. For more information configuring it, see the API settings (https://dsmr-reader.readthedocs.io/en/v5/reference/api.html).

## Configure the app

The app needs to know where your P1 reader can be found, and therefore,
you'll need to configure the app to point to the right device.

If you're using Home Assistant you may find the correct value for this on the
`Supervisor -> System -> Host system -> Hardware` page.

1. When updated, please reset configuration to it's default first ("RESET TO DEFAULTS" on the Configuration tab after installing/updating).
2. Replace `/dev/ttyUSBX` in the **Serial port** option in the app configuration and specify
   the device name.
3. Specifiy the correct `http(s)://<YOUR_DSMR_HOST>:<PORT>` url in the **DSMR Reader address** option in the app configuration.
4. Replace `<YOUR_API_KEY>` in the **API key** option to your API key (see https://dsmr-reader.readthedocs.io/en/v4/api.html for help).
5. Click on "SAVE" to save the app configuration.
6. Start the app.

### Note for DSMR v2/3 try to use this configuration:

Set **Baud rate** to 9600, **Byte size** to 7 and **Parity** to E. In YAML mode:

```
DATALOGGER_SERIAL_BAUDRATE: '9600'
DATALOGGER_SERIAL_BYTESIZE: '7'
DATALOGGER_SERIAL_PARITY: 'E'
```
