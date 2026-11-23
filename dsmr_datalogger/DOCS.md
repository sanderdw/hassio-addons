# Home Assistant App: DSMR Datalogger

The datalogger reads the telegrams of your smart meter and sends them to a DSMR Reader elsewhere,
through its API. That DSMR Reader stores and shows the readings.

## Prepare DSMR Reader

Switch on the API of the DSMR Reader that receives the telegrams, and copy its API key. See
[DSMR Reader's REST API](https://dsmr-reader.readthedocs.io/en/latest/reference/rest-api/).

For a DSMR 2 or 3 meter, or a meter from outside the Netherlands, also set the meter's DSMR
version in that DSMR Reader's datalogger settings.

## Configure the app

1. On the **Configuration** tab, set **DSMR Reader address** to the receiving DSMR Reader, for
   example `http://192.168.1.10:7777`.
2. Set **API key** to the key from step one of "Prepare DSMR Reader".
3. Choose the **Input**:
   - `serial`: the P1 cable is connected to this device. Set **Serial port** to it. Home
     Assistant lists the ports under **Settings** -> **System** -> **Hardware**. A
     `/dev/serial/by-id/...` path stays the same when you plug in other USB devices.
   - `ipv4`: the P1 cable is connected to another device in your network, for example with
     ser2net. Set **Network host** and **Network port** to that device.
4. Click **Save** and start the app.

The app stops with an error when the address or the API key is still the example, or when input
`ipv4` has no network host or port. The **Log** tab says what to change.

To send the telegrams to more than one DSMR Reader, separate the addresses with commas, and the
API keys too, in the same order.

### DSMR 2 and 3 meters

Set **Baud rate** to 9600, **Byte size** to 7 and **Parity** to E. In YAML mode:

```yaml
DATALOGGER_SERIAL_BAUDRATE: 9600
DATALOGGER_SERIAL_BYTESIZE: 7
DATALOGGER_SERIAL_PARITY: E
```

## Troubleshooting

Switch on **Debug logging** to see every telegram and every answer from DSMR Reader in the
**Log** tab. Switch it off again afterwards: it writes a lot.

When the P1 cable is pulled out, or the meter or DSMR Reader does not answer for a while, the
datalogger stops and starts again every 10 seconds, with the reason in the log.
