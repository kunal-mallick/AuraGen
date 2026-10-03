# Real-browser end-to-end test. Needs: pip install playwright && playwright install chromium
# Build the frontend first (cd frontend && npm run build), then:  python e2e/run.py
import subprocess, time, sys, os, json, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NPX = shutil.which('npx') or 'npx'
from playwright.sync_api import sync_playwright
env = {**os.environ, 'OPENAI_API_KEY': '', 'LLM_PROVIDER': ''}
def start_be(): return subprocess.Popen(['node','src/server.js'], cwd=os.path.join(ROOT,'backend'), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
be = start_be()
fe = subprocess.Popen([NPX,'next','start','-p','3000'], cwd=os.path.join(ROOT,'frontend'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(7)
ok = True
def check(name, cond, detail=''):
    global ok; ok &= bool(cond); print(('  PASS  ' if cond else '  FAIL  ') + name + (f'  ({detail})' if detail else ''))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width':1100,'height':900})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        dialogs=[]; pg.on('dialog', lambda d: (dialogs.append(d.message), d.accept()))
        pg.goto('http://localhost:3000'); pg.wait_for_selector('text=Loan Application')
        pg.wait_for_function("document.body.innerText.includes('open')", timeout=8000)
        check('page loads, socket connects', 'open' in pg.inner_text('main'))
        # a real user: name ok, then fights with the PAN field
        pg.fill('[data-field=fullName] input', 'Aryan Khamitkar')
        pan = pg.locator('[data-field=pan] input')
        for bad in ['abc', 'ABC123', 'abcde1234f']:
            pan.click(); pan.fill(''); pan.type(bad); pg.locator('[data-field=income] input').click()
        check('validation error shown for bad PAN', 'PAN is 5 capital letters' in pg.inner_text('[data-field=pan]'))
        pg.wait_for_function("document.body.innerText.includes('stuck on: pan')", timeout=5000)
        check('panel identifies PAN as the stuck field', 'stuck on: pan' in pg.inner_text('main'), pg.inner_text('main').split('stuck on:')[1][:30].strip())
        pg.screenshot(path=os.path.join(ROOT,'e2e','before.png'))
        # friction -> morph
        # no button click: three REAL validation errors should trigger the morph by themselves
        pg.wait_for_function("document.body.innerText.includes('Take your time')", timeout=12000)
        txt = pg.inner_text('main')
        check('real validation errors triggered the morph on their own', "fix this together" in txt and 'Loan Application' not in txt, txt.split('\n')[0])
        check('wizard OPENED on the struggling field (PAN)', 'PAN number' in txt and 'trips a lot of people up' in txt)
        pg.wait_for_function("document.body.innerText.includes('friction → new UI')", timeout=5000)
        lat = pg.inner_text('main').split('friction → new UI:')[1].split('\n')[0]
        total = int(lat.strip().split('ms')[0]); check('friction -> new UI under 2s', total < 2000, f'{total}ms; {lat.strip()[:60]}')
        pg.wait_for_timeout(700); pg.screenshot(path=os.path.join(ROOT,'e2e','after.png'))
        # finish the form in the wizard; earlier data must survive
        pg.fill('[data-field=pan] input', 'ABCDE1234F')
        steps = ['Next','Next']  # pan -> income? wizard order continues through remaining fields
        vals = {'employment':'Salaried','income':'900000','loanAmount':'500000','tenure':'36'}
        for _ in range(6):
            t = pg.inner_text('main')
            for name, v in vals.items():
                if f'data-field' and pg.locator(f'[data-field={name}]').count():
                    loc = pg.locator(f'[data-field={name}] select') if name=='employment' else pg.locator(f'[data-field={name}] input')
                    if loc.input_value()=='' : loc.fill(v) if name!='employment' else loc.select_option(v)
            if pg.locator('button', has_text='Submit').count(): pg.click('button:has-text("Submit")'); break
            pg.click('button:has-text("Next")')
        pg.wait_for_timeout(500)
        check('wizard submits', len(dialogs)==1)
        sub = json.loads(dialogs[0].split('Submitted: ')[1]) if dialogs else {}
        check('typed data survived the morph', sub.get('fullName')=='Aryan Khamitkar' and sub.get('pan')=='ABCDE1234F' and sub.get('tenure')=='36', str(sub)[:90])
        # reset, trigger the same situation again -> cache hit
        pg.click('text=reset UI'); pg.fill('[data-field=fullName] input','x')
        pan = pg.locator('[data-field=pan] input')
        for bad in ['abc','ABC1','zz']:
            pan.click(); pan.fill(''); pan.type(bad); pg.locator('[data-field=income] input').click()
        pg.wait_for_function("document.body.innerText.includes('cached')", timeout=12000)
        check('second identical situation is served from cache', ', cached' in pg.inner_text('main'))
        # reconnect: kill backend, see "reconnecting", restart, see "open" again
        pg.click('text=reset UI'); be.terminate(); be.wait()
        pg.wait_for_function("document.body.innerText.includes('reconnecting')", timeout=8000)
        check('UI shows reconnecting when backend dies', True)
        be = start_be()
        pg.wait_for_function("document.body.innerText.match(/\\bopen\\b/) && !document.body.innerText.includes('reconnecting')", timeout=20000)
        check('socket auto-reconnects after backend restart', True)
        check('no uncaught page errors', not errs, '; '.join(errs)[:150])
        b.close()
finally:
    for pr in (be, fe): pr.terminate()
    if os.name != 'nt': subprocess.run(['pkill','-f','next-server'])
print('\nE2E', 'PASSED' if ok else 'FAILED'); sys.exit(0 if ok else 1)
