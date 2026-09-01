import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
COMPILER = ROOT / "collector" / "project-portfolio" / "compiler.py"
RECONCILER = ROOT / "collector" / "project-portfolio" / "reconcile.py"


class ProjectPortfolioCompilerTests(unittest.TestCase):
    def test_compiles_registry_and_manifest_without_exposing_local_paths(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            db = root / "projects.db"
            manifests = root / "manifests"
            project = root / "project"
            output = root / "runtime" / "portfolio" / "projects.v1.json"
            manifests.mkdir()
            project.mkdir()
            synthetic_local_path = "/" + "/".join(("Users", "example", "private", "VISION.md"))
            (project / "VISION.md").write_text(
                f"# Vision\n\nA bounded project vision.\n\nLocal source: {synthetic_local_path}\nAPI_KEY=not-a-real-secret-value\n",
                encoding="utf-8",
            )
            with sqlite3.connect(db) as conn:
                conn.executescript("""
                    CREATE TABLE projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT, description TEXT, icon TEXT, color TEXT, board_slug TEXT, primary_path TEXT, created_at INTEGER, archived INTEGER DEFAULT 0);
                    CREATE TABLE project_folders (project_id TEXT, path TEXT, label TEXT, is_primary INTEGER, added_at INTEGER, PRIMARY KEY(project_id, path));
                """)
                conn.execute("INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?)", ("p_test", "test-project", "Test Project", "Registry description", None, None, None, str(project), 1, 0))
                conn.execute("INSERT INTO project_folders VALUES (?,?,?,?,?)", ("p_test", str(project), None, 1, 1))
            manifest = {
                "schemaVersion": "hermes-project-manifest-v1",
                "slug": "test-project",
                "portfolioState": "active",
                "health": "on_track",
                "focusRank": 1,
                "deliveryModel": "gated",
                "phase": "Discovery",
                "nextGate": "Approve architecture.",
                "lastReviewedAt": "2026-09-01T12:00:00.000Z",
                "visibility": "private",
                "repositoryUrl": None,
                "outcome": "A bounded outcome.",
                "documents": {
                    "vision": {"status": "approved", "label": "Vision", "path": "VISION.md"},
                    "charter": {"status": "missing", "label": "Charter missing", "note": "Not yet authored."},
                    "architecture": {"status": "missing", "label": "Architecture missing", "note": "Discovery has not closed."},
                },
                "lifecycle": [{"id": "discovery", "label": "Discovery", "state": "current"}],
                "sessionRefs": [],
                "relatedSkills": [],
            }
            (manifests / "test-project.json").write_text(json.dumps(manifest), encoding="utf-8")
            generated_at = "2026-09-01T12:30:00.000Z"
            command = [
                sys.executable, str(COMPILER), "--db", str(db), "--manifests", str(manifests),
                "--output", str(output), "--profile", "default", "--generated-at", generated_at,
            ]
            result = subprocess.run(
                command,
                cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(payload["generatedAt"], generated_at)
            self.assertEqual(payload["source"]["registryProjectCount"], 1)
            self.assertEqual(payload["summary"]["missingDocuments"], 2)
            self.assertEqual(payload["projects"][0]["documents"]["vision"]["href"], "runtime/portfolio/documents/test-project/vision.html")
            self.assertNotIn(str(root), json.dumps(payload))
            rendered = output.parent / "documents" / "test-project" / "vision.html"
            rendered_text = rendered.read_text(encoding="utf-8")
            self.assertIn("A bounded project vision", rendered_text)
            self.assertNotIn("/" + "/".join(("Users", "example")), rendered_text)
            self.assertNotIn("not-a-real-secret-value", rendered_text)
            self.assertIn("[LOCAL_PATH_REDACTED]", rendered_text)
            self.assertIn("[REDACTED]", rendered_text)
            first_bytes = output.read_bytes()
            stale = output.parent / "documents" / "test-project" / "obsolete.html"
            stale.write_text("obsolete private evidence", encoding="utf-8")
            repeated = subprocess.run(
                command,
                cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )
            self.assertEqual(repeated.returncode, 0, repeated.stderr)
            self.assertFalse(stale.exists())
            self.assertEqual(output.read_bytes(), first_bytes)
            second_output = root / "second" / "projects.v1.json"
            second = subprocess.run(
                [*command[: command.index("--output") + 1], str(second_output), *command[command.index("--profile"):]],
                cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual(second_output.read_bytes(), first_bytes)

            audit_command = [
                sys.executable, str(RECONCILER), "audit", "--compiler", str(COMPILER),
                "--db", str(db), "--manifests", str(manifests), "--target", str(output),
                "--profile", "default",
            ]
            audit = subprocess.run(audit_command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(audit.returncode, 0, audit.stderr)
            self.assertEqual(audit.stdout, "")

            weekly = subprocess.run(
                [sys.executable, str(RECONCILER), "weekly", "--target", str(output)],
                cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )
            self.assertEqual(weekly.returncode, 0, weekly.stderr)
            self.assertIn("WEEKLY ACC PORTFOLIO REVIEW", weekly.stdout)
            self.assertIn("Test Project — Discovery", weekly.stdout)
            self.assertIn("Approve architecture.", weekly.stdout)

            manifest["nextGate"] = "Approve the changed gate."
            (manifests / "test-project.json").write_text(json.dumps(manifest), encoding="utf-8")
            deployed_before = output.read_bytes()
            drift = subprocess.run(audit_command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(drift.returncode, 0, drift.stderr)
            self.assertIn("reconciliation drift", drift.stdout.lower())
            self.assertEqual(output.read_bytes(), deployed_before)

            publish_command = [
                sys.executable, str(RECONCILER), "publish", "--compiler", str(COMPILER),
                "--db", str(db), "--manifests", str(manifests), "--target", str(output),
                "--profile", "default", "--retain", "2",
            ]
            published = subprocess.run(publish_command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(published.returncode, 0, published.stderr)
            self.assertEqual(published.stdout, "")
            self.assertTrue(output.parent.is_symlink())
            self.assertIn("Approve the changed gate.", output.read_text(encoding="utf-8"))

            manifest["nextGate"] = "Approve the second changed gate."
            (manifests / "test-project.json").write_text(json.dumps(manifest), encoding="utf-8")
            second_publish = subprocess.run(publish_command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(second_publish.returncode, 0, second_publish.stderr)
            self.assertIn("Approve the second changed gate.", output.read_text(encoding="utf-8"))

            rolled_back = subprocess.run(
                [sys.executable, str(RECONCILER), "rollback", "--target", str(output)],
                cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            )
            self.assertEqual(rolled_back.returncode, 0, rolled_back.stderr)
            self.assertIn("Approve the changed gate.", output.read_text(encoding="utf-8"))

            last_good = output.read_bytes()
            (manifests / "test-project.json").write_text("{not-json", encoding="utf-8")
            failed_publish = subprocess.run(publish_command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertNotEqual(failed_publish.returncode, 0)
            self.assertEqual(output.read_bytes(), last_good)
            self.assertEqual(failed_publish.stdout.count("portfolio publish failed"), 1)

    def test_projects_include_private_safe_git_activity_and_deterministic_order(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            db = root / "projects.db"
            manifests = root / "manifests"
            manifests.mkdir()
            observed = root / "observed"
            no_source = root / "no-source"
            observed.mkdir()
            no_source.mkdir()
            subprocess.run(["git", "init", "-b", "main", str(observed)], check=True, stdout=subprocess.DEVNULL)
            subprocess.run(["git", "-C", str(observed), "config", "user.name", "Private Author"], check=True)
            subprocess.run(["git", "-C", str(observed), "config", "user.email", "private@example.invalid"], check=True)
            (observed / "README.md").write_text("activity", encoding="utf-8")
            subprocess.run(["git", "-C", str(observed), "add", "README.md"], check=True)
            subprocess.run(
                ["git", "-C", str(observed), "commit", "-m", "private commit message"], check=True,
                stdout=subprocess.DEVNULL,
                env={**__import__("os").environ, "GIT_AUTHOR_DATE": "2026-08-31T20:15:00Z", "GIT_COMMITTER_DATE": "2026-08-31T20:15:00Z"},
            )
            with sqlite3.connect(db) as conn:
                conn.executescript("""
                    CREATE TABLE projects (id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT, description TEXT, icon TEXT, color TEXT, board_slug TEXT, primary_path TEXT, created_at INTEGER, archived INTEGER DEFAULT 0);
                    CREATE TABLE project_folders (project_id TEXT, path TEXT, label TEXT, is_primary INTEGER, added_at INTEGER, PRIMARY KEY(project_id, path));
                """)
                conn.execute("INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?)", ("p_observed", "observed", "Zeta Observed", "Observed", None, None, None, str(observed), 1, 0))
                conn.execute("INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?)", ("p_no_source", "no-source", "Alpha No Source", "No source", None, None, None, str(no_source), 2, 0))
                conn.execute("INSERT INTO project_folders VALUES (?,?,?,?,?)", ("p_observed", str(observed), None, 1, 1))
                conn.execute("INSERT INTO project_folders VALUES (?,?,?,?,?)", ("p_no_source", str(no_source), None, 1, 2))

            def write_manifest(slug):
                value = {
                    "schemaVersion": "hermes-project-manifest-v1", "slug": slug,
                    "portfolioState": "candidate", "health": "unknown", "focusRank": None,
                    "deliveryModel": "gated", "phase": "Discovery", "nextGate": "Observe activity.",
                    "lastReviewedAt": None, "visibility": "private", "repositoryUrl": None,
                    "outcome": "A bounded outcome.",
                    "documents": {
                        "vision": {"status": "missing", "label": "Vision missing"},
                        "charter": {"status": "missing", "label": "Charter missing"},
                        "architecture": {"status": "missing", "label": "Architecture missing"},
                    },
                    "lifecycle": [], "sessionRefs": [], "relatedSkills": [],
                }
                (manifests / f"{slug}.json").write_text(json.dumps(value), encoding="utf-8")

            write_manifest("observed")
            write_manifest("no-source")
            output = root / "runtime" / "portfolio" / "projects.v1.json"
            command = [
                sys.executable, str(COMPILER), "--db", str(db), "--manifests", str(manifests),
                "--output", str(output), "--profile", "default", "--generated-at", "2026-09-01T12:30:00.000Z",
            ]
            first = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(first.returncode, 0, first.stderr)
            first_bytes = output.read_bytes()
            payload = json.loads(first_bytes)
            self.assertEqual([project["slug"] for project in payload["projects"]], ["observed", "no-source"])
            self.assertEqual(payload["projects"][0]["activity"], {
                "status": "observed", "source": "git_head_commit", "lastActivityAt": "2026-08-31T00:00:00.000Z",
            })
            self.assertEqual(payload["projects"][1]["activity"], {
                "status": "no_source", "source": None, "lastActivityAt": None,
            })
            self.assertEqual(payload["summary"]["activityObserved"], 1)
            self.assertEqual(payload["summary"]["activityNoSource"], 1)
            serialized = first_bytes.decode("utf-8")
            for forbidden in [str(root), "private commit message", "Private Author", "private@example.invalid"]:
                self.assertNotIn(forbidden, serialized)
            repeated = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(repeated.returncode, 0, repeated.stderr)
            self.assertEqual(output.read_bytes(), first_bytes)


if __name__ == "__main__":
    unittest.main()
