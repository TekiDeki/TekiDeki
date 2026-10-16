/* npm ci && npx playwright install --with-deps chromium
   Start: python -m http.server 8080 --directory site
   Run: npm test (optional ATLAS_BASE and ATLAS_CHROMIUM_PATH) */
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.ATLAS_BASE || 'http://localhost:8080';
(async () => {
 const browser=await chromium.launch({executablePath:process.env.ATLAS_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote'],headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1100},permissions:['clipboard-read','clipboard-write'],acceptDownloads:true});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/convert/');
 assert.equal(await page.locator('.category').count(),12);
 const math=await page.evaluate(()=>{
  const close=(a,b)=>Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b));const issues=[];
  const checks=[['length','mi','km',1,1.609344],['length','in','cm',1,2.54],['area','acre','m2',1,4046.8564224],['volume','galUS','L',1,3.785411784],['volume','galUK','L',1,4.54609],['mass','lb','kg',1,.45359237],['temperature','C','F',0,32],['temperature','F','C',32,0],['temperature','C','K',-273.15,0],['temperature','F','K',-459.67,0],['speed','kmh','ms',36,10],['time','wk','h',1,168],['pressure','atm','Pa',1,101325],['energy','kWh','MJ',1,3.6],['power','PS','W',1,735.49875],['data','GiB','MB',1,1073.741824],['regional','pogon','m2',1,5000],['regional','jutro','hv2',1,1600]];
  for(const [id,a,b,x,y] of checks){const n=convert(x,a,b,CATEGORIES.find(c=>c.id===id));if(!close(n,y))issues.push([id,a,b,n,y]);}
  let pairs=0;for(const c of CATEGORIES)for(const a of c.units)for(const b of c.units){const x=100;const back=convert(convert(x,a.id,b.id,c),b.id,a.id,c);if(!close(back,x))issues.push([c.id,a.id,b.id,back]);pairs++;}
  for(const [input,expected] of [['1,5',1.5],['1 234,5',1234.5],['1e3',1000],['-.5',-.5],['1.2.3',null],['1,234,567',null],['abc',null],['',null],['Infinity',null],['1e999',null],['1e-999',null]]){const n=parseNumber(input);if(expected===null?!Number.isNaN(n):n!==expected)issues.push(['parse',input,n]);}
  const keys=Object.keys(I18N.en);for(const l of LANGS)for(const k of keys)if(!I18N[l][k])issues.push(['translation',l,k]);
  return {issues,pairs,units:CATEGORIES.reduce((n,c)=>n+c.units.length,0)};
 });
 assert.deepEqual(math.issues,[]);console.log('Math:',math.pairs,'pair round trips;',math.units,'unit entries; reference checks and translations OK');
 await page.locator('#amount').fill('1,5');assert.match(await page.locator('#result').innerText(),/0.932/);
 await page.locator('#save').click();assert.equal(await page.locator('.saved-row').count(),1);
 await page.reload();assert.equal(await page.locator('.saved-row').count(),1);
 for(const lang of ['en','ro','sr-latn','sr-cyr']){
  await page.locator('#language').selectOption(lang);assert.equal(await page.locator('html').getAttribute('lang'),{en:'en',ro:'ro','sr-latn':'sr-Latn','sr-cyr':'sr-Cyrl'}[lang]);
  await page.locator('#about').click();assert.equal(await page.locator('dialog').evaluate(el=>el.open),true);await page.keyboard.press('Escape');
 }
 await page.locator('#language').selectOption('en');
 await page.locator('[data-preset="temperature,C,F"]').click();await page.locator('#amount').fill('0');assert.equal(await page.locator('#result').innerText(),'32');
 await page.locator('#swap').click();assert.equal(await page.locator('#result').innerText(),'0');
 await page.locator('#amount').fill('-500');assert.equal(await page.locator('#copy').isDisabled(),true);assert.match(await page.locator('#error').innerText(),/absolute/);
 await page.locator('[data-preset="length,km,mi"]').click();await page.locator('#from').selectOption('km');await page.locator('#to').selectOption('nm');await page.locator('#amount').fill('1e300');assert.equal(await page.locator('#copy').isDisabled(),true);
 await page.locator('#amount').fill('1e-20');assert.match(await page.locator('#result').innerText(),/E/);
 await page.locator('[data-preset="regional,ha,jutro"]').click();assert.equal(await page.locator('#regionalNote').isVisible(),true);
 await page.locator('#share').click();const shared=await page.evaluate(()=>navigator.clipboard.readText());assert.match(shared,/#cat=regional/);await page.goto(shared);assert.match(await page.locator('#categoryTitle').innerText(),/Land/);
 await page.locator('#copy').click();assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/ha = .* jutro/);
 const audit=async(label)=>{const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],label);};
 await audit('dark desktop');await page.locator('#theme').click();await page.waitForTimeout(350);await audit('light desktop');
 await page.locator('#about').click();await audit('dialog');await page.keyboard.press('Escape');
 for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});for(const lang of ['en','ro','sr-latn','sr-cyr']){await page.locator('#language').selectOption(lang);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width} ${lang}`);}}
 await page.setViewportSize({width:1440,height:1100});await page.locator('#language').selectOption('en');await page.locator('[data-preset="length,km,mi"]').click();
 const dl=page.waitForEvent('download');await page.locator('#download').click();const downloaded=await dl;const downloadPath='/tmp/unit-atlas-test.html';await downloaded.saveAs(downloadPath);
 const html=await fs.readFile(downloadPath,'utf8');assert(!html.includes('class="saved-row"'));assert(!html.includes(String.fromCharCode(0x2014)));assert(html.includes('const CATEGORIES='));
 const portable=await browser.newContext({offline:true});const file=await portable.newPage();await file.goto('file://'+downloadPath);await file.locator('#amount').fill('10');assert.match(await file.locator('#result').innerText(),/6.213/);await file.evaluate(()=>{copyText=(text)=>{window.testSharedURL=text;};});await file.locator('#share').click();assert.match(await file.evaluate(()=>window.testSharedURL),/^https:\/\/freehtml\.dev\/convert\/#/);await portable.close();
 await page.goto(base+'/');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);assert.equal(await page.locator('.card[data-slug]').count(),12);
 for(const [language,query] of [['en','Unit Atlas'],['ro','măsuri funciare'],['sr-latn','mere zemljišta'],['sr-cyr','мере земљишта']]){await page.locator('#langBtn').click();await page.locator(`#langList button[data-lang="${language}"]`).click();await page.locator('#q').fill(query);assert.equal(await page.locator('.card[data-slug="convert"]').isVisible(),true);}
 await context.setOffline(true);await page.goto(base+'/convert/');assert.equal(await page.locator('.category').count(),12);await page.goto(base+'/');assert.equal(await page.locator('.card[data-slug]').count(),12);await page.goto(base+'/convert/index.html');assert.equal(await page.locator('.category').count(),12);await context.setOffline(false);
 await page.goto(base+'/convert/#cat=%3Cscript%3E&v=%3Cimg%3E&lang=invalid');assert.equal(await page.locator('.category').count(),12);
 await page.evaluate(()=>localStorage.setItem('atlas-saved','{"corrupt":true}'));await page.reload();assert.equal(await page.locator('.saved-row').count(),0);
 // Screenshots are review artifacts outside Git.
 await page.locator('#language').selectOption('en');await page.screenshot({path:'/tmp/unit-atlas-desktop.png',fullPage:true});await page.setViewportSize({width:375,height:850});await page.screenshot({path:'/tmp/unit-atlas-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: browser UI, persistence, 4 languages, 4 widths, accessibility, clipboard, sharing, portable HTML, hub integration and offline routing.');
})().catch(e=>{console.error(e);process.exit(1);});
