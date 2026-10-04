.PHONY: up down demo rescan record graph \
        check-s0 check-s1 check-s2 check-s3 check-s4 \
        check-s5 check-s6 check-s7 check-s8

# ── Core targets ────────────────────────────────────────────────────────────

up:
	@echo "==> Starting infrastructure..."
	docker compose up -d --wait
	@echo "==> All healthy."

down:
	docker compose down -v --remove-orphans

# ── Demo / scenario targets (Stage 2+) ──────────────────────────────────────

demo:
	@echo "==> Starting full CULPRIT stack..."
	docker compose up -d --wait
	@echo "==> Full stack online! Open http://localhost:5173"

rescan:
	@echo "==> Running full rescan (SAST, SCA, DAST)..."
	@python scanners/rescan.py

graph:
	@echo "==> Ingesting code graph and findings into Neo4j..."
	@python graph/ingest.py

record:
	@echo "==> Recording full scenario runs to cache/..."
	@python culprit/record.py

# ── Stage acceptance checks ─────────────────────────────────────────────────

# S0: Infrastructure services are all healthy.
check-s0:
	@echo "--- check-s0: infrastructure health ---"
	@docker compose ps --format json | python3 -c "\
import sys, json, pathlib; \
rows = [json.loads(l) for l in sys.stdin if l.strip()]; \
required = {'db', 'neo4j', 'redis', 'registry'}; \
healthy = {r['Service'] for r in rows if 'healthy' in r.get('Health', '')}; \
missing = required - healthy; \
(print('FAIL missing/unhealthy:', missing) or sys.exit(1)) if missing else print('OK')" || \
	python -c "\
import subprocess, json, sys; \
out = subprocess.check_output(['docker', 'compose', 'ps', '--format', 'json'], text=True); \
rows = [json.loads(l) for l in out.splitlines() if l.strip()]; \
required = {'db', 'neo4j', 'redis', 'registry'}; \
healthy = {r['Service'] for r in rows if 'healthy' in r.get('Health', '')}; \
missing = required - healthy; \
(print('FAIL missing/unhealthy:', missing) or sys.exit(1)) if missing else print('OK')"

# S1: target_app images built and pushed to local registry.
check-s1:
	@echo "--- check-s1: shop images in registry ---"
	@curl -sf http://localhost:5000/v2/shop/tags/list | python3 -c \
	  "import sys,json; d=json.load(sys.stdin); t=set(d.get('tags',[])); \
	   missing={'1.3.0','1.4.0','1.5.0'}-t; \
	   (print('FAIL missing tags:',missing) or sys.exit(1)) if missing else print('OK')" || \
	python -c "\
	import urllib.request, json, sys; \
	d=json.loads(urllib.request.urlopen('http://localhost:5000/v2/shop/tags/list').read()); \
	t=set(d.get('tags',[])); missing={'1.3.0','1.4.0','1.5.0'}-t; \
	(print('FAIL missing tags:', missing) or sys.exit(1)) if missing else print('OK')"

# S2: findings present, normalize tests pass, deterministic IDs & fingerprints.
check-s2:
	@echo "--- check-s2: findings & normalization ---"
	@python -m pytest tests/test_normalize.py -v && python -c "\
	from pathlib import Path; \
	from culprit.normalize import load_all_findings; \
	findings = load_all_findings(Path('findings')); \
	sources = {f.source for f in findings}; \
	assert {'sast', 'sca'}.issubset(sources), f'Missing sources: {sources}'; \
	sqli = [f for f in findings if 'CWE-89' in f.cwe]; \
	assert sqli and set(sqli[0].present_in) == {'1.3.0', '1.4.0', '1.5.0'}, 'SQLi present_in check failed'; \
	assert not any('n+1' in f.title.lower() or 'n+1' in f.detail.lower() for f in findings), 'N+1 should not be a finding'; \
	print('OK: Findings normalized count=' + str(len(findings)))"

# S3: Gateway, loadgen, ledger, scenarios, and check-s3 acceptance.
check-s3:
	@echo "--- check-s3: gateway, ledger, scenarios & routing ---"
	@python -m pytest tests/test_stage3.py -v && python -c "\
	import requests, time; \
	from ledger import Ledger, seed_ledger; \
	from scenarios.inject import start_scenario_a, start_scenario_b, reset_scenario; \
	gw = 'http://localhost:8080'; \
	r = requests.get(f'{gw}/health'); assert r.status_code == 200, 'Gateway health check failed'; \
	l = seed_ledger(); assert l.get_lkg() == '1.4.0', 'Ledger LKG != 1.4.0'; \
	assert l.find_last_stable() == '1.4.0', 'find_last_stable != 1.4.0'; \
	requests.post(f'{gw}/admin/weights', json={'blue': 0, 'green': 100}); \
	assert requests.post(f'{gw}/api/orders', json={'customer_id': 1, 'sku': 'WIDGET-001', 'qty': 1}).json().get('version') == '1.4.0'; \
	rule_resp = requests.post(f'{gw}/admin/rules', json={'route': '/api/orders', 'field': 'sku', 'regex': 'BLOCK_TEST'}).json(); \
	assert requests.post(f'{gw}/api/orders', json={'customer_id': 1, 'sku': 'BLOCK_TEST', 'qty': 1}).status_code == 403; \
	requests.delete(f'{gw}/admin/rules/' + rule_resp['rule']['id']); \
	res_a = start_scenario_a(gw, burst_count=8, sleep_delay=8); \
	m_a = requests.get(f'{gw}/admin/state').json().get('metrics', {}).get('/api/orders|all', {}); \
	p95 = m_a.get('p95_ms', 0); \
	assert p95 >= 5000, f'Expected p95 ~8s after Scenario A, got {p95}'; \
	res_b = start_scenario_b(gw, num_requests=10); \
	assert requests.get(f'{gw}/admin/state').json().get('weights') == {'blue': 100, 'green': 0}; \
	reset_scenario(gw); \
	print('OK: Stage 3 Gateway, Ledger, and Scenario checks passed!')"

# S4: Neo4j graph populated, queries verified.
check-s4:
	@echo "--- check-s4: neo4j graph & query templates ---"
	@python -m pytest tests/test_graph.py -v && python -c "\
	from graph.queries import data_reach, shared_resource, version_contains; \
	reach = data_reach('SAST-002'); \
	reach_ids = {n['id'] for n in reach.get('nodes', [])}; \
	assert 'route:/api/orders' in reach_ids, 'orders route missing from data_reach'; \
	assert 'table:customers' in reach_ids and 'table:payments' in reach_ids, 'customers/payments missing from data_reach'; \
	shared = shared_resource('/api/orders'); \
	shared_ids = {n['id'] for n in shared.get('nodes', [])}; \
	assert 'route:/api/products' in shared_ids, 'products route missing from shared_resource'; \
	for v in ['1.3.0', '1.4.0', '1.5.0']: \
	    vc = version_contains(['SAST-002'], v); \
	    assert any('SAST-002' in n['id'] for n in vc.get('nodes', [])), f'SQLi missing in {v}'; \
	assert len(version_contains(['N+1'], '1.5.0').get('nodes', [])) == 0, 'N+1 should not be in graph'; \
	print('OK: Stage 4 Neo4j graph queries verified!')"

# S5: culprit tools, preconditions, verifier, executor unit tests.
check-s5:
	@echo "--- check-s5: culprit tools, verifier, preconditions & executor ---"
	@python -m pytest tests/test_stage5.py -v && echo OK

# S6: scenario a_exploit & b_regression verdicts, verification, replay mode.
check-s6:
	@echo "--- check-s6: agent, report verification & replay ---"
	@python -m pytest tests/test_stage6.py -v && echo OK

# S7: UI build, fixtures, mock server & replay flows.
check-s7:
	@echo "--- check-s7: UI build, mock server & replay flows ---"
	@python -m pytest tests/test_stage7.py -v && echo OK

# S8: Full system integration & clean-machine verification.
check-s8:
	@echo "--- check-s8: full system integration & acceptance ---"
	@python -m pytest tests/ -v && echo OK
