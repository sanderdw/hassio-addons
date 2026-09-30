# Home Assistant App: VoltViz

## Installation

1. Add the repository to Home Assistant: `https://github.com/sanderdw/hassio-addons`
2. Install the **VoltViz** App
3. Start the App
4. Click **OPEN WEB UI** to access VoltViz via Ingress
5. Connect to Sendspin (For Music Assistant)
6. Press play
7. Select the VoltViz player (automatically visible in Music Assistant after connecting)

Youtube Video: [https://youtu.be/ONP__FHpd-M](https://youtu.be/ONP__FHpd-M)
<source src="https://uto-mix.sanwil.net/install-voltviz.mp4" type="video/mp4" />

## Configuration

| Option | Description |
|--------|-------------|
| **Sendspin URL** (`SENDSPIN_URL`) | (Optional) Internal URL of your Sendspin server for server-side proxying. Example: `http://d5369777-music-assistant:8927` |

## Ingress

This App uses Home Assistant Ingress for seamless integration. Click "OPEN WEB UI" in the app panel to access VoltViz directly within Home Assistant.

## Sendspin / Music Assistant

VoltViz supports [Music Assistant](https://music-assistant.io/) through [Sendspin](https://www.sendspin-audio.com/).

### Server-side proxy (recommended)

By default, VoltViz connects to Sendspin directly from the browser. This only works on internal networks without HTTPS (due to mixed content restrictions). To solve this, the app can proxy Sendspin through the server side:

1. In the app **Configuration** tab, set **Sendspin URL** (`SENDSPIN_URL`) to your Music Assistant's internal address:
   ```
   http://d5369777-music-assistant:8927
   ```
2. Restart the app
3. Open VoltViz and click the Sendspin button
4. Enter `./sendspin-proxy/` as the server URL and click Connect

This routes all Sendspin traffic (including WebSocket) through HA Ingress, so it works over HTTPS without direct network access to the Music Assistant server.

You can also bookmark it by appending `?sendspin=./sendspin-proxy/` to the VoltViz URL — the connection dialog will open automatically with the URL pre-filled.

With `SENDSPIN_URL` pointing at the Music Assistant app (the default) and VoltViz opened from the Home Assistant sidebar, the playback bar also gets Music Assistant's queue, a **Start** list with your playlists, recently played and search for when nothing is queued, and a favorite button.

### Direct connection

Alternatively, click the Sendspin button and enter the server URL directly (e.g. `http://192.168.1.100:8927`). This requires HTTP access from the browser to the server.

## Deep-Link Support

You can link directly to a specific visualizer with custom settings using URL parameters:

| Parameter   | Description                         | Default |
|-------------|-------------------------------------|---------|
| viz         | Visualizer name (e.g. tunnel, polysphere) | halftonepulse |
| sensitivity | Audio reactivity multiplier (0.1–3.0) | 1.0     |
| speed       | Animation speed multiplier (0.1–3.0) | 1.0     |
| hueShift    | Color shift in degrees (0–360)      | 0       |
| scale       | Element scale multiplier (0.5–3.0)  | 1.0     |
| skin        | UI theme: modern, win95, winamp, crt | modern |
| agc         | 1 enables Auto Gain                 | off     |
| aibeat      | 1 enables AI Beat Tracking (extra CPU) | off  |
| style       | Music style: electronic, hard, bass, hiphop, band, chill | auto |
| shuffle     | 1 switches to a random visualizer at an interval | off |
| shuffleTime | Shuffle interval in seconds (15, 30, 60, 120, 300, 600) | 60 |
| shufflePool | Comma-separated visualizer ids to shuffle between | all |
| transition  | crossfade, quickcut or instant      | crossfade |
| sendspin    | Sendspin server URL                 |         |

## More info

- [VoltViz website](https://voltviz.com/)
- [VoltViz GitHub](https://github.com/sanderdw/voltviz)
