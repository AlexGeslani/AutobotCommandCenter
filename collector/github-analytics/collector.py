#!/usr/bin/env python3
"""Deterministic GitHub repository-traffic observation collector.

The collector archives only approved public repositories. GitHub traffic is a
rolling, revisable 14-day observation source; every run is preserved as its own
checksum-addressed version rather than treated as a closed-day export.
"""
from __future__ import annotations

import argparse
import fcntl
import gzip
import hashlib
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

SCHEMA_VERSION = "github-traffic-observation-v1"
ELIGIBILITY_SCHEMA_VERSION = "github-repository-eligibility-v1"
ELIGIBILITY_STATES = {"access_lost", "identity_mismatch", "ineligible"}
SOURCE = {
    "authority": "GitHub REST repository traffic metrics",
    "fidelity": "rolling_14_day_aggregate_observation",
}
CONFIG_FIELDS = {
    "schemaVersion", "owner", "repositories", "localRoot", "stateRoot",
    "remoteRoot", "credentialFile", "sftpWrapper", "uploadEnabled",
}
REPOSITORY_FIELDS = {"id", "name"}
TOKEN_KEY = "GITHUB_TOKEN"
SAFE_NAME = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")


def emit(event: str, **fields) -> None:
    print(json.dumps({"event": event, **fields}, sort_keys=True, separators=(",", ":")), flush=True)


def canonical_timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise RuntimeError("collection_timestamp_timezone")
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def safe_path(value: object, name: str) -> str:
    if not isinstance(value, str) or not value.startswith("/") or ".." in Path(value).parts:
        raise RuntimeError(f"{name}_boundary")
    return value


def validate_config(value: dict) -> dict:
    if not isinstance(value, dict) or set(value) != CONFIG_FIELDS:
        raise RuntimeError("config_shape")
    if value.get("schemaVersion") != "github-analytics-collector-v1" or value.get("owner") != "AlexGeslani":
        raise RuntimeError("config_identity")
    repositories = value.get("repositories")
    if not isinstance(repositories, list) or not repositories or len(repositories) > 50:
        raise RuntimeError("config_repositories")
    seen: set[int] = set()
    normalized = []
    for repository in repositories:
        if not isinstance(repository, dict) or set(repository) != REPOSITORY_FIELDS:
            raise RuntimeError("config_repository_shape")
        repo_id, name = repository.get("id"), repository.get("name")
        if isinstance(repo_id, bool) or not isinstance(repo_id, int) or repo_id <= 0 or repo_id in seen:
            raise RuntimeError("config_repository_id")
        if not isinstance(name, str) or not SAFE_NAME.fullmatch(name):
            raise RuntimeError("config_repository_name")
        seen.add(repo_id)
        normalized.append({"id": repo_id, "name": name})
    for key in ("localRoot", "stateRoot", "remoteRoot", "credentialFile", "sftpWrapper"):
        safe_path(value.get(key), f"config_{key}")
    if not isinstance(value.get("uploadEnabled"), bool):
        raise RuntimeError("config_upload_flag")
    return {**value, "repositories": normalized}


def load_config(path: Path) -> dict:
    if not path.is_file() or path.stat().st_mode & 0o022:
        raise RuntimeError("config_file_boundary")
    try:
        return validate_config(json.loads(path.read_text(encoding="utf-8")))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise RuntimeError("config_invalid") from None


def load_token(path: Path) -> str:
    if not path.is_file() or path.stat().st_mode & 0o077:
        raise RuntimeError("credential_missing")
    value = None
    for raw in path.read_text(errors="replace").splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        if stripped.split("=", 1)[0].strip() != TOKEN_KEY:
            continue
        tokens = shlex.split(stripped, comments=True, posix=True)
        if len(tokens) == 1 and "=" in tokens[0]:
            value = tokens[0].split("=", 1)[1]
    if not value:
        raise RuntimeError("credential_missing")
    return value


def nonnegative(value: object, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise RuntimeError(f"provider_{name}_shape")
    return value


def provider_timestamp(value: object, name: str) -> str:
    if not isinstance(value, str):
        raise RuntimeError(f"provider_{name}_shape")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise RuntimeError(f"provider_{name}_shape") from None
    if parsed.tzinfo is None:
        raise RuntimeError(f"provider_{name}_shape")
    return parsed.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def daily_timestamp(value: object, name: str) -> str:
    canonical = provider_timestamp(value, name)
    if not canonical.endswith("T00:00:00.000Z"):
        raise RuntimeError(f"provider_{name}_shape")
    return canonical.replace(".000Z", "Z")


class GitHubClient:
    def __init__(self, token: str):
        self.token = token

    def request_json(self, path: str, *, allow_not_found: bool = False, attempts: int = 3):
        request = urllib.request.Request(
            "https://api.github.com" + path,
            headers={
                "Authorization": "Bearer " + self.token,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2026-03-10",
                "User-Agent": "acc-github-analytics/1.0",
            },
        )
        for attempt in range(attempts):
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    return json.load(response)
            except urllib.error.HTTPError as exc:
                if allow_not_found and exc.code == 404:
                    return None
                if exc.code == 429 or 500 <= exc.code <= 599:
                    if attempt + 1 < attempts:
                        time.sleep((2, 5, 10)[attempt])
                        continue
                raise RuntimeError("provider_http_failure") from None
            except (urllib.error.URLError, TimeoutError):
                if attempt + 1 < attempts:
                    time.sleep((2, 5, 10)[attempt])
                    continue
                raise RuntimeError("provider_network_failure") from None
        raise RuntimeError("provider_retry_exhausted")

    def authenticate(self):
        value = self.request_json("/user")
        if not isinstance(value, dict) or value.get("login") != "AlexGeslani":
            raise RuntimeError("credential_identity")
        return {"login": value["login"]}

    def discover_public_repositories(self, owner: str) -> list[dict]:
        rows = []
        for page in range(1, 11):
            query = urllib.parse.urlencode({"per_page": 100, "page": page, "type": "owner", "sort": "full_name"})
            value = self.request_json(f"/users/{urllib.parse.quote(owner)}/repos?{query}")
            if not isinstance(value, list):
                raise RuntimeError("provider_inventory_shape")
            for row in value:
                if isinstance(row, dict) and row.get("private") is False and row.get("visibility") == "public":
                    rows.append({"id": nonnegative(row.get("id"), "repository_id"), "name": str(row.get("name") or "")})
            if len(value) < 100:
                break
        return sorted(rows, key=lambda row: row["id"])

    def project_series(self, value: object, key: str) -> dict:
        if not isinstance(value, dict) or set(value) != {"count", "uniques", key} or not isinstance(value.get(key), list):
            raise RuntimeError(f"provider_{key}_shape")
        daily = []
        for row in value[key]:
            if not isinstance(row, dict) or set(row) != {"timestamp", "count", "uniques"}:
                raise RuntimeError(f"provider_{key}_shape")
            daily.append({
                "timestamp": daily_timestamp(row["timestamp"], f"{key}_timestamp"),
                "count": nonnegative(row["count"], f"{key}_count"),
                "uniques": nonnegative(row["uniques"], f"{key}_uniques"),
            })
        return {"count": nonnegative(value["count"], f"{key}_count"), "uniques": nonnegative(value["uniques"], f"{key}_uniques"), "daily": daily}

    def collect_repository(self, owner: str, repository: dict) -> dict:
        metadata = self.request_json(f"/repositories/{repository['id']}", allow_not_found=True)
        if metadata is None:
            raise RuntimeError("repository_access_lost")
        if not isinstance(metadata, dict) or metadata.get("id") != repository["id"]:
            raise RuntimeError("provider_repository_identity")
        metadata_owner = metadata.get("owner") or {}
        name = metadata.get("name")
        if metadata_owner.get("login") != owner or not isinstance(name, str) or not SAFE_NAME.fullmatch(name):
            raise RuntimeError("provider_repository_identity")
        visibility = metadata.get("visibility")
        if metadata.get("private") is not False or visibility != "public":
            raise RuntimeError("repository_ineligible")
        slug = f"{urllib.parse.quote(owner)}/{urllib.parse.quote(name)}"
        release = self.request_json(f"/repos/{slug}/releases/latest", allow_not_found=True)
        latest_release = None
        if release is not None:
            if not isinstance(release, dict):
                raise RuntimeError("provider_release_shape")
            latest_release = {
                "tagName": str(release.get("tag_name") or ""),
                "publishedAt": provider_timestamp(release.get("published_at"), "release_timestamp"),
                "htmlUrl": str(release.get("html_url") or ""),
            }
        views = self.request_json(f"/repos/{slug}/traffic/views")
        clones = self.request_json(f"/repos/{slug}/traffic/clones")
        referrers_raw = self.request_json(f"/repos/{slug}/traffic/popular/referrers")
        paths_raw = self.request_json(f"/repos/{slug}/traffic/popular/paths")
        if not isinstance(referrers_raw, list) or not isinstance(paths_raw, list):
            raise RuntimeError("provider_top_rows_shape")
        referrers = [{"referrer": str(row.get("referrer") or ""), "count": nonnegative(row.get("count"), "referrer_count"), "uniques": nonnegative(row.get("uniques"), "referrer_uniques")} for row in referrers_raw if isinstance(row, dict)]
        paths = [{"path": str(row.get("path") or ""), "title": str(row.get("title") or ""), "count": nonnegative(row.get("count"), "path_count"), "uniques": nonnegative(row.get("uniques"), "path_uniques")} for row in paths_raw if isinstance(row, dict)]
        return {
            "repository": {
                "id": repository["id"], "name": name, "owner": owner, "fullName": f"{owner}/{name}",
                "visibility": visibility, "archived": bool(metadata.get("archived")),
                "htmlUrl": f"https://github.com/{owner}/{name}",
                "stars": nonnegative(metadata.get("stargazers_count"), "stars"),
                "forks": nonnegative(metadata.get("forks_count"), "forks"),
                "subscribers": nonnegative(metadata.get("subscribers_count"), "subscribers"),
                "pushedAt": provider_timestamp(metadata.get("pushed_at"), "pushed_at"),
                "latestRelease": latest_release,
            },
            "traffic": {
                "views": self.project_series(views, "views"),
                "clones": self.project_series(clones, "clones"),
                "referrers": referrers[:10], "paths": paths[:10],
            },
        }


def mkdir_private(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    os.chmod(path, 0o700)


def observation_paths(root: Path, collected_at: str, repo_id: int) -> tuple[Path, Path, str]:
    day = collected_at[:10]
    stamp = re.sub(r"[-:.]", "", collected_at)
    directory = root / "github" / "observations" / day[:4] / day[5:7] / day[8:10] / str(repo_id)
    name = f"github-traffic-{repo_id}-{stamp}.json.gz"
    return directory / name, directory / (name + ".sha256"), name


def write_observation(root: Path, observation: dict) -> tuple[Path, Path, str, str]:
    path, sidecar, name = observation_paths(root, observation["collectedAt"], observation["repository"]["id"])
    mkdir_private(path.parent)
    payload = (json.dumps(observation, sort_keys=True, separators=(",", ":")) + "\n").encode()
    with tempfile.SpooledTemporaryFile(max_size=2 * 1024 * 1024) as compressed_buffer:
        with gzip.GzipFile(filename="", mode="wb", fileobj=compressed_buffer, mtime=0) as stream:
            stream.write(payload)
        compressed_buffer.seek(0)
        compressed = compressed_buffer.read()
    digest = hashlib.sha256(compressed).hexdigest()
    if path.exists() or sidecar.exists():
        if not path.is_file() or not sidecar.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest or sidecar.read_text().strip() != f"{digest}  {name}":
            raise RuntimeError("observation_version_conflict")
        return path, sidecar, digest, "already_present"
    temporary = path.with_name("." + name + f".part-{os.getpid()}")
    temporary_side = sidecar.with_name("." + sidecar.name + f".part-{os.getpid()}")
    with temporary.open("wb") as stream:
        stream.write(compressed)
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(temporary, 0o600)
    temporary_side.write_text(f"{digest}  {name}\n")
    os.chmod(temporary_side, 0o600)
    os.replace(temporary, path)
    os.replace(temporary_side, sidecar)
    return path, sidecar, digest, "created"


def write_eligibility_status(root: Path, checked_at: str, repository_id: int, state: str) -> tuple[Path, Path, str, str]:
    if state not in ELIGIBILITY_STATES:
        raise RuntimeError("eligibility_state")
    day = checked_at[:10]
    stamp = re.sub(r"[-:.]", "", checked_at)
    directory = root / "github" / "eligibility" / day[:4] / day[5:7] / day[8:10] / str(repository_id)
    name = f"github-eligibility-{repository_id}-{stamp}.json.gz"
    path, sidecar = directory / name, directory / (name + ".sha256")
    mkdir_private(directory)
    value = {
        "schemaVersion": ELIGIBILITY_SCHEMA_VERSION,
        "checkedAt": checked_at,
        "repositoryId": repository_id,
        "state": state,
    }
    payload = (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()
    with tempfile.SpooledTemporaryFile(max_size=128 * 1024) as compressed_buffer:
        with gzip.GzipFile(filename="", mode="wb", fileobj=compressed_buffer, mtime=0) as stream:
            stream.write(payload)
        compressed_buffer.seek(0)
        compressed = compressed_buffer.read()
    digest = hashlib.sha256(compressed).hexdigest()
    if path.exists() or sidecar.exists():
        if not path.is_file() or not sidecar.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest or sidecar.read_text().strip() != f"{digest}  {name}":
            raise RuntimeError("eligibility_version_conflict")
        return path, sidecar, digest, "already_present"
    temporary = path.with_name("." + name + f".part-{os.getpid()}")
    temporary_side = sidecar.with_name("." + sidecar.name + f".part-{os.getpid()}")
    with temporary.open("wb") as stream:
        stream.write(compressed)
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(temporary, 0o600)
    temporary_side.write_text(f"{digest}  {name}\n")
    os.chmod(temporary_side, 0o600)
    os.replace(temporary, path)
    os.replace(temporary_side, sidecar)
    return path, sidecar, digest, "created"


def sftp(wrapper: str, commands: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["/usr/bin/sftp", "-q", "-b", "-", "-S", wrapper, "ignored"],
        input="\n".join(commands) + "\n", text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120,
    )


def remote_get(wrapper: str, remote: str, local: Path) -> bool:
    result = sftp(wrapper, [f"get {remote} {local}"])
    if result.returncode == 0:
        return True
    lowered = (result.stdout + result.stderr).lower()
    if "no such file" in lowered or "not found" in lowered:
        return False
    raise RuntimeError("sftp_read_failure")


def publish_remote(config: dict, path: Path, sidecar: Path, digest: str) -> str:
    local_root = Path(config["localRoot"])
    relative = path.relative_to(local_root).as_posix()
    remote = config["remoteRoot"].rstrip("/") + "/" + relative
    remote_side = remote + ".sha256"
    directories = []
    current = config["remoteRoot"].rstrip("/")
    directories.append(current)
    for part in Path(relative).parent.parts:
        current += "/" + part
        directories.append(current)
    if sftp(config["sftpWrapper"], ["-mkdir " + item for item in directories]).returncode != 0:
        raise RuntimeError("sftp_mkdir_failure")
    with tempfile.TemporaryDirectory(prefix="github-analytics-remote-") as temporary:
        root = Path(temporary)
        has_data = remote_get(config["sftpWrapper"], remote, root / "data")
        has_side = remote_get(config["sftpWrapper"], remote_side, root / "side")
        if has_data != has_side:
            raise RuntimeError("remote_observation_pair_incomplete")
        if has_data:
            if hashlib.sha256((root / "data").read_bytes()).hexdigest() != digest or (root / "side").read_text().strip().split()[0] != digest:
                raise RuntimeError("remote_observation_checksum_mismatch")
            return "already_present"
        suffix = f".part-{os.getpid()}"
        remote_part, side_part = remote + suffix, remote_side + suffix
        try:
            result = sftp(config["sftpWrapper"], [f"put {path} {remote_part}", f"put {sidecar} {side_part}"])
            if result.returncode != 0:
                raise RuntimeError("sftp_upload_failure")
            if not remote_get(config["sftpWrapper"], remote_part, root / "part") or hashlib.sha256((root / "part").read_bytes()).hexdigest() != digest:
                raise RuntimeError("sftp_part_checksum_mismatch")
            if sftp(config["sftpWrapper"], [f"rename {remote_part} {remote}", f"rename {side_part} {remote_side}"]).returncode != 0:
                raise RuntimeError("sftp_atomic_rename_failure")
        finally:
            sftp(config["sftpWrapper"], [f"-rm {remote_part}", f"-rm {side_part}"])
        if not remote_get(config["sftpWrapper"], remote, root / "final") or hashlib.sha256((root / "final").read_bytes()).hexdigest() != digest:
            raise RuntimeError("remote_final_checksum_mismatch")
    return "uploaded"


def stage_pending_publication(config: dict, path: Path, digest: str) -> Path:
    local_root = Path(config["localRoot"])
    try:
        relative = path.relative_to(local_root).as_posix()
    except ValueError:
        raise RuntimeError("pending_path_boundary") from None
    pending_root = Path(config["stateRoot"]) / "pending-publication"
    mkdir_private(pending_root)
    marker = pending_root / f"{digest}.json"
    payload = {
        "schemaVersion": "github-analytics-pending-publication-v1",
        "relativePath": relative,
        "sha256": digest,
    }
    bytes_value = (json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n").encode()
    if marker.exists():
        if marker.read_bytes() != bytes_value:
            raise RuntimeError("pending_marker_conflict")
        return marker
    temporary = marker.with_name("." + marker.name + f".part-{os.getpid()}")
    with temporary.open("wb") as stream:
        stream.write(bytes_value)
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(temporary, 0o600)
    os.replace(temporary, marker)
    return marker


def read_pending_marker(config: dict, marker: Path) -> tuple[Path, Path, str]:
    try:
        value = json.loads(marker.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise RuntimeError("pending_marker_invalid") from None
    if not isinstance(value, dict) or set(value) != {"schemaVersion", "relativePath", "sha256"} or value.get("schemaVersion") != "github-analytics-pending-publication-v1":
        raise RuntimeError("pending_marker_invalid")
    relative, digest = value.get("relativePath"), value.get("sha256")
    if not isinstance(relative, str) or relative.startswith("/") or ".." in Path(relative).parts or not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise RuntimeError("pending_marker_invalid")
    path = Path(config["localRoot"]) / relative
    sidecar = Path(str(path) + ".sha256")
    if not path.is_file() or not sidecar.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise RuntimeError("pending_artifact_invalid")
    if sidecar.read_text().strip() != f"{digest}  {path.name}":
        raise RuntimeError("pending_sidecar_invalid")
    return path, sidecar, digest


def drain_pending_publications(config: dict) -> dict:
    pending_root = Path(config["stateRoot"]) / "pending-publication"
    if not pending_root.exists():
        return {"attempted": 0, "failed": 0}
    markers = sorted(pending_root.glob("*.json"))
    if len(markers) > 1000:
        raise RuntimeError("pending_queue_limit")
    attempted = failed = 0
    if not config["uploadEnabled"]:
        return {"attempted": 0, "failed": 0}
    for marker in markers:
        attempted += 1
        try:
            path, sidecar, digest = read_pending_marker(config, marker)
            publish_remote(config, path, sidecar, digest)
            marker.unlink()
        except Exception:
            failed += 1
    return {"attempted": attempted, "failed": failed}


def pending_publication_count(config: dict) -> int:
    root = Path(config["stateRoot"]) / "pending-publication"
    return len(list(root.glob("*.json"))) if root.exists() else 0


def run_collection(config: dict, *, now: datetime | None = None, client_factory: Callable[[str], object] = GitHubClient, client: Any | None = None) -> dict:
    config = validate_config(config)
    collected_at = canonical_timestamp(now or datetime.now(timezone.utc))
    if client is None:
        token = load_token(Path(config["credentialFile"]))
        client = client_factory(token)
        client.authenticate()
    discovered = client.discover_public_repositories(config["owner"])
    allowed_ids = {repository["id"] for repository in config["repositories"]}
    unapproved = [row for row in discovered if row["id"] not in allowed_ids]

    state_root = Path(config["stateRoot"])
    mkdir_private(state_root)
    local_root = Path(config["localRoot"])
    mkdir_private(local_root)
    drain = drain_pending_publications(config)
    rows = []
    completed, failed, ineligible = [], [], []
    for repository in config["repositories"]:
        try:
            result = client.collect_repository(config["owner"], repository)
            metadata = result.get("repository") if isinstance(result, dict) else None
            if not isinstance(metadata, dict) or metadata.get("id") != repository["id"]:
                raise RuntimeError("provider_repository_identity")
            if metadata.get("visibility") != "public":
                raise RuntimeError("repository_ineligible")
            observation = {"schemaVersion": SCHEMA_VERSION, "collectedAt": collected_at, "source": SOURCE, **result}
            path, sidecar, digest, archive_status = write_observation(local_root, observation)
            marker = stage_pending_publication(config, path, digest)
            if config["uploadEnabled"]:
                remote_status = publish_remote(config, path, sidecar, digest)
                marker.unlink(missing_ok=True)
            else:
                remote_status = "upload_disabled"
            completed.append(repository["id"])
            rows.append({"repositoryId": repository["id"], "archiveStatus": archive_status, "remoteStatus": remote_status})
        except RuntimeError as exc:
            eligibility_state = {
                "repository_access_lost": "access_lost",
                "provider_repository_identity": "identity_mismatch",
                "repository_ineligible": "ineligible",
            }.get(str(exc))
            if eligibility_state:
                try:
                    path, sidecar, digest, _ = write_eligibility_status(local_root, collected_at, repository["id"], eligibility_state)
                    marker = stage_pending_publication(config, path, digest)
                    if config["uploadEnabled"]:
                        publish_remote(config, path, sidecar, digest)
                        marker.unlink(missing_ok=True)
                    ineligible.append(repository["id"])
                except Exception:
                    failed.append(repository["id"])
            else:
                failed.append(repository["id"])
        except Exception:
            failed.append(repository["id"])
    pending = pending_publication_count(config)
    status = "success" if not failed and not ineligible and not drain["failed"] else "partial"
    return {
        "schemaVersion": "github-analytics-collection-receipt-v1", "status": status,
        "collectedAt": collected_at, "observationVersion": re.sub(r"[-:.]", "", collected_at),
        "completedRepositoryIds": completed, "failedRepositoryIds": failed, "ineligibleRepositoryIds": ineligible,
        "repositories": rows, "unapprovedPublicRepositories": unapproved,
        "pendingPublications": pending, "pendingDrainFailures": drain["failed"],
    }


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config(args.config)
    token = load_token(Path(config["credentialFile"]))
    client = GitHubClient(token)
    client.authenticate()
    state_root = Path(config["stateRoot"])
    mkdir_private(state_root)
    lock_path = state_root / "collector.lock"
    with lock_path.open("a+") as lock:
        os.chmod(lock_path, 0o600)
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            emit("run_complete", status="no_op", reason="collector_busy")
            return 0
        receipt = run_collection(config, client=client)
        receipt_path = state_root / "last-run.json"
        temporary = receipt_path.with_name("." + receipt_path.name + f".part-{os.getpid()}")
        temporary.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, receipt_path)
        emit("run_complete", status=receipt["status"], repositories=len(receipt["completedRepositoryIds"]), failed=len(receipt["failedRepositoryIds"]), ineligible=len(receipt["ineligibleRepositoryIds"]), unapproved_public=len(receipt["unapprovedPublicRepositories"]))
        return 0 if receipt["status"] == "success" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        emit("run_failed", status="error", error_type=type(exc).__name__)
        raise SystemExit(1)
