# Week 4 browser test: the LLM is genuinely unreachable (Ollama pointed at a dead port).
# Expect: the form still morphs into the safe template, a visible "Simplified design" notice appears,
# typed data survives, and after repeated failures the backend stops calling the LLM (circuit breaker).
import subprocess, time, os, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NPX = shutil.which('npx') or 'npx'
from playwright.sync_api import sync_playwright
env = {**os.environ, 'LLM_PROVIDER': 'ollama', 'OLLAMA_BASE_URL': 'http://127.0.0.1:9', 'PREWARM': '0', 'LLM_MAX_FAILURES': '2'}
be = subprocess.Popen(['node', 'src/server.js'], cwd=os.path.join(ROOT, 'backend'), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
fe = subprocess.Popen([NPX, 'next', 'start', '-p', '3000'], cwd=os.path.join(ROOT, 'frontend'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(7); ok = True
def check(name, cond, detail=''):
    global ok; ok &= bool(cond); print(('  PASS  ' if cond else '  FAIL  ') + name + (f'  ({detail})' if detail else ''))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:3000'); pg.wait_for_selector('text=Loan Application')
        pg.wait_for_function("document.body.innerText.includes('open')", timeout=8000)
        pg.fill('[data-field=fullName] input', 'Aryan Khamitkar')
        t0 = time.time(); pg.click('button:has-text("simulate rage")')
        pg.wait_for_selector('[data-testid=simplified-notice]', timeout=15000); dt = time.time() - t0
        note = pg.inner_text('[data-testid=simplified-notice]')
        check('LLM down -> visible "Simplified design" notice', 'Simplified design' in note, note[:70])
        pg.wait_for_function("document.body.innerText.includes('Step ')", timeout=8000)
        check('UI still morphed into the safe wizard', 'Loan Application' not in pg.inner_text('main'))
        pg.click('button:has-text("Back")'); pg.wait_for_selector('[data-field=fullName] input')
        check('typed data survived', pg.input_value('[data-field=fullName] input') == 'Aryan Khamitkar')
        check('failure was fast, not a hang', dt < 5, f'{dt:.1f}s')
        # second failure opens the breaker (max 2); third request is served instantly with reason circuit-open
        for _ in range(2):
            pg.click('button:has-text("reset UI")'); pg.fill('[data-field=fullName] input', 'A') if pg.locator('[data-field=fullName] input').count() else None
            t1 = time.time(); pg.click('button:has-text("simulate hesitation")'); pg.wait_for_selector('[data-testid=simplified-notice]', timeout=15000); last = time.time() - t1
        import re
        pg.wait_for_function("document.body.innerText.includes('friction → new UI')", timeout=8000)
        m = re.search(r'server (\d+)ms', pg.inner_text('main')); srv = int(m.group(1)) if m else 9999
        check('breaker open: notice says AI is paused, server answered without calling the LLM', 'paused' in pg.inner_text('[data-testid=simplified-notice]') and srv < 200, f'server {srv}ms')
        check('no uncaught page errors', not errs, errs[:1])
        b.close()
finally:
    be.terminate(); fe.terminate()
print('E2E DEGRADED PASSED' if ok else 'E2E DEGRADED FAILED'); raise SystemExit(0 if ok else 1)
