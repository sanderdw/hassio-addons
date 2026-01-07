# AGENTS.md - AI Agent Instructions

This document provides guidance for AI coding agents working on this Home Assistant Add-ons repository.

## Repository Overview

This is a **Home Assistant Add-ons repository** containing custom add-ons for Home Assistant OS/Supervised installations. Add-ons are containerized applications that extend Home Assistant functionality.

- **Repository URL**: https://github.com/sanderdw/hassio-addons
- **Maintainer**: Sander de Wildt
- **Documentation**: https://developers.home-assistant.io/docs/add-ons

## Add-ons in This Repository

| Add-on | Description | Architectures |
|--------|-------------|---------------|
| `dsmr_datalogger` | Lightweight datalogger for DSMR smart meters, forwards telegrams via API | armhf, armv7, aarch64, amd64, i386 |
| `dsmr_reader` | Full DSMR Reader application for smart meter data visualization | armhf, armv7, aarch64, amd64 |
| `metabase` | Open-source business intelligence and analytics platform | aarch64, amd64 |

## Repository Structure

```
hassio-addons/
├── .github/workflows/       # GitHub Actions for building container images
├── repository.json          # Repository metadata for Home Assistant
├── README.md                # Repository documentation
├── images/                  # Screenshot images for documentation
│
├── dsmr_datalogger/         # DSMR Datalogger add-on
│   ├── config.json          # Add-on configuration and schema
│   ├── Dockerfile           # Container build instructions
│   ├── CHANGELOG.md         # Version history
│   ├── README.md            # Add-on documentation
│   ├── requirements.txt     # Python dependencies
│   └── rootfs/              # Files copied into the container
│       ├── etc/services.d/  # s6-overlay service definitions
│       └── usr/bin/         # Executable scripts
│
├── dsmr_reader/             # DSMR Reader add-on
│   ├── config.json
│   ├── Dockerfile
│   ├── CHANGELOG.md
│   ├── README.md
│   └── rootfs/
│       ├── cli-helper.sh    # CLI helper for container access
│       └── etc/             # s6-overlay and nginx configurations
│
└── metabase/                # Metabase add-on
    ├── config.json
    ├── Dockerfile
    ├── CHANGELOG.md
    ├── README.md
    └── run.sh               # Entrypoint script
```

## Key Files Explained

### `config.json` (Per Add-on)

The `config.json` is the **most important file** for each add-on. It defines:

- `name`, `version`, `slug`: Add-on identity
- `description`: Short description shown in Home Assistant UI
- `arch`: Supported CPU architectures (e.g., `aarch64`, `amd64`, `armv7`)
- `image`: Container image location (uses `{arch}` placeholder)
- `options`: Default configuration values
- `schema`: Configuration validation schema
- `ports`: Network port mappings
- `map`: Volume mappings (`share`, `backup`, etc.)
- `uart`: Whether USB/serial access is needed
- `ingress`: Whether the add-on uses Home Assistant Ingress
- `init`: Whether to use the default init system

**Schema Types**: `str`, `str?` (optional), `int`, `float`, `bool`, `password`, `list(...)`

### `Dockerfile`

Each add-on has a Dockerfile that:
- Uses `ARG BUILD_FROM` for the base image (set by the builder)
- Uses `ARG BUILD_ARCH` and `ARG HA_RELEASE` for labels
- Copies `rootfs/` contents into the container
- May install [Bashio](https://github.com/hassio-addons/bashio) for configuration access

### `rootfs/`

Contains files to be copied into the container root filesystem:
- Service scripts in `etc/services.d/` or `etc/s6-overlay/s6-rc.d/`
- Configuration files in `etc/`
- Executable scripts in `usr/bin/`

### GitHub Workflows

Located in `.github/workflows/`, these build and push multi-arch container images to:
- GitHub Container Registry (ghcr.io)

Triggered on pushes to `master` branch or when specific add-on files change.

## Development Guidelines

### Making Changes to an Add-on

1. **Configuration changes**: Edit `config.json`
   - Bump the `version` field when making releases
   - Update `options` for new defaults
   - Update `schema` for new configuration options

2. **Container changes**: Edit `Dockerfile` and/or `rootfs/` contents
   - Use s6-overlay for service management
   - Use Bashio (`bashio::config 'option_name'`) to read config values

3. **Documentation**: Update the add-on's `README.md` and `CHANGELOG.md`

### Version Bumping

When releasing a new version:
1. Update `version` in the add-on's `config.json`
2. Add entry to `CHANGELOG.md`
3. Update workflow file if tracking a specific branch (e.g., `reader-1.12.2`)

### Testing Add-ons

- Use the Home Assistant Add-on Builder: https://github.com/home-assistant/builder
- Local testing: https://developers.home-assistant.io/docs/add-ons/testing
- Add-ons can be tested by adding the repository to a Home Assistant instance

### Architecture Support

- Always specify supported architectures in `config.json`
- Use multi-platform Docker builds in GitHub Actions
- Common architectures: `amd64`, `aarch64`, `armv7`, `armhf`, `i386`

## Common Tasks

### Adding a New Configuration Option

1. Add default value to `options` in `config.json`
2. Add schema validation to `schema` in `config.json`
3. Read the value in scripts using Bashio: `bashio::config 'OPTION_NAME'`
4. Document the option in `README.md`

### Creating a New Add-on

1. Create a new directory (e.g., `new_addon/`)
2. Add required files:
   - `config.json` - Configuration and metadata
   - `Dockerfile` - Build instructions
   - `README.md` - Documentation
   - `CHANGELOG.md` - Version history
   - `rootfs/` - Container filesystem overlay
3. Create GitHub workflow in `.github/workflows/`
4. Add badges and links to root `README.md`

### Updating Base Images

- `dsmr_reader` uses: `ghcr.io/xirixiz/dsmr-reader-docker`
- `dsmr_datalogger` uses: Home Assistant base images
- `metabase` uses: Home Assistant base images with Metabase JAR

Update base image versions in the respective GitHub workflow files.

## External Resources

- [Home Assistant Add-on Documentation](https://developers.home-assistant.io/docs/add-ons)
- [Add-on Configuration Reference](https://developers.home-assistant.io/docs/add-ons/configuration)
- [Bashio Library](https://github.com/hassio-addons/bashio)
- [s6-overlay](https://github.com/just-containers/s6-overlay)
- [Home Assistant Builder](https://github.com/home-assistant/builder)
- [Community Add-ons Repository](https://github.com/hassio-addons) (good examples)

## Add-on Specific Notes

### DSMR Datalogger
- Lightweight Python-based datalogger
- Forwards DSMR telegrams to DSMR Reader API
- Requires UART access for serial communication
- Dependencies in `requirements.txt`

### DSMR Reader
- Full application with web UI
- Uses Ingress for Home Assistant integration
- Requires PostgreSQL database (TimescaleDB add-on recommended)
- Based on upstream Docker image by xirixiz

### Metabase
- Java-based application (requires JVM)
- Supports H2 (embedded) or PostgreSQL database
- No Ingress support yet - uses direct port access
- Memory-intensive (configure `JAVA_OPTS` appropriately)

## Code Style

- Shell scripts: Use `#!/usr/bin/with-contenv bashio` for s6-overlay scripts
- Python: Follow PEP 8 guidelines
- JSON: Use 2-space indentation in `config.json`
- Dockerfile: Include proper labels as per OCI specification
