"""Validation tests for all add-on config.json files.

These tests verify that every add-on's configuration file adheres to the
Home Assistant add-on manifest structure and that internal consistency
constraints are met (e.g., every option key listed in 'options' also
appears in 'schema').
"""

import json
import os
import re
import unittest

# Discover config files relative to the repository root.
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ADDON_DIRS = ["dsmr_datalogger", "dsmr_reader", "metabase", "voltviz"]
VALID_ARCHS = {"aarch64", "amd64", "armhf", "armv7", "i386"}

# Fields that MUST be present in every add-on manifest.
REQUIRED_FIELDS = {"name", "version", "slug", "description", "arch", "image"}

# Supported schema primitive types used across add-ons.
SCHEMA_PRIMITIVE_PATTERN = re.compile(
    r"^(str|str\?|int|int\?|float|float\?|bool|bool\?|password|password\?|list\(.+\))$"
)


def _load_config(addon_dir):
    path = os.path.join(REPO_ROOT, addon_dir, "config.json")
    with open(path) as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# Parametrised base – one subclass per add-on
# ---------------------------------------------------------------------------


class ConfigJsonMixin:
    """Shared test logic applied to each add-on's config.json."""

    addon_dir: str  # subclasses set this

    def _config(self):
        return _load_config(self.addon_dir)

    # --- Required fields ---------------------------------------------------

    def test_required_fields_present(self):
        """All mandatory manifest fields must exist."""
        cfg = self._config()
        for field in REQUIRED_FIELDS:
            with self.subTest(field=field):
                self.assertIn(field, cfg, f"Missing required field: '{field}'")

    def test_name_is_non_empty_string(self):
        cfg = self._config()
        self.assertIsInstance(cfg["name"], str)
        self.assertTrue(cfg["name"].strip(), "name must not be blank")

    def test_version_is_semver_like(self):
        """Version should follow MAJOR.MINOR.PATCH (with optional pre-release)."""
        cfg = self._config()
        self.assertRegex(
            cfg["version"],
            r"^\d+\.\d+\.\d+",
            "version must start with MAJOR.MINOR.PATCH",
        )

    def test_slug_is_valid_identifier(self):
        """Slug must be lowercase alphanumeric with underscores only."""
        cfg = self._config()
        self.assertRegex(
            cfg["slug"],
            r"^[a-z0-9_]+$",
            "slug must be lowercase alphanumeric/underscores",
        )

    def test_description_is_non_empty_string(self):
        cfg = self._config()
        self.assertIsInstance(cfg["description"], str)
        self.assertTrue(cfg["description"].strip(), "description must not be blank")

    # --- Architecture ---------------------------------------------------

    def test_arch_is_non_empty_list(self):
        cfg = self._config()
        self.assertIsInstance(cfg["arch"], list)
        self.assertTrue(cfg["arch"], "arch list must not be empty")

    def test_arch_values_are_supported(self):
        cfg = self._config()
        for arch in cfg["arch"]:
            with self.subTest(arch=arch):
                self.assertIn(
                    arch, VALID_ARCHS, f"Unsupported architecture: '{arch}'"
                )

    # --- Image -----------------------------------------------------------

    def test_image_contains_arch_placeholder(self):
        """The image field must use the {arch} placeholder for multi-arch builds."""
        cfg = self._config()
        self.assertIn(
            "{arch}",
            cfg["image"],
            "image must include the '{arch}' placeholder",
        )

    def test_image_references_expected_registry(self):
        """All images should be hosted on ghcr.io."""
        cfg = self._config()
        self.assertTrue(
            cfg["image"].startswith("ghcr.io/"),
            "image should reference ghcr.io registry",
        )

    # --- Options / Schema consistency ------------------------------------

    def test_options_and_schema_keys_match(self):
        """Every key in 'options' must also appear in 'schema' and vice-versa."""
        cfg = self._config()
        if "options" not in cfg or "schema" not in cfg:
            self.skipTest("Add-on has no options/schema")

        option_keys = set(cfg["options"].keys())
        schema_keys = set(cfg["schema"].keys())

        missing_from_schema = option_keys - schema_keys
        missing_from_options = schema_keys - option_keys

        # Optional schema keys (ending with '?') may have no default in options.
        # Filter them out to avoid false positives.
        truly_missing_from_options = {
            k for k in missing_from_options
            if not (isinstance(cfg["schema"].get(k), str) and cfg["schema"][k].endswith("?"))
        }

        self.assertFalse(
            missing_from_schema,
            f"Keys in options but not in schema: {missing_from_schema}",
        )
        self.assertFalse(
            truly_missing_from_options,
            f"Required schema keys missing from options: {truly_missing_from_options}",
        )

    def test_schema_types_are_valid(self):
        """Every schema value must be a recognised type string."""
        cfg = self._config()
        if "schema" not in cfg:
            self.skipTest("Add-on has no schema")

        for key, type_str in cfg["schema"].items():
            with self.subTest(key=key):
                self.assertIsInstance(type_str, str, f"Schema type for '{key}' is not a string")
                self.assertRegex(
                    type_str,
                    SCHEMA_PRIMITIVE_PATTERN,
                    f"Unrecognised schema type for '{key}': '{type_str}'",
                )

    # --- Startup / boot --------------------------------------------------

    def test_startup_value_is_valid_if_present(self):
        cfg = self._config()
        if "startup" not in cfg:
            return
        self.assertIn(
            cfg["startup"],
            {"application", "services", "system", "initialize", "once"},
            "Invalid startup value",
        )

    def test_boot_value_is_valid_if_present(self):
        cfg = self._config()
        if "boot" not in cfg:
            return
        self.assertIn(cfg["boot"], {"auto", "manual"}, "Invalid boot value")


# ---------------------------------------------------------------------------
# One concrete test class per add-on
# ---------------------------------------------------------------------------


class TestDsmrDataloggerConfig(ConfigJsonMixin, unittest.TestCase):
    addon_dir = "dsmr_datalogger"


class TestDsmrReaderConfig(ConfigJsonMixin, unittest.TestCase):
    addon_dir = "dsmr_reader"


class TestMetabaseConfig(ConfigJsonMixin, unittest.TestCase):
    addon_dir = "metabase"


class TestVoltvizConfig(ConfigJsonMixin, unittest.TestCase):
    addon_dir = "voltviz"


# ---------------------------------------------------------------------------
# Cross-add-on tests
# ---------------------------------------------------------------------------


class TestAllAddonsJson(unittest.TestCase):
    """Tests that validate properties across all add-on configs at once."""

    def _all_configs(self):
        return {d: _load_config(d) for d in ADDON_DIRS}

    def test_all_config_files_are_valid_json(self):
        """Every config.json must be parseable without error."""
        for addon in ADDON_DIRS:
            with self.subTest(addon=addon):
                cfg = _load_config(addon)
                self.assertIsInstance(cfg, dict)

    def test_slug_values_are_unique_across_addons(self):
        """No two add-ons may share the same slug."""
        slugs = [cfg["slug"] for cfg in self._all_configs().values()]
        self.assertEqual(len(slugs), len(set(slugs)), "Duplicate slugs found")

    def test_name_values_are_unique_across_addons(self):
        """Each add-on must have a distinct display name."""
        names = [cfg["name"] for cfg in self._all_configs().values()]
        self.assertEqual(len(names), len(set(names)), "Duplicate names found")


if __name__ == "__main__":
    unittest.main()
