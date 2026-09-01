#!/usr/bin/env python3
"""Read-only ACC project-portfolio reconciliation and owner review."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_COMPILER = ROOT / "collector" / "project-portfolio" / "compiler.py"
DEFAULT_TARGET = ROOT / "standalone" / "public" / "runtime" / "portfolio" / "projects.v1.json"


def load_projection(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or value.get("schemaVersion") != "acc-project-portfolio-v1":
        raise ValueError("unsupported portfolio projection")
    generated_at = value.get("generatedAt")
    if not isinstance(generated_at, str) or not generated_at.endswith("Z"):
        raise ValueError("portfolio generatedAt is invalid")
    if not isinstance(value.get("projects"), list) or not isinstance(value.get("summary"), dict):
        raise ValueError("portfolio projection is incomplete")
    return value


def generated_tree(projects_file: Path) -> dict[str, bytes]:
    root = projects_file.parent
    files: dict[str, bytes] = {"projects.v1.json": projects_file.read_bytes()}
    documents = root / "documents"
    if documents.is_dir():
        for path in sorted(item for item in documents.rglob("*") if item.is_file()):
            files[path.relative_to(root).as_posix()] = path.read_bytes()
    return files


def audit(args: argparse.Namespace) -> int:
    try:
        deployed = load_projection(args.target)
    except (OSError, ValueError, json.JSONDecodeError):
        print("ACC Portfolio reconciliation FAILED: deployed private projection is missing or invalid; no project state was changed.")
        return 0

    with tempfile.TemporaryDirectory(prefix="acc-portfolio-audit-") as temporary:
        candidate = Path(temporary) / "portfolio" / "projects.v1.json"
        command = [
            sys.executable,
            str(args.compiler),
            "--db",
            str(args.db),
            "--manifests",
            str(args.manifests),
            "--output",
            str(candidate),
            "--profile",
            args.profile,
            "--generated-at",
            deployed["generatedAt"],
        ]
        result = subprocess.run(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
        if result.returncode != 0:
            print("ACC Portfolio reconciliation FAILED: current registry/manifests were rejected; deployed projection was not changed.")
            return 0
        if generated_tree(candidate) != generated_tree(args.target):
            print("ACC Portfolio reconciliation drift: registry/manifests no longer match the deployed private projection. Run the approved manual rebuild; no project state was changed.")
    return 0


def weekly(args: argparse.Namespace) -> int:
    try:
        projection = load_projection(args.target)
    except (OSError, ValueError, json.JSONDecodeError):
        print("WEEKLY ACC PORTFOLIO REVIEW\nProjection unavailable or invalid. No project state was changed.")
        return 0

    summary = projection["summary"]
    limit = projection.get("policy", {}).get("activeLimit", 3)
    active = sorted(
        (project for project in projection["projects"] if project.get("portfolioState") == "active"),
        key=lambda project: project.get("focusRank") or 99,
    )
    missing = [
        f"{project.get('name', 'Unnamed')}: {', '.join(role.title() for role, document in project.get('documents', {}).items() if document.get('status') == 'missing')}"
        for project in projection["projects"]
        if any(document.get("status") == "missing" for document in project.get("documents", {}).values())
    ]
    lines = [
        "WEEKLY ACC PORTFOLIO REVIEW",
        f"Registered {summary.get('total', 0)} · Active {summary.get('active', 0)}/{limit} · Missing governance roles {summary.get('missingDocuments', 0)} · Unclassified {summary.get('unclassified', 0)}",
        "",
        "Current focus:",
    ]
    lines.extend(
        f"{project.get('focusRank')}. {project.get('name')} — {project.get('phase')} — Next: {project.get('nextGate')}"
        for project in active
    )
    lines.extend(["", "Governance gaps:"])
    lines.extend(f"- {row}" for row in missing)
    if not missing:
        lines.append("- None")
    lines.extend([
        "",
        "Owner review: confirm Active WIP, health, next gates, and evidence changes. This reminder does not change projects, manifests, Kanban, or ACC state.",
    ])
    print("\n".join(lines))
    return 0


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description=__doc__)
    subcommands = value.add_subparsers(dest="mode", required=True)

    audit_parser = subcommands.add_parser("audit", help="Silently compare current sources with the deployed private projection")
    audit_parser.add_argument("--compiler", type=Path, default=DEFAULT_COMPILER)
    audit_parser.add_argument("--db", type=Path, default=Path.home() / ".hermes" / "projects.db")
    audit_parser.add_argument("--manifests", type=Path, default=Path.home() / ".hermes" / "project-manifests")
    audit_parser.add_argument("--target", type=Path, default=DEFAULT_TARGET)
    audit_parser.add_argument("--profile", default="default")
    audit_parser.set_defaults(handler=audit)

    weekly_parser = subcommands.add_parser("weekly", help="Render a deterministic owner-facing portfolio review")
    weekly_parser.add_argument("--target", type=Path, default=DEFAULT_TARGET)
    weekly_parser.set_defaults(handler=weekly)
    return value


def main() -> int:
    args = parser().parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
