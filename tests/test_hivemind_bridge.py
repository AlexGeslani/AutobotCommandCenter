import importlib.util
import unittest
from pathlib import Path


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


if __name__ == "__main__":
    unittest.main()