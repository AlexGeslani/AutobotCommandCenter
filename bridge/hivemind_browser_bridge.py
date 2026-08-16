#!/usr/bin/env python3
"""Bounded browser bridge for a protected knowledge-search client."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import ModuleType
from typing import Any, cast

DEFAULT_APPROVED_COLLECTIONS = ("demo",)
DEFAULT_ALLOWED_ORIGINS = (
    "http://127.0.0.1:9129",
    "http://localhost:9129",
)
MAX_REQUEST_BYTES = 64 * 1024


def normalize_search_request(
    value: object,
    approved_collections: tuple[str, ...] = DEFAULT_APPROVED_COLLECTIONS,
) -> dict[str, object]:
    if not isinstance(value, dict) or set(value) - {"query", "collections", "limit"}:
        raise ValueError("invalid request object")
    query = value.get("query")
    if not isinstance(query, str) or not query.strip() or len(query.strip()) > 2048:
        raise ValueError("invalid query")
    collections = value.get("collections", list(approved_collections))
    if (
        not isinstance(collections, list)
        or not collections
        or len(collections) > len(approved_collections)
        or len(set(collections)) != len(collections)
        or any(not isinstance(item, str) or item not in approved_collections for item in collections)
    ):
        raise ValueError("invalid collections")
    limit = value.get("limit", 10)
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 20:
        raise ValueError("invalid limit")
    return {"query": query.strip(), "collections": collections, "limit": limit}


def load_search_client(path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location("hivemind_search_client", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load Hive Mind search client")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not callable(getattr(module, "search", None)):
        raise RuntimeError("Hive Mind client does not expose search")
    return module


class BridgeServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(
        self,
        address: tuple[str, int],
        *,
        search_client: ModuleType,
        token_file: Path,
        tls_pin_file: Path,
        allowed_origins: set[str],
        approved_collections: tuple[str, ...],
        base_url: str,
    ) -> None:
        super().__init__(address, BridgeHandler)
        self.search_client = search_client
        self.token_file = token_file
        self.tls_pin_file = tls_pin_file
        self.allowed_origins = allowed_origins
        self.approved_collections = approved_collections
        self.base_url = base_url


class BridgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: object) -> None:
        del format
        del args

    def _bridge_server(self) -> BridgeServer:
        return cast(BridgeServer, self.server)

    def _origin(self) -> str:
        return self.headers.get("Origin", "")

    def _origin_allowed(self) -> bool:
        return self._origin() in self._bridge_server().allowed_origins

    def _cors_headers(self) -> dict[str, str]:
        origin = self._origin()
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Private-Network": "true",
            "Vary": "Origin, Access-Control-Request-Private-Network",
        }

    def _send_json(self, status: int, payload: dict[str, Any], *, cors: bool = True) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if cors and self._origin_allowed():
            for name, value in self._cors_headers().items():
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        if self.path not in {"/health", "/search"} or not self._origin_allowed():
            self._send_json(403, {"error": "forbidden_origin"}, cors=False)
            return
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        for name, value in self._cors_headers().items():
            self.send_header(name, value)
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self._send_json(404, {"error": "not_found"})
            return
        if self._origin() and not self._origin_allowed():
            self._send_json(403, {"error": "forbidden_origin"}, cors=False)
            return
        self._send_json(200, {"status": "ok"}, cors=bool(self._origin()))

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/search":
            self._send_json(404, {"error": "not_found"})
            return
        if not self._origin_allowed():
            self._send_json(403, {"error": "forbidden_origin"}, cors=False)
            return
        if not self.headers.get("Content-Type", "").lower().startswith("application/json"):
            self._send_json(415, {"error": "content_type_must_be_json"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length < 1 or content_length > MAX_REQUEST_BYTES:
            self._send_json(413, {"error": "invalid_request_size"})
            return
        try:
            request = normalize_search_request(
                json.loads(self.rfile.read(content_length)),
                self._bridge_server().approved_collections,
            )
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError, TypeError):
            self._send_json(400, {"error": "invalid_search_request"})
            return
        try:
            server = self._bridge_server()
            payload = server.search_client.search(
                query=request["query"],
                collections=request["collections"],
                limit=request["limit"],
                base_url=server.base_url,
                token_file=server.token_file,
                tls_pin_file=server.tls_pin_file,
            )
        except Exception:
            self._send_json(502, {"error": "hivemind_unavailable"})
            return
        self._send_json(200, payload)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8788)
    args = parser.parse_args()
    home = Path.home()
    client_path = Path(os.environ.get("HIVEMIND_CLIENT_PATH", home / "Projects/hive-mind/scripts/hivemind_search.py"))
    token_file = Path(os.environ.get("HIVEMIND_TOKEN_FILE", home / ".hermes/secrets/hivemind-qmd-adapter-token"))
    tls_pin_file = Path(os.environ.get("HIVEMIND_TLS_PIN_FILE", home / ".hermes/trust/hivemind-qmd-dsm-cert.sha256"))
    base_url = os.environ.get("HIVEMIND_BASE_URL", "").strip()
    approved_collections = tuple(
        item.strip()
        for item in os.environ.get("HIVEMIND_COLLECTIONS", "").split(",")
        if item.strip()
    )
    if not base_url or not approved_collections:
        raise SystemExit("HIVEMIND_BASE_URL and HIVEMIND_COLLECTIONS are required")
    allowed_origins = {
        origin.strip()
        for origin in os.environ.get("ACC_HIVEMIND_ALLOWED_ORIGINS", ",".join(DEFAULT_ALLOWED_ORIGINS)).split(",")
        if origin.strip()
    }
    server = BridgeServer(
        (args.bind, args.port),
        search_client=load_search_client(client_path),
        token_file=token_file,
        tls_pin_file=tls_pin_file,
        allowed_origins=allowed_origins,
        approved_collections=approved_collections,
        base_url=base_url,
    )
    try:
        server.serve_forever()
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
