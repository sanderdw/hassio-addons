# Changelog

## [0.22.2] - 2026-08-30

### Fixed
- 0.22.1's "wait for activation" check could still report connected on a bare socket open; it now waits for real server state, shows a clear error after 10 seconds against an incompatible server, and stops the endless silent reconnect loop. The visualizer also no longer starts on a silent stream before activation.

## [0.22.1] - 2026-08-30

### Fixed
- The VoltViz player shows up in Music Assistant 2.10.x again: 0.22.0 advertised a product name Music Assistant does not recognize as a web player, so MA classified VoltViz as a protocol endpoint and wrapped it in a hidden auto-created "universal player" with no working transport controls. VoltViz now advertises itself as a web player again.
- The player is automatically unhidden *and* exposed to Home Assistant once Music Assistant has actually registered it (with retries), instead of a single racy fire-and-forget call right after the socket opened.
- The UI no longer claims "connected" on a bare WebSocket open; it waits for the server to activate the player and reports an error after 10 seconds if that never happens (e.g. an incompatible Music Assistant version).

### Known limitations
- Sendspin mode requires Music Assistant 2.10.0b14 or newer (verified against 2.10.1); older builds close the connection silently during the encryption handshake.

## [0.22.0] - 2026-08-30

### Changed
- Dependency bumps

### Fixed
- Sendspin player registration is now stable across page reloads and reconnects: the Sendspin SDK persists a long-lived identity keypair in browser storage and uses it as the Music Assistant player id, so each browser re-registers as the same player.
- Mobile playback now unlocks audio before connecting, satisfying mobile browser autoplay policies for seamless playback.

### Known limitations
- Sendspin mode requires Music Assistant 2.10.0b13: upstream pins `@sendspin/sendspin-js` to 4.0.0 to match the `aiosendspin` 7.0.0 encryption/pairing spec, so it cannot connect to Music Assistant 2.9.x stable.

## [0.21.1] - 2026-08-01

### Fixed
- Visualizer preview thumbnails in the gallery picker now load correctly through Home Assistant ingress (upstream now builds with relative asset URLs).

## [0.21.0] - 2026-08-01

### Added
- Visualizer gallery picker – the header dropdown is replaced by a modal with preview screenshot cards for every visualizer.
- Shuffle mode – toggle in the settings panel that switches to a random visualizer at a selectable interval (15s–10m), persisted via `shuffle`/`shuffleTime` URL params.
- Seamless crossfade between visualizers – the previous visualizer keeps rendering while the next one loads and warms up, then fades in; applies to shuffle switches and manual selection.
- Transition style setting (Crossfade / Quick cut / Instant) in the settings panel, persisted via the `transition` URL param – lighter modes for low-end hardware.
- Sungalizer visualizer – retro amber-phosphor CRT quad analyzer: 2D spectrum, 3D depth-trace waterfall, scrolling spectrogram, and oscilloscope, plus a hardware-style side panel with reactive VU needle and knobs (Canvas 2D).

### Changed
- Visualizer registration consolidated into a single manifest; new visualizers need just one entry plus a generated thumbnail.
- Dependency bumps

## [0.20.0] - 2026-07-06

### Added
- Particles Stream visualizer - flies a luma-sliced pixel-particle field of the album artwork toward the camera with afterimage motion blur; bass-reactive speed and brightness, with image upload (Three.js/WebGL).

### Changed
- Dependency bumps

## [0.19.1] - 2026-06-17

### Added
- Holo Blinds visualizer – raymarched twisting gyroid confined to a squashed sphere core with audio-reactive brightness, twist speed, and detail (Three.js/WebGL).
- Inside Quantum visualizer – full-screen KIFS fractal with volumetric raymarching, asymmetric folding, domain warping, and accumulated glow (Three.js/WebGL). Audio-reactive warp amplitude, rotation speed, and ray thickness.

### Changed
- Dependency bumps

## [0.18.0] - 2026-05-23

### Added
- Skins system – switch the entire UI between **Modern**, **Win95**, **Winamp**, and **CRT** themes (via `?skin=` URL parameter).
- ASCII visualizer – Canvas 2D audio-reactive ASCII art renderer.
- Cyber City visualizer – raymarched neon-grid cityscape flythrough with audio-driven scan pulses, fog, and dot density (Three.js/WebGL).
- Audio Debug visualizer – diagnostic view with waveform, FFT spectrum, kick detection, stereo correlation meter, and rolling spectrogram (Canvas 2D).
- Aurum Leaf visualizer – tentacled energy bloom with particles, kick-reactive bloom bursts, and UnrealBloom post-processing (Three.js/WebGL).
- Sphere visualizer – raymarched KIFS-folded sphere with auto-rotation and audio-reactive brightness/zoom (Three.js/WebGL).
- Trails Stream visualizer – bending tube-trail stream with blur, bloom, and audio-reactive exposure (Three.js/WebGL).
- Shambhala visualizer – voxel tunnel raymarcher with space-folding, glow, and audio-reactive exposure (Three.js/WebGL).

### Changed
- FractalOrb: refactored audio analysis and visual response for tighter reactivity.
- Vite: raised `chunkSizeWarningLimit` from 550 to 600 to accommodate the new shader-heavy visualizers.
- Dependency bumps

## [0.17.0] - 2026-05-13

### Added
- Music Assistant player visibility: Sendspin player is now automatically unhidden in Music Assistant after connecting, so it is visible in the UI.
- Moss Ball visualizer.
- Razor 1911 visualizer.

### Changed
- Updated Sendspin correction mode from `sync` to `quality-local`.
- Dependency bumps

## [0.16.0] - 2026-05-08

### Added
- Aurora Waves visualizer – raymarched fractal wave field with glowing volumetric accumulation, audio-reactive wave amplitudes, glow, and time scaling (Three.js/WebGL).
- MS Defrag visualizer – nostalgic Microsoft Defragmenter screen with cluster grid, audio-driven reading/writing/optimizing events, progress bar, and elapsed clock (Canvas 2D).
- Fractal Orb visualizer – raymarched fractal energy sphere with audio-reactive density, internal animation speed, glow, chromatic aberration, and pulsing scale (Three.js/WebGL).
- Dependency bumps

### Added
- MilkDrop Warp visualizer – deep-tunnel feedback variant with vortex spiral warp, radial frequency bars, waveform spirals, concentric depth rings, and cross-shaped energy flare (Three.js/WebGL).
- MilkDrop visualizer – audio-reactive feedback-warp visualizer with ping-pong framebuffers, per-pixel motion vectors, kaleidoscopic symmetry, and psychedelic color cycling (Three.js/WebGL).
- Dependency bumps
- Remove patches because of [sendspin-js 3.1.0](https://github.com/Sendspin/sendspin-js/releases/tag/3.1.0) release

## [0.14.0] - 2026-04-22

- Hex Globe visualizer – audio-reactive hexagonal globe inspired by https://github.com/wehwayne2/x-challenge-geo (Three.js/WebGL).
- Fixed error messages being hidden behind the Sendspin connect dialog by rendering the error toast at the root level with a higher z-index.
- Reduced MusicGrid internal sensitivity by 0.8× damping factor to lower over-reactivity to audio.
- Dependency bumps

## 0.13.3

- Initial Home Assistant add-on release
- Based on VoltViz 0.13.3
- Home Assistant Ingress support
