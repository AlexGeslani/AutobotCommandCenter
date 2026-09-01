#!/usr/bin/env python3
"""Compile Hermes Projects plus bounded manifests into a private ACC projection."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sqlite3
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "hermes-project-manifest-v1"
PROJECT_STATES = {"active", "operational", "candidate", "paused", "complete", "archived", "unclassified"}
HEALTH_STATES = {"on_track", "at_risk", "blocked", "unknown"}
DOC_STATES = {"approved", "ratified", "mapped", "draft", "historical", "missing"}
LIFECYCLE_STATES = {"complete", "current", "next", "future"}
MANIFEST_FIELDS = {
    "schemaVersion", "slug", "portfolioState", "health", "focusRank", "deliveryModel",
    "phase", "nextGate", "lastReviewedAt", "visibility", "repositoryUrl", "outcome",
    "documents", "lifecycle", "sessionRefs", "relatedSkills",
}
DOC_FIELDS = {"status", "label", "path", "url", "note"}
GATE_FIELDS = {"id", "label", "state"}
SESSION_FIELDS = {"label", "ref"}
DOC_ROLES = ("vision", "charter", "architecture")
ACTIVE_LIMIT = 3
MAX_DOC_BYTES = 1024 * 1024
GIT_TIMEOUT_SECONDS = 2


class PortfolioError(ValueError):
    pass


def exact_object(value: object, fields: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise PortfolioError(f"{label} must be an object")
    unknown = set(value) - fields
    if unknown:
        raise PortfolioError(f"{label} has unknown fields: {', '.join(sorted(unknown))}")
    return value


def bounded_text(value: object, label: str, limit: int = 4096) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > limit or "\0" in value:
        raise PortfolioError(f"{label} must be bounded non-empty text")
    return value.strip()


def canonical_timestamp(value: object, label: str) -> str | None:
    if value is None:
        return None
    raw = bounded_text(value, label, 64)
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise PortfolioError(f"{label} must be an ISO timestamp") from exc
    if parsed.tzinfo is None or not raw.endswith("Z"):
        raise PortfolioError(f"{label} must be UTC with Z suffix")
    return raw


def https_url(value: object, label: str) -> str | None:
    if value is None:
        return None
    raw = bounded_text(value, label, 1024)
    if not raw.startswith("https://") or "@" in raw.split("/", 3)[2]:
        raise PortfolioError(f"{label} must be credential-free HTTPS")
    return raw


def safe_slug(value: object, label: str) -> str:
    raw = bounded_text(value, label, 64)
    if not raw[0].isalnum() or any(not (char.islower() or char.isdigit() or char in "-_") for char in raw):
        raise PortfolioError(f"{label} must be a lowercase project slug")
    return raw


def load_manifest(path: Path, slug: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PortfolioError(f"manifest for {slug} is unavailable or invalid") from exc
    manifest = exact_object(value, MANIFEST_FIELDS, f"manifest {slug}")
    if manifest.get("schemaVersion") != SCHEMA_VERSION:
        raise PortfolioError(f"manifest {slug} must use {SCHEMA_VERSION}")
    if safe_slug(manifest.get("slug"), f"manifest {slug}.slug") != slug:
        raise PortfolioError(f"manifest {slug} does not match its project")
    state = bounded_text(manifest.get("portfolioState"), f"manifest {slug}.portfolioState", 32)
    if state not in PROJECT_STATES:
        raise PortfolioError(f"manifest {slug} has unsupported portfolio state")
    health = bounded_text(manifest.get("health"), f"manifest {slug}.health", 32)
    if health not in HEALTH_STATES:
        raise PortfolioError(f"manifest {slug} has unsupported health")
    focus = manifest.get("focusRank")
    if not (focus is None or isinstance(focus, int) and not isinstance(focus, bool) and 1 <= focus <= ACTIVE_LIMIT):
        raise PortfolioError(f"manifest {slug}.focusRank is invalid")
    if (state == "active") != (focus is not None):
        raise PortfolioError(f"manifest {slug}.focusRank must exist exactly for active projects")
    bounded_text(manifest.get("deliveryModel"), f"manifest {slug}.deliveryModel", 96)
    bounded_text(manifest.get("phase"), f"manifest {slug}.phase", 160)
    bounded_text(manifest.get("nextGate"), f"manifest {slug}.nextGate", 2048)
    canonical_timestamp(manifest.get("lastReviewedAt"), f"manifest {slug}.lastReviewedAt")
    if manifest.get("visibility") not in {"private", "public"}:
        raise PortfolioError(f"manifest {slug}.visibility is invalid")
    https_url(manifest.get("repositoryUrl"), f"manifest {slug}.repositoryUrl")
    bounded_text(manifest.get("outcome"), f"manifest {slug}.outcome", 2048)
    documents = exact_object(manifest.get("documents"), set(DOC_ROLES), f"manifest {slug}.documents")
    if set(documents) != set(DOC_ROLES):
        raise PortfolioError(f"manifest {slug}.documents must contain Vision, Charter, and Architecture")
    for role, raw in documents.items():
        doc = exact_object(raw, DOC_FIELDS, f"manifest {slug}.documents.{role}")
        if doc.get("status") not in DOC_STATES:
            raise PortfolioError(f"manifest {slug}.documents.{role}.status is invalid")
        bounded_text(doc.get("label"), f"manifest {slug}.documents.{role}.label", 160)
        if doc.get("note") is not None:
            bounded_text(doc.get("note"), f"manifest {slug}.documents.{role}.note", 1024)
        sources = int(doc.get("path") is not None) + int(doc.get("url") is not None)
        if doc.get("status") == "missing" and sources:
            raise PortfolioError(f"manifest {slug}.documents.{role} cannot link missing evidence")
        if doc.get("status") != "missing" and sources != 1:
            raise PortfolioError(f"manifest {slug}.documents.{role} requires exactly one path or URL")
        if doc.get("path") is not None:
            bounded_text(doc.get("path"), f"manifest {slug}.documents.{role}.path", 2048)
        if doc.get("url") is not None:
            https_url(doc.get("url"), f"manifest {slug}.documents.{role}.url")
    lifecycle = manifest.get("lifecycle")
    if not isinstance(lifecycle, list) or len(lifecycle) > 20:
        raise PortfolioError(f"manifest {slug}.lifecycle must be a bounded array")
    gate_ids: set[str] = set()
    current = 0
    for index, raw in enumerate(lifecycle):
        gate = exact_object(raw, GATE_FIELDS, f"manifest {slug}.lifecycle[{index}]")
        gate_id = safe_slug(gate.get("id"), f"manifest {slug}.lifecycle[{index}].id")
        if gate_id in gate_ids:
            raise PortfolioError(f"manifest {slug} lifecycle ids must be unique")
        gate_ids.add(gate_id)
        bounded_text(gate.get("label"), f"manifest {slug}.lifecycle[{index}].label", 160)
        if gate.get("state") not in LIFECYCLE_STATES:
            raise PortfolioError(f"manifest {slug}.lifecycle[{index}].state is invalid")
        current += gate.get("state") == "current"
    if current > 1:
        raise PortfolioError(f"manifest {slug} can have at most one current lifecycle gate")
    sessions = manifest.get("sessionRefs")
    if not isinstance(sessions, list) or len(sessions) > 20:
        raise PortfolioError(f"manifest {slug}.sessionRefs must be a bounded array")
    for index, raw in enumerate(sessions):
        session = exact_object(raw, SESSION_FIELDS, f"manifest {slug}.sessionRefs[{index}]")
        bounded_text(session.get("label"), f"manifest {slug}.sessionRefs[{index}].label", 160)
        ref = bounded_text(session.get("ref"), f"manifest {slug}.sessionRefs[{index}].ref", 200)
        if not ref.startswith("@session:") or "/" not in ref:
            raise PortfolioError(f"manifest {slug}.sessionRefs[{index}].ref is invalid")
    skills = manifest.get("relatedSkills")
    if not isinstance(skills, list) or len(skills) > 30:
        raise PortfolioError(f"manifest {slug}.relatedSkills must be a bounded array")
    for index, skill in enumerate(skills):
        bounded_text(skill, f"manifest {slug}.relatedSkills[{index}]", 160)
    return manifest


def read_projects(db: Path) -> list[dict[str, Any]]:
    if not db.is_file():
        raise PortfolioError("Hermes projects.db is unavailable")
    uri = db.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, slug, name, description, primary_path, archived FROM projects ORDER BY created_at, slug"
        ).fetchall()
        folders = conn.execute(
            "SELECT project_id, path FROM project_folders ORDER BY is_primary DESC, added_at, path"
        ).fetchall()
    projects = [dict(row) for row in rows]
    by_project: dict[str, list[str]] = {}
    for row in folders:
        by_project.setdefault(row["project_id"], []).append(row["path"])
    for project in projects:
        project["folders"] = by_project.get(project["id"], [])
        if project.get("primary_path") and project["primary_path"] not in project["folders"]:
            project["folders"].insert(0, project["primary_path"])
    return projects


def _parse_utc(value: str) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def _day_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT00:00:00.000Z")


def project_activity(project: dict[str, Any], generated_at: str) -> dict[str, Any]:
    """Return bounded repository activity without exposing private Git metadata."""
    folders = [Path(path).expanduser() for path in project.get("folders") or [] if path]
    if not folders:
        return {"status": "no_source", "source": None, "lastActivityAt": None}
    generated = _parse_utc(generated_at)
    if generated is None:
        raise PortfolioError("generatedAt must be a canonical UTC timestamp")
    existing = [folder for folder in folders if folder.is_dir()]
    if not existing:
        return {"status": "binding_missing", "source": None, "lastActivityAt": None}
    latest: datetime | None = None
    git_repository_seen = False
    invalid_timestamp = False
    for folder in existing:
        try:
            inside = subprocess.run(
                ["git", "-C", str(folder), "rev-parse", "--is-inside-work-tree"],
                text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                timeout=GIT_TIMEOUT_SECONDS, check=False,
            )
            if inside.returncode != 0 or inside.stdout.strip() != "true":
                continue
            git_repository_seen = True
            commit = subprocess.run(
                ["git", "-C", str(folder), "log", "-1", "--format=%cI", "HEAD"],
                text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                timeout=GIT_TIMEOUT_SECONDS, check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        if commit.returncode != 0 or not commit.stdout.strip():
            continue
        observed = _parse_utc(commit.stdout)
        if observed is None or observed > generated:
            invalid_timestamp = True
            continue
        if latest is None or observed > latest:
            latest = observed
    if latest is not None:
        return {"status": "observed", "source": "git_head_commit", "lastActivityAt": _day_timestamp(latest)}
    if invalid_timestamp:
        return {"status": "source_error", "source": "git_head_commit", "lastActivityAt": None}
    if git_repository_seen:
        return {"status": "quiet", "source": "git_repository", "lastActivityAt": None}
    return {"status": "no_source", "source": None, "lastActivityAt": None}


def manifest_path(project: dict[str, Any], sidecars: Path) -> Path | None:
    primary = project.get("primary_path")
    root_manifest = Path(primary) / "PROJECT.json" if primary else None
    sidecar = sidecars / f"{project['slug']}.json"
    if root_manifest and root_manifest.is_file():
        return root_manifest
    if sidecar.is_file():
        return sidecar
    return None


def source_path(raw: str, primary_path: str | None) -> Path:
    path = Path(os.path.expanduser(raw))
    if not path.is_absolute():
        if not primary_path:
            raise PortfolioError("relative document path requires a primary project folder")
        root = Path(primary_path).resolve()
        path = (root / path).resolve()
        try:
            path.relative_to(root)
        except ValueError as exc:
            raise PortfolioError("document path escapes its project root") from exc
    return path


def sanitize_document_body(body: str) -> str:
    local_path = re.compile(
        r"(?<![A-Za-z0-9])(?:~/(?:\.[A-Za-z0-9._-]+)?[^\s<>\"'`()\[\]{}]*|"
        r"/(?:Users|Volumes|private|tmp|var|home|opt|etc|volume\d+)(?:/[^\s<>\"'`()\[\]{}]*)?)",
        re.IGNORECASE,
    )
    credential_assignment = re.compile(
        r"(?im)\b((?:api[_ -]?key|access[_ -]?token|auth[_ -]?token|secret|password|authorization)\s*[:=]\s*)([^\s`\"']+)"
    )
    private_key = re.compile(
        r"-----BEGIN [^-\n]*PRIVATE KEY-----.*?-----END [^-\n]*PRIVATE KEY-----",
        re.DOTALL,
    )
    credential_url = re.compile(r"https://[^\s/@:]+:[^@\s/]+@", re.IGNORECASE)
    body = private_key.sub("[REDACTED PRIVATE KEY]", body)
    body = credential_assignment.sub(lambda match: f"{match.group(1)}[REDACTED]", body)
    body = credential_url.sub("https://[REDACTED]@", body)
    return local_path.sub("[LOCAL_PATH_REDACTED]", body)


def render_document(source: Path, title: str) -> str:
    if not source.is_file() or source.stat().st_size > MAX_DOC_BYTES:
        raise PortfolioError(f"document evidence is missing or oversized: {source.name}")
    body = sanitize_document_body(source.read_text(encoding="utf-8"))
    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>{title}</title><style>body{{margin:0;background:#090f0c;color:#d9f7e4;font:16px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}}main{{max-width:980px;margin:auto;padding:32px 20px}}h1{{color:#7df9a6;font:700 1.5rem system-ui}}pre{{white-space:pre-wrap;overflow-wrap:anywhere;background:#101a15;border:1px solid #294538;border-radius:12px;padding:20px}}</style></head>
<body><main><h1>{title}</h1><pre>{body}</pre></main></body></html>
""".format(title=html.escape(title), body=html.escape(body))


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def unclassified(project: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": project["id"], "slug": project["slug"], "name": project["name"],
        "description": project.get("description") or "Registered Hermes Project without portfolio annotations.",
        "outcome": "Project is registered; portfolio classification is still required.",
        "portfolioState": "archived" if project["archived"] else "unclassified",
        "health": "unknown", "focusRank": None, "deliveryModel": "unclassified", "phase": "Unclassified",
        "nextGate": "Classify lifecycle, document pointers, and next decision gate.", "lastReviewedAt": None,
        "visibility": "private", "repositoryUrl": None, "archived": bool(project["archived"]),
        "documents": {
            role: {"status": "missing", "label": f"{role.title()} not mapped", "note": "No validated project manifest is available."}
            for role in DOC_ROLES
        },
        "lifecycle": [], "sessionRefs": [], "relatedSkills": [],
    }


def compile_portfolio(db: Path, sidecars: Path, outputs: list[Path], profile: str, generated_at: str | None = None) -> dict[str, Any]:
    generated_at = canonical_timestamp(
        generated_at or datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "generatedAt",
    )
    if generated_at is None:
        raise PortfolioError("generatedAt is required")
    projects = read_projects(db)
    projected: list[dict[str, Any]] = []
    documents_to_render: list[tuple[str, str, Path, str]] = []
    annotated = 0
    for project in projects:
        path = manifest_path(project, sidecars)
        if path is None:
            row = unclassified(project)
            row["activity"] = project_activity(project, generated_at)
            projected.append(row)
            continue
        manifest = load_manifest(path, project["slug"])
        annotated += 1
        docs: dict[str, Any] = {}
        for role in DOC_ROLES:
            source = manifest["documents"][role]
            doc = {key: source[key] for key in ("status", "label", "note") if key in source}
            if source.get("url"):
                doc["href"] = source["url"]
            elif source.get("path"):
                local = source_path(source["path"], project.get("primary_path"))
                doc["href"] = f"runtime/portfolio/documents/{project['slug']}/{role}.html"
                documents_to_render.append((project["slug"], role, local, source["label"]))
            docs[role] = doc
        state = "archived" if project["archived"] else manifest["portfolioState"]
        projected.append({
            "id": project["id"], "slug": project["slug"], "name": project["name"],
            "description": project.get("description") or manifest["outcome"], "outcome": manifest["outcome"],
            "portfolioState": state, "health": manifest["health"],
            "focusRank": manifest["focusRank"] if state == "active" else None,
            "deliveryModel": manifest["deliveryModel"], "phase": manifest["phase"], "nextGate": manifest["nextGate"],
            "lastReviewedAt": manifest["lastReviewedAt"], "visibility": manifest["visibility"],
            "repositoryUrl": manifest["repositoryUrl"], "archived": bool(project["archived"]),
            "documents": docs, "lifecycle": manifest["lifecycle"], "sessionRefs": manifest["sessionRefs"],
            "relatedSkills": manifest["relatedSkills"], "activity": project_activity(project, generated_at),
        })
    active = sorted((row for row in projected if row["portfolioState"] == "active"), key=lambda row: row["focusRank"])
    if len(active) > ACTIVE_LIMIT:
        raise PortfolioError(f"active project limit {ACTIVE_LIMIT} exceeded")
    if [row["focusRank"] for row in active] != list(range(1, len(active) + 1)):
        raise PortfolioError("active focus ranks must be contiguous from 1")
    state_order = {"active": 0, "operational": 1, "candidate": 2, "paused": 3, "complete": 4, "unclassified": 5, "archived": 6}

    def project_order(row: dict[str, Any]) -> tuple[Any, ...]:
        state = row["portfolioState"]
        if state == "active":
            return (state_order[state], row["focusRank"], 0, row["id"])
        observed = row["activity"]["status"] == "observed"
        parsed = _parse_utc(row["activity"]["lastActivityAt"] or "")
        return (state_order[state], 0 if observed else 1, -(parsed.timestamp() if parsed else 0), row["id"])

    projected.sort(key=project_order)
    payload = {
        "schemaVersion": "acc-project-portfolio-v1",
        "generatedAt": generated_at,
        "source": {"authority": "Hermes projects.db joined to validated project manifests", "profile": profile, "registryProjectCount": len(projected), "annotatedProjectCount": annotated},
        "policy": {"activeLimit": ACTIVE_LIMIT, "rule": "One project enters Active only when another leaves Active."},
        "summary": {
            "total": len(projected), "active": len(active),
            "operational": sum(row["portfolioState"] == "operational" for row in projected),
            "missingDocuments": sum(doc["status"] == "missing" for row in projected for doc in row["documents"].values()),
            "unclassified": sum(row["portfolioState"] == "unclassified" for row in projected),
            "activityObserved": sum(row["activity"]["status"] == "observed" for row in projected),
            "activityQuiet": sum(row["activity"]["status"] == "quiet" for row in projected),
            "activityNoSource": sum(row["activity"]["status"] == "no_source" for row in projected),
            "activityBindingMissing": sum(row["activity"]["status"] == "binding_missing" for row in projected),
            "activityErrors": sum(row["activity"]["status"] == "source_error" for row in projected),
        },
        "projects": projected,
    }
    projection_text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    rendered_documents = [
        (Path("documents") / slug / f"{role}.html", render_document(source, title))
        for slug, role, source, title in documents_to_render
    ]
    for output in outputs:
        expected = set()
        for relative, rendered in rendered_documents:
            document = output.parent / relative
            atomic_write(document, rendered)
            expected.add(document)
        documents_root = output.parent / "documents"
        if documents_root.is_dir():
            for stale in documents_root.rglob("*.html"):
                if stale not in expected:
                    stale.unlink()
            for directory in sorted((path for path in documents_root.rglob("*") if path.is_dir()), reverse=True):
                try:
                    directory.rmdir()
                except OSError:
                    pass
        atomic_write(output, projection_text)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=Path.home() / ".hermes" / "projects.db")
    parser.add_argument("--manifests", type=Path, default=Path.home() / ".hermes" / "project-manifests")
    parser.add_argument("--output", type=Path, action="append", required=True)
    parser.add_argument("--profile", default="default")
    parser.add_argument("--generated-at", help="Canonical UTC timestamp used for reproducible output")
    args = parser.parse_args()
    try:
        payload = compile_portfolio(args.db, args.manifests, args.output, args.profile, args.generated_at)
    except (PortfolioError, OSError, sqlite3.Error) as exc:
        print(f"project portfolio compile failed: {exc}", file=sys.stderr)
        return 2
    print(json.dumps({"status": "ok", "schemaVersion": payload["schemaVersion"], "projects": payload["summary"]["total"], "active": payload["summary"]["active"], "missingDocuments": payload["summary"]["missingDocuments"]}, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
