"""Unit tests for dsmr_datalogger_api_client.py."""

import logging
import sys
import os
import unittest
from unittest.mock import MagicMock, patch, call

# Make the script importable without executing main().
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "rootfs", "usr", "bin"))

import dsmr_datalogger_api_client as client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_TELEGRAM = (
    "/ISk5\\2MT382-1000\r\n"
    "\r\n"
    "1-3:0.2.8(50)\r\n"
    "0-0:1.0.0(200101120000W)\r\n"
    "!ABCD"
)


def _make_serial_mock(read_side_effects):
    """Return a mock serial handle whose read() returns the given sequence."""
    handle = MagicMock()
    handle.read.side_effect = read_side_effects
    return handle


# ---------------------------------------------------------------------------
# read_telegram
# ---------------------------------------------------------------------------


class TestReadTelegram(unittest.TestCase):
    """Tests for read_telegram()."""

    @patch("dsmr_datalogger_api_client.serial")
    def test_yields_complete_telegram_on_first_read(self, mock_serial_module):
        """A full telegram in the first chunk is yielded immediately."""
        telegram_bytes = SAMPLE_TELEGRAM.encode("latin_1")
        handle = _make_serial_mock([telegram_bytes, b""])
        mock_serial_module.serial_for_url.return_value = handle

        gen = client.read_telegram(
            url_or_port="/dev/ttyUSB0",
            telegram_timeout=5,
            baudrate=115200,
        )
        result = next(gen)

        self.assertIn("/ISk5", result)
        self.assertTrue(result.endswith("!ABCD"))

    @patch("dsmr_datalogger_api_client.serial")
    def test_yields_telegram_after_partial_reads(self, mock_serial_module):
        """Partial reads are buffered until a complete telegram is detected."""
        part1 = b"/ISk5\\2MT382-1000\r\n\r\n1-3:0.2.8(50)\r\n"
        part2 = b"0-0:1.0.0(200101120000W)\r\n!ABCD"
        handle = _make_serial_mock([part1, part2])
        mock_serial_module.serial_for_url.return_value = handle

        gen = client.read_telegram(url_or_port="/dev/ttyUSB0", telegram_timeout=5)
        result = next(gen)

        self.assertIn("/ISk5", result)
        self.assertIn("!ABCD", result)

    @patch("dsmr_datalogger_api_client.serial")
    def test_yields_telegram_without_checksum(self, mock_serial_module):
        """Telegrams without a checksum (legacy meters) are also detected."""
        telegram_no_checksum = b"/ISk5\\2MT382-1000\r\n\r\n1-3:0.2.8(50)\r\n!"
        handle = _make_serial_mock([telegram_no_checksum])
        mock_serial_module.serial_for_url.return_value = handle

        gen = client.read_telegram(url_or_port="/dev/ttyUSB0", telegram_timeout=5)
        result = next(gen)

        self.assertTrue(result.startswith("/"))
        self.assertIn("!", result)

    @patch("dsmr_datalogger_api_client.time")
    @patch("dsmr_datalogger_api_client.serial")
    def test_raises_runtime_error_on_timeout(self, mock_serial_module, mock_time):
        """RuntimeError is raised when no telegram is received within the timeout."""
        handle = _make_serial_mock([b"garbage data"] * 1000)
        mock_serial_module.serial_for_url.return_value = handle

        # Simulate time advancing past the timeout after the first read.
        mock_time.time.side_effect = [0.0, 100.0]

        gen = client.read_telegram(
            url_or_port="/dev/ttyUSB0", telegram_timeout=1
        )
        with self.assertRaises(RuntimeError) as ctx:
            next(gen)

        self.assertIn("too long", str(ctx.exception))

    @patch("dsmr_datalogger_api_client.serial")
    def test_raises_runtime_error_when_connection_fails(self, mock_serial_module):
        """RuntimeError is raised when the serial connection cannot be established."""
        mock_serial_module.serial_for_url.side_effect = Exception("port not found")

        gen = client.read_telegram(url_or_port="/dev/ttyUSB0", telegram_timeout=5)
        with self.assertRaises(RuntimeError) as ctx:
            next(gen)

        self.assertIn("Failed to connect", str(ctx.exception))

    @patch("dsmr_datalogger_api_client.serial")
    def test_empty_read_continues_without_yielding(self, mock_serial_module):
        """Empty reads are silently skipped and the loop continues."""
        telegram_bytes = SAMPLE_TELEGRAM.encode("latin_1")
        # First two reads are empty, third carries the full telegram.
        handle = _make_serial_mock([b"", b"", telegram_bytes])
        mock_serial_module.serial_for_url.return_value = handle

        gen = client.read_telegram(url_or_port="/dev/ttyUSB0", telegram_timeout=5)
        result = next(gen)

        self.assertIn("/ISk5", result)

    @patch("dsmr_datalogger_api_client.serial")
    def test_buffer_resets_after_yield(self, mock_serial_module):
        """After yielding, the buffer is cleared and a second telegram can be read.

        reset_input_buffer() is called after the generator resumes from each yield,
        so after obtaining N telegrams exactly N-1 resets have occurred (the last
        telegram's reset hasn't been triggered yet because the caller hasn't resumed
        the generator again).  We drive the generator one extra step to flush the
        final reset; PEP 479 converts StopIteration raised inside a generator into
        RuntimeError, so we use a plain Exception as the sentinel and catch RuntimeError.
        """
        telegram_bytes = SAMPLE_TELEGRAM.encode("latin_1")
        # Two complete telegrams followed by an error to terminate the loop.
        handle = _make_serial_mock(
            [telegram_bytes, telegram_bytes, Exception("exhausted")]
        )
        mock_serial_module.serial_for_url.return_value = handle

        gen = client.read_telegram(url_or_port="/dev/ttyUSB0", telegram_timeout=5)
        first = next(gen)
        second = next(gen)
        # Resuming the generator triggers the second reset_input_buffer(), then
        # the mock raises Exception which propagates out of the generator as RuntimeError.
        with self.assertRaises((RuntimeError, Exception)):
            next(gen)

        self.assertEqual(first, second)
        self.assertEqual(handle.reset_input_buffer.call_count, 2)


# ---------------------------------------------------------------------------
# _send_telegram_to_remote_dsmrreader
# ---------------------------------------------------------------------------


class TestSendTelegramToRemoteDsmrreader(unittest.TestCase):
    """Tests for _send_telegram_to_remote_dsmrreader()."""

    @patch("dsmr_datalogger_api_client.requests")
    def test_successful_post_returns_silently(self, mock_requests):
        """A 201 response is treated as success with no exception raised."""
        response = MagicMock()
        response.status_code = 201
        mock_requests.post.return_value = response

        # Should not raise.
        client._send_telegram_to_remote_dsmrreader(
            telegram=SAMPLE_TELEGRAM,
            api_url="http://dsmrhost/api/v1/datalogger/dsmrreading",
            api_key="abc123",
            timeout=10,
        )

        mock_requests.post.assert_called_once()

    @patch("dsmr_datalogger_api_client.requests")
    def test_post_sends_correct_authorization_header(self, mock_requests):
        """The API key is sent as a Token Authorization header."""
        response = MagicMock()
        response.status_code = 201
        mock_requests.post.return_value = response

        client._send_telegram_to_remote_dsmrreader(
            telegram=SAMPLE_TELEGRAM,
            api_url="http://dsmrhost/api/v1/datalogger/dsmrreading",
            api_key="my-secret-key",
            timeout=10,
        )

        _, kwargs = mock_requests.post.call_args
        self.assertEqual(
            kwargs["headers"]["Authorization"], "Token my-secret-key"
        )

    @patch("dsmr_datalogger_api_client.requests")
    def test_post_sends_telegram_in_body(self, mock_requests):
        """The telegram string is sent as the 'telegram' form field."""
        response = MagicMock()
        response.status_code = 201
        mock_requests.post.return_value = response

        client._send_telegram_to_remote_dsmrreader(
            telegram=SAMPLE_TELEGRAM,
            api_url="http://dsmrhost/api/v1/datalogger/dsmrreading",
            api_key="key",
            timeout=10,
        )

        _, kwargs = mock_requests.post.call_args
        self.assertEqual(kwargs["data"]["telegram"], SAMPLE_TELEGRAM)

    @patch("dsmr_datalogger_api_client.requests")
    def test_non_201_response_logs_error_and_returns(self, mock_requests):
        """Any non-201 status code is logged as an error; no exception is raised."""
        for status_code in (400, 403, 500, 502):
            with self.subTest(status_code=status_code):
                response = MagicMock()
                response.status_code = status_code
                response.text = "Error"
                mock_requests.post.return_value = response

                with self.assertLogs("dsmrreader", level="ERROR"):
                    client._send_telegram_to_remote_dsmrreader(
                        telegram=SAMPLE_TELEGRAM,
                        api_url="http://dsmrhost/api/v1/datalogger/dsmrreading",
                        api_key="key",
                        timeout=10,
                    )

    @patch("dsmr_datalogger_api_client.requests")
    def test_post_uses_configured_timeout(self, mock_requests):
        """The timeout argument is forwarded to requests.post()."""
        response = MagicMock()
        response.status_code = 201
        mock_requests.post.return_value = response

        client._send_telegram_to_remote_dsmrreader(
            telegram=SAMPLE_TELEGRAM,
            api_url="http://dsmrhost/api/v1/datalogger/dsmrreading",
            api_key="key",
            timeout=42,
        )

        _, kwargs = mock_requests.post.call_args
        self.assertEqual(kwargs["timeout"], 42)


# ---------------------------------------------------------------------------
# _initialize_logging
# ---------------------------------------------------------------------------


class TestInitializeLogging(unittest.TestCase):
    """Tests for _initialize_logging()."""

    def setUp(self):
        # Ensure a clean logger state before each test.
        logger = logging.getLogger("dsmrreader")
        logger.handlers.clear()

    @patch.dict(
        os.environ,
        {"DSMRREADER_REMOTE_DATALOGGER_DEBUG_LOGGING": "False"},
        clear=False,
    )
    def test_default_logging_level_is_error(self):
        """Without debug flag the logger is set to ERROR level."""
        client._initialize_logging()
        logger = logging.getLogger("dsmrreader")
        self.assertEqual(logger.level, logging.ERROR)

    @patch.dict(
        os.environ,
        {"DSMRREADER_REMOTE_DATALOGGER_DEBUG_LOGGING": "True"},
        clear=False,
    )
    def test_debug_flag_enables_debug_logging(self):
        """Setting the debug env var to True sets the logger to DEBUG level."""
        client._initialize_logging()
        logger = logging.getLogger("dsmrreader")
        self.assertEqual(logger.level, logging.DEBUG)

    @patch.dict(
        os.environ,
        {"DSMRREADER_REMOTE_DATALOGGER_DEBUG_LOGGING": "False"},
        clear=False,
    )
    def test_stream_handler_is_added(self):
        """A StreamHandler is always attached after initialisation."""
        client._initialize_logging()
        logger = logging.getLogger("dsmrreader")
        handler_types = [type(h) for h in logger.handlers]
        self.assertIn(logging.StreamHandler, handler_types)


# ---------------------------------------------------------------------------
# main() – configuration validation
# ---------------------------------------------------------------------------


class TestMainConfigValidation(unittest.TestCase):
    """Tests for configuration validation logic inside main()."""

    BASE_ENV = {
        "DSMRREADER_REMOTE_DATALOGGER_TIMEOUT": "20",
        "DSMRREADER_REMOTE_DATALOGGER_SLEEP": "0.5",
        "DSMRREADER_REMOTE_DATALOGGER_INPUT_METHOD": "serial",
        "DSMRREADER_REMOTE_DATALOGGER_API_HOSTS": "http://host1",
        "DSMRREADER_REMOTE_DATALOGGER_API_KEYS": "key1",
        "DSMRREADER_REMOTE_DATALOGGER_MIN_SLEEP_FOR_RECONNECT": "1.0",
        "DSMRREADER_REMOTE_DATALOGGER_SERIAL_PORT": "/dev/ttyUSB0",
        "DSMRREADER_REMOTE_DATALOGGER_SERIAL_BAUDRATE": "115200",
        "DSMRREADER_REMOTE_DATALOGGER_SERIAL_BYTESIZE": "8",
        "DSMRREADER_REMOTE_DATALOGGER_SERIAL_PARITY": "N",
        "DSMRREADER_REMOTE_DATALOGGER_DEBUG_LOGGING": "False",
    }

    def _run_main_one_iteration(self, env, telegram=SAMPLE_TELEGRAM):
        """Run main() but stop after the first iteration by having read_telegram raise StopIteration."""
        with patch.dict(os.environ, env, clear=True):
            with patch.object(client, "read_telegram") as mock_read, \
                 patch.object(client, "_send_telegram_to_remote_dsmrreader"), \
                 patch.object(client, "_initialize_logging"), \
                 patch("dsmr_datalogger_api_client.time"):
                # Yield one telegram then stop.
                mock_read.return_value = iter([telegram])
                with self.assertRaises(StopIteration):
                    client.main()

    def test_raises_when_api_hosts_missing(self):
        """RuntimeError is raised when API hosts env var is empty."""
        env = {**self.BASE_ENV, "DSMRREADER_REMOTE_DATALOGGER_API_HOSTS": ""}
        with patch.dict(os.environ, env, clear=True):
            with patch.object(client, "_initialize_logging"):
                with self.assertRaises(RuntimeError) as ctx:
                    client.main()
        self.assertIn("API_HOSTS", str(ctx.exception))

    def test_raises_when_api_keys_missing(self):
        """RuntimeError is raised when API keys env var is empty."""
        env = {**self.BASE_ENV, "DSMRREADER_REMOTE_DATALOGGER_API_KEYS": ""}
        with patch.dict(os.environ, env, clear=True):
            with patch.object(client, "_initialize_logging"):
                with self.assertRaises(RuntimeError) as ctx:
                    client.main()
        self.assertIn("API_KEYS", str(ctx.exception))

    def test_raises_when_hosts_and_keys_count_mismatch(self):
        """RuntimeError is raised when the number of hosts and keys differ."""
        env = {
            **self.BASE_ENV,
            "DSMRREADER_REMOTE_DATALOGGER_API_HOSTS": "http://host1,http://host2",
            "DSMRREADER_REMOTE_DATALOGGER_API_KEYS": "key1",
        }
        with patch.dict(os.environ, env, clear=True):
            with patch.object(client, "_initialize_logging"):
                with self.assertRaises(RuntimeError) as ctx:
                    client.main()
        self.assertIn("do not match", str(ctx.exception))

    def test_raises_on_unsupported_input_method(self):
        """RuntimeError is raised for any input method other than 'serial' or 'ipv4'."""
        env = {
            **self.BASE_ENV,
            "DSMRREADER_REMOTE_DATALOGGER_INPUT_METHOD": "bluetooth",
        }
        with patch.dict(os.environ, env, clear=True):
            with patch.object(client, "_initialize_logging"):
                with patch.object(client, "read_telegram") as mock_read, \
                     patch("dsmr_datalogger_api_client.time"):
                    mock_read.return_value = iter([SAMPLE_TELEGRAM])
                    with self.assertRaises(RuntimeError) as ctx:
                        client.main()
        self.assertIn("Unsupported", str(ctx.exception))

    def test_serial_input_method_calls_read_telegram_with_serial_params(self):
        """serial input method passes baudrate/bytesize/parity to read_telegram."""
        env = {**self.BASE_ENV, "DSMRREADER_REMOTE_DATALOGGER_INPUT_METHOD": "serial"}
        with patch.dict(os.environ, env, clear=True):
            with patch.object(client, "read_telegram") as mock_read, \
                 patch.object(client, "_send_telegram_to_remote_dsmrreader"), \
                 patch.object(client, "_initialize_logging"), \
                 patch("dsmr_datalogger_api_client.time"):
                mock_read.return_value = iter([SAMPLE_TELEGRAM])
                with self.assertRaises(StopIteration):
                    client.main()

        call_kwargs = mock_read.call_args[1]
        self.assertIn("baudrate", call_kwargs)
        self.assertIn("bytesize", call_kwargs)
        self.assertIn("parity", call_kwargs)
        self.assertEqual(call_kwargs["url_or_port"], "/dev/ttyUSB0")

    def test_ipv4_input_method_builds_socket_url(self):
        """ipv4 input method builds a socket:// URL from host and port."""
        env = {
            **self.BASE_ENV,
            "DSMRREADER_REMOTE_DATALOGGER_INPUT_METHOD": "ipv4",
            "DSMRREADER_REMOTE_DATALOGGER_NETWORK_HOST": "192.168.1.100",
            "DSMRREADER_REMOTE_DATALOGGER_NETWORK_PORT": "23",
        }
        with patch.dict(os.environ, env, clear=True):
            with patch.object(client, "read_telegram") as mock_read, \
                 patch.object(client, "_send_telegram_to_remote_dsmrreader"), \
                 patch.object(client, "_initialize_logging"), \
                 patch("dsmr_datalogger_api_client.time"):
                mock_read.return_value = iter([SAMPLE_TELEGRAM])
                with self.assertRaises(StopIteration):
                    client.main()

        call_kwargs = mock_read.call_args[1]
        self.assertIn("socket://192.168.1.100:23", call_kwargs["url_or_port"])

    def test_telegram_sent_to_all_api_hosts(self):
        """With multiple API hosts, the telegram is dispatched to every host."""
        env = {
            **self.BASE_ENV,
            "DSMRREADER_REMOTE_DATALOGGER_API_HOSTS": "http://host1,http://host2",
            "DSMRREADER_REMOTE_DATALOGGER_API_KEYS": "key1,key2",
        }
        with patch.dict(os.environ, env, clear=True):
            with patch.object(client, "read_telegram") as mock_read, \
                 patch.object(client, "_send_telegram_to_remote_dsmrreader") as mock_send, \
                 patch.object(client, "_initialize_logging"), \
                 patch("dsmr_datalogger_api_client.time"):
                mock_read.return_value = iter([SAMPLE_TELEGRAM])
                with self.assertRaises(StopIteration):
                    client.main()

        self.assertEqual(mock_send.call_count, 2)
        urls = [c[1]["api_url"] for c in mock_send.call_args_list]
        self.assertIn("http://host1/api/v1/datalogger/dsmrreading", urls)
        self.assertIn("http://host2/api/v1/datalogger/dsmrreading", urls)

    def test_send_exception_is_logged_not_raised(self):
        """An exception in _send_telegram_to_remote_dsmrreader is caught and logged."""
        env = {**self.BASE_ENV}
        with patch.dict(os.environ, env, clear=True):
            with patch.object(client, "read_telegram") as mock_read, \
                 patch.object(client, "_send_telegram_to_remote_dsmrreader", side_effect=Exception("network error")), \
                 patch.object(client, "_initialize_logging"), \
                 patch("dsmr_datalogger_api_client.time"):
                mock_read.return_value = iter([SAMPLE_TELEGRAM])
                # main() should not propagate the send exception; it will exhaust the iterator.
                with self.assertRaises(StopIteration):
                    client.main()

    def test_datasource_reset_when_sleep_above_min_reconnect(self):
        """When SLEEP >= MIN_SLEEP_FOR_RECONNECT, datasource is reset each iteration."""
        env = {
            **self.BASE_ENV,
            "DSMRREADER_REMOTE_DATALOGGER_SLEEP": "2.0",
            "DSMRREADER_REMOTE_DATALOGGER_MIN_SLEEP_FOR_RECONNECT": "1.0",
        }
        with patch.dict(os.environ, env, clear=True):
            with patch.object(client, "read_telegram") as mock_read, \
                 patch.object(client, "_send_telegram_to_remote_dsmrreader"), \
                 patch.object(client, "_initialize_logging"), \
                 patch("dsmr_datalogger_api_client.time"):
                # Two telegrams so we can observe two calls to read_telegram.
                mock_read.side_effect = [iter([SAMPLE_TELEGRAM]), iter([SAMPLE_TELEGRAM])]
                with self.assertRaises(StopIteration):
                    client.main()

        # read_telegram should have been called at least once per telegram.
        self.assertGreaterEqual(mock_read.call_count, 1)


if __name__ == "__main__":
    unittest.main()
