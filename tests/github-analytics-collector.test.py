import importlib.util
import gzip
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / 'collector/github-analytics/collector.py'


def load_module():
    spec = importlib.util.spec_from_file_location('acc_github_collector', MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeClient:
    def __init__(self, failures=None, visibility='public', eligibility_errors=None):
        self.failures = failures or set()
        self.visibility = visibility
        self.eligibility_errors = eligibility_errors or {}

    def authenticate(self):
        return {'login': 'AlexGeslani'}

    def discover_public_repositories(self, owner):
        return [{'id': 101, 'name': 'Alpha'}, {'id': 909, 'name': 'Detected-Only'}]

    def collect_repository(self, owner, repository):
        if repository['id'] in self.eligibility_errors:
            raise RuntimeError(self.eligibility_errors[repository['id']])
        if repository['id'] in self.failures:
            raise RuntimeError('provider_http_failure')
        name = repository['name']
        return {
            'repository': {
                'id': repository['id'], 'name': name, 'owner': owner, 'fullName': f'{owner}/{name}',
                'visibility': self.visibility, 'archived': False, 'htmlUrl': f'https://github.com/{owner}/{name}',
                'stars': 1, 'forks': 0, 'subscribers': 0, 'pushedAt': '2026-08-29T00:00:00.000Z', 'latestRelease': None,
            },
            'traffic': {
                'views': {'count': 1, 'uniques': 1, 'daily': [{'timestamp': '2026-08-29T00:00:00Z', 'count': 1, 'uniques': 1}]},
                'clones': {'count': 0, 'uniques': 0, 'daily': []}, 'referrers': [], 'paths': [],
            },
        }


class GitHubCollectorTests(unittest.TestCase):
    def setUp(self):
        self.module = load_module()
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.config = {
            'schemaVersion': 'github-analytics-collector-v1', 'owner': 'AlexGeslani',
            'repositories': [{'id': 101, 'name': 'Alpha'}, {'id': 202, 'name': 'Beta'}],
            'localRoot': str(self.root / 'archive'), 'stateRoot': str(self.root / 'state'),
            'remoteRoot': '/GitHubAnalytics/archive', 'credentialFile': str(self.root / 'credentials.env'),
            'sftpWrapper': '/tmp/not-used-in-tests', 'uploadEnabled': False,
        }
        self.now = datetime(2026, 8, 30, 5, 0, 0, tzinfo=timezone.utc)

    def tearDown(self):
        self.temp.cleanup()

    def artifacts(self):
        return list((self.root / 'archive').rglob('github-traffic-*.json.gz')) if (self.root / 'archive').exists() else []

    def test_private_metadata_is_rejected_before_release_or_traffic_reads(self):
        client = self.module.GitHubClient('test-only')
        calls = []

        def request(path, **kwargs):
            calls.append(path)
            return {
                'id': 101, 'name': 'Alpha', 'owner': {'login': 'AlexGeslani'},
                'visibility': 'private', 'private': True,
            }

        client.request_json = request
        with self.assertRaisesRegex(RuntimeError, 'repository_ineligible'):
            client.collect_repository('AlexGeslani', {'id': 101, 'name': 'Alpha'})
        self.assertEqual(calls, ['/repositories/101'])

    def test_missing_repository_metadata_is_classified_as_access_lost_before_traffic_reads(self):
        client = self.module.GitHubClient('test-only')
        calls = []

        def request(path, **kwargs):
            calls.append((path, kwargs))
            return None

        client.request_json = request
        with self.assertRaisesRegex(RuntimeError, 'repository_access_lost'):
            client.collect_repository('AlexGeslani', {'id': 101, 'name': 'Alpha'})
        self.assertEqual(calls, [('/repositories/101', {'allow_not_found': True})])

    def test_pending_publications_survive_disabled_upload_and_drain_idempotently(self):
        (self.root / 'credentials.env').write_text('GITHUB_TOKEN=test-only-not-a-real-secret\n')
        (self.root / 'credentials.env').chmod(0o600)
        first = self.module.run_collection(self.config, now=self.now, client_factory=lambda token: FakeClient())
        pending = sorted((self.root / 'state' / 'pending-publication').glob('*.json'))
        self.assertEqual(first['pendingPublications'], 2)
        self.assertEqual(len(pending), 2)

        uploaded = []
        original = self.module.publish_remote
        self.module.publish_remote = lambda config, path, sidecar, digest: uploaded.append(path.name) or 'uploaded'
        try:
            second = self.module.run_collection({**self.config, 'uploadEnabled': True}, now=self.now, client_factory=lambda token: FakeClient())
        finally:
            self.module.publish_remote = original
        self.assertEqual(second['pendingPublications'], 0)
        self.assertEqual(list((self.root / 'state' / 'pending-publication').glob('*.json')), [])
        self.assertGreaterEqual(len(uploaded), 2)

    def test_credential_failure_writes_no_observation(self):
        with self.assertRaisesRegex(RuntimeError, 'credential_missing'):
            self.module.run_collection(self.config, now=self.now, client_factory=lambda token: FakeClient())
        self.assertEqual(self.artifacts(), [])

    def test_repository_failure_is_isolated_and_successful_repository_is_archived(self):
        (self.root / 'credentials.env').write_text('GITHUB_TOKEN=test-only-not-a-real-secret\n')
        (self.root / 'credentials.env').chmod(0o600)
        receipt = self.module.run_collection(self.config, now=self.now, client_factory=lambda token: FakeClient(failures={202}))
        self.assertEqual(receipt['status'], 'partial')
        self.assertEqual(receipt['completedRepositoryIds'], [101])
        self.assertEqual(receipt['failedRepositoryIds'], [202])
        self.assertEqual(len(self.artifacts()), 1)
        self.assertNotIn('provider_http_failure', json.dumps(receipt))

    def test_non_public_repository_produces_no_observation(self):
        (self.root / 'credentials.env').write_text('GITHUB_TOKEN=test-only-not-a-real-secret\n')
        (self.root / 'credentials.env').chmod(0o600)
        receipt = self.module.run_collection(self.config, now=self.now, client_factory=lambda token: FakeClient(visibility='private'))
        self.assertEqual(receipt['completedRepositoryIds'], [])
        self.assertEqual(receipt['ineligibleRepositoryIds'], [101, 202])
        self.assertEqual(self.artifacts(), [])

    def test_non_public_repository_archives_name_free_eligibility_status(self):
        (self.root / 'credentials.env').write_text('GITHUB_TOKEN=test-only-not-a-real-secret\n')
        (self.root / 'credentials.env').chmod(0o600)
        self.module.run_collection(self.config, now=self.now, client_factory=lambda token: FakeClient(visibility='private'))
        statuses = sorted((self.root / 'archive' / 'github' / 'eligibility').rglob('*.json.gz'))
        self.assertEqual(len(statuses), 2)
        with gzip.open(statuses[0], 'rt', encoding='utf-8') as stream:
            status = json.load(stream)
        self.assertEqual(status, {
            'schemaVersion': 'github-repository-eligibility-v1',
            'checkedAt': '2026-08-30T05:00:00.000Z',
            'repositoryId': 101,
            'state': 'ineligible',
        })
        self.assertNotIn('Alpha', json.dumps(status))
        self.assertTrue(Path(str(statuses[0]) + '.sha256').is_file())

    def test_access_loss_and_identity_mismatch_archive_fail_closed_statuses(self):
        (self.root / 'credentials.env').write_text('GITHUB_TOKEN=test-only-not-a-real-secret\n')
        (self.root / 'credentials.env').chmod(0o600)
        client = FakeClient(eligibility_errors={101: 'repository_access_lost', 202: 'provider_repository_identity'})
        receipt = self.module.run_collection(self.config, now=self.now, client=client)
        statuses = []
        for path in sorted((self.root / 'archive' / 'github' / 'eligibility').rglob('*.json.gz')):
            with gzip.open(path, 'rt', encoding='utf-8') as stream:
                statuses.append(json.load(stream))
        self.assertEqual([(row['repositoryId'], row['state']) for row in statuses], [
            (101, 'access_lost'),
            (202, 'identity_mismatch'),
        ])
        self.assertEqual(receipt['failedRepositoryIds'], [])
        self.assertEqual(receipt['ineligibleRepositoryIds'], [101, 202])

    def test_immediate_rerun_is_an_explicitly_versioned_noop_for_the_same_timestamp(self):
        (self.root / 'credentials.env').write_text('GITHUB_TOKEN=test-only-not-a-real-secret\n')
        (self.root / 'credentials.env').chmod(0o600)
        first = self.module.run_collection(self.config, now=self.now, client_factory=lambda token: FakeClient())
        second = self.module.run_collection(self.config, now=self.now, client_factory=lambda token: FakeClient())
        self.assertEqual(len(self.artifacts()), 2)
        self.assertEqual(first['observationVersion'], second['observationVersion'])
        self.assertTrue(all(row['archiveStatus'] == 'already_present' for row in second['repositories']))
        self.assertEqual(second['unapprovedPublicRepositories'], [{'id': 909, 'name': 'Detected-Only'}])


if __name__ == '__main__':
    unittest.main()
