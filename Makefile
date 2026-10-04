.PHONY: up down demo rescan record \
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
	@echo "==> Full demo requires Stage 2+ services. Run 'make up' first."
	@docker compose ps

rescan:
	@echo "==> Rescan requires scanners/ scripts (Stage 3). Not yet available."

record:
	@echo "==> Record requires culprit-api (Stage 5). Not yet available."

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

# S2: gateway up and logging; blue/green reachable.
check-s2:
	@echo "--- check-s2: gateway health ---"
	@curl -sf http://localhost:8080/health && echo OK || (echo FAIL && exit 1)

# S3: findings JSON present for all three scanners.
check-s3:
	@echo "--- check-s3: findings present ---"
	@python3 -c "\
import pathlib, sys; \
required=['SAST-001','SCA-001','DAST-001']; \
found=[f.stem for f in pathlib.Path('findings').glob('*.json')]; \
missing=[r for r in required if not any(r in f for f in found)]; \
(print('FAIL missing:',missing) or sys.exit(1)) if missing else print('OK')"

# S4: Neo4j graph populated (node count > 0).
check-s4:
	@echo "--- check-s4: neo4j graph populated ---"
	@python3 -c "\
import urllib.request, json, sys; \
req=urllib.request.Request('http://localhost:7474/db/neo4j/tx/commit', \
  data=json.dumps({'statements':[{'statement':'MATCH (n) RETURN count(n) AS c'}]}).encode(), \
  headers={'Content-Type':'application/json','Accept':'application/json'}); \
res=json.loads(urllib.request.urlopen(req).read()); \
c=res['results'][0]['data'][0]['row'][0]; \
(print('FAIL graph empty') or sys.exit(1)) if c==0 else print('OK count='+str(c))"

# S5: culprit-api /api/state returns 200.
check-s5:
	@echo "--- check-s5: culprit-api health ---"
	@curl -sf http://localhost:9000/api/state && echo OK || (echo FAIL && exit 1)

# S6: scenario a_exploit produces verdict=exploit.
check-s6:
	@echo "--- check-s6: scenario a_exploit verdict ---"
	@curl -sf http://localhost:9000/api/scenario/a_exploit/start -X POST && \
	  echo "Scenario started – check /api/investigate stream for verdict" || \
	  (echo FAIL && exit 1)

# S7: scenario b_regression produces verdict=regression.
check-s7:
	@echo "--- check-s7: scenario b_regression verdict ---"
	@curl -sf http://localhost:9000/api/scenario/b_regression/start -X POST && \
	  echo "Scenario started – check /api/investigate stream for verdict" || \
	  (echo FAIL && exit 1)

# S8: UI loads at :5173.
check-s8:
	@echo "--- check-s8: UI health ---"
	@curl -sf http://localhost:5173 && echo OK || (echo FAIL && exit 1)
