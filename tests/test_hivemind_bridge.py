import importlib.util
import http.client
import json
import threading
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import ModuleType


MODULE_PATH = Path(__file__).parents[1] / "bridge" / "hivemind_browser_bridge.py"


def load_bridge():
    spec = importlib.util.spec_from_file_location("hivemind_browser_bridge", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load Hive Mind bridge module")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class HiveMindBridgeRequestTests(unittest.TestCase):
    def test_normalizes_a_bounded_cross_wiki_search(self):
        bridge = load_bridge()
        self.assertEqual(
            bridge.normalize_search_request(
                {"query": " release notes ", "collections": ["docs", "research"], "limit": 5},
                ("docs", "research"),
            ),
            {"query": "release notes", "collections": ["docs", "research"], "limit": 5},
        )

    def test_rejects_unknown_collections(self):
        bridge = load_bridge()
        with self.assertRaises(ValueError):
            bridge.normalize_search_request(
                {"query": "release notes", "collections": ["archive"], "limit": 5},
                ("docs", "research"),
            )

    def test_path_precedence_is_external_config_then_cli_then_environment_then_default(self):
        bridge = load_bridge()
        with TemporaryDirectory() as directory:
            home = Path(directory) / "home"
            resolved = bridge.resolve_path_config(
                home=home,
                env={
                    "HIVEMIND_CLIENT_PATH": "/env/client.py",
                    "HIVEMIND_TOKEN_FILE": "/env/token",
                    "ACC_PROVIDER_USAGE_PRIVATE_DIR": "/env/provider-cache",
                },
                local_config={
                    "schemaVersion": "acc-path-config-v1",
                    "paths": {
                        "hiveMindClient": "local/client.py",
                        "hiveMindTokenFile": "local/token",
                    },
                },
                overrides={
                    "hiveMindClient": "/cli/client.py",
                    "hiveMindTlsPinFile": "/cli/tls-pin",
                },
            )
            self.assertEqual(resolved["hiveMindClient"], home / "local/client.py")
            self.assertEqual(resolved["hiveMindTokenFile"], home / "local/token")

            self.assertEqual(resolved["hiveMindTlsPinFile"], Path("/cli/tls-pin"))
            self.assertEqual(resolved["providerUsagePrivateCacheDir"], Path("/env/provider-cache"))

    def test_missing_required_bridge_resources_fail_closed_before_server_construction(self):
        bridge = load_bridge()
        with TemporaryDirectory() as directory:
            root = Path(directory)
            client = root / "client.py"
            token = root / "token"
            pin = root / "pin"
            client.write_text("def search(**kwargs): return {'results': []}\n", encoding="utf-8")
            paths = {
                "hiveMindClient": client,
                "hiveMindTokenFile": token,
                "hiveMindTlsPinFile": pin,
            }
            with self.assertRaisesRegex(bridge.PathConfigError, "required protected bridge resource"):
                bridge.validate_required_bridge_paths(paths)
            token.write_text("opaque", encoding="utf-8")
            pin.write_text("opaque", encoding="utf-8")
            bridge.validate_required_bridge_paths(paths)

    def test_absent_optional_tls_pin_is_valid_and_passed_as_none(self):
        bridge = load_bridge()
        with TemporaryDirectory() as directory:
            root = Path(directory)
            client_path = root / "client.py"
            token = root / "token"
            client_path.write_text("def search(**kwargs): return {'results': []}\n", encoding="utf-8")
            token.write_text("test-only", encoding="utf-8")
            paths = bridge.resolve_path_config(
                home=root,
                env={
                    "HIVEMIND_CLIENT_PATH": str(client_path),
                    "HIVEMIND_TOKEN_FILE": str(token),
                },
            )
            self.assertIsNone(paths["hiveMindTlsPinFile"])
            bridge.validate_required_bridge_paths(paths)

            calls = []
            search_client = ModuleType("recording_search_client")

            def search(**kwargs):
                calls.append(kwargs)
                return {"results": []}

            setattr(search_client, "search", search)
            origin = "https://acc-dev.cybertr0n.com"
            server = bridge.BridgeServer(
                ("127.0.0.1", 0),
                search_client=search_client,
                token_file=token,
                tls_pin_file=paths["hiveMindTlsPinFile"],
                allowed_origins={origin},
                approved_collections=("wiki-hermes",),
                base_url="https://qmd.cybertr0n.com",
            )
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                body = json.dumps({"query": "canary", "collections": ["wiki-hermes"], "limit": 1})
                connection = http.client.HTTPConnection("127.0.0.1", server.server_address[1], timeout=5)
                connection.request(
                    "POST",
                    "/search",
                    body=body,
                    headers={"Content-Type": "application/json", "Origin": origin},
                )
                response = connection.getresponse()
                response.read()
                connection.close()
                self.assertEqual(response.status, 200)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)
            self.assertEqual(len(calls), 1)
            self.assertIsNone(calls[0]["tls_pin_file"])

    def test_path_config_rejects_unknown_non_path_and_escape_values(self):
        bridge = load_bridge()
        with TemporaryDirectory() as directory:
            home = Path(directory)
            with self.assertRaisesRegex(bridge.PathConfigError, "unknown path"):
                bridge.resolve_path_config(
                    home=home,
                    env={},
                    local_config={"schemaVersion": "acc-path-config-v1", "paths": {"unknown": "/tmp/x"}},
                )
            with self.assertRaisesRegex(bridge.PathConfigError, "path string"):
                bridge.resolve_path_config(
                    home=home,
                    env={},
                    local_config={"schemaVersion": "acc-path-config-v1", "paths": {"hiveMindClient": {"secret": "no"}}},
                )
            with self.assertRaisesRegex(bridge.PathConfigError, "escape"):
                bridge.resolve_path_config(
                    home=home,
                    env={},
                    local_config={"schemaVersion": "acc-path-config-v1", "paths": {"hiveMindClient": "../escape.py"}},
                )


if __name__ == "__main__":
    unittest.main()