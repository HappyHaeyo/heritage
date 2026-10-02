import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const read=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
const manifest=await read('public/data/manifest.json');
assert.equal(manifest.countries.reduce((n,c)=>n+c.count,0),21474);
for(const country of manifest.countries){const rows=await read(`public/data/${country.code}.json`);assert.equal(rows.length,country.count);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);}
const cases=await read('public/data/cases.json');assert.equal(cases.find(c=>c.id==='oegyujanggak').state,'loan');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const tab=code=>page.locator(`#country-tabs [data-country="${code}"]`);
try{
await page.goto('http://127.0.0.1:4175',{waitUntil:'domcontentloaded'});await page.locator('.artifact-card').first().waitFor();
assert.equal(await page.locator('#collection-title').innerText(),'일본에 있는 유산');
await page.locator('#globe-canvas[data-ready="true"]').waitFor();
await page.locator('.artifact-card').first().click();await page.locator('#detail-dialog[open]').waitFor();assert.match(await page.locator('#detail-title').innerText(),/나전/);await page.keyboard.press('Escape');
await page.locator('#load-more').click();assert.equal(await page.locator('.artifact-card').count(),48);
await page.locator('#search').fill('there-is-no-such-object-xyz');await page.locator('#reset-empty').waitFor();await page.locator('#reset-empty').click();assert.equal(await page.locator('.artifact-card').count(),24);
await tab('US').click();await page.locator('.artifact-card').first().waitFor();assert.match(await page.locator('#collection-title').innerText(),/미국/);
await page.locator('.artifact-card').filter({hasText:'3D 자료 연결'}).first().click();assert.equal(await page.getByRole('link',{name:'3D 모델 보기'}).count(),1);await page.keyboard.press('Escape');
await tab('FR').click();await page.locator('.artifact-card').first().waitFor();await page.locator('#filter-toggle').click();await page.locator('#photos-only').check();await page.locator('#reset-empty').waitFor();await page.locator('#reset-empty').click();assert.equal(await page.locator('.artifact-card').count(),24);
await tab('JP').click();await tab('US').click();await tab('NL').click();await page.locator('.artifact-card').first().waitFor();assert.match(await page.locator('#collection-title').innerText(),/네덜란드/);await page.locator('.artifact-card').first().click();assert.match(await page.locator('#detail-title').innerText(),/백자/);await page.keyboard.press('Escape');
await page.locator('[data-mode="cases"]').click();assert.equal(await page.locator('.case-card').count(),7);await page.locator('[data-id="oegyujanggak"]').click();assert.match(await page.locator('#detail-content').innerText(),/국내 대여 중 · 소유권 반환 아님/);assert.equal(await page.locator('#detail-content a').count(),2);await page.screenshot({path:'test-results/loan-detail.png'});await page.keyboard.press('Escape');
await tab('JP').click();assert.equal(await page.locator('.case-card').count(),5);
await page.locator('[data-mode="objects"]').click();await page.locator('.artifact-card').first().waitFor();await page.locator('#filter-toggle').click();
await page.waitForTimeout(3000);await page.screenshot({path:'test-results/desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-results/mobile.png'});
await page.locator('#collection').scrollIntoViewIfNeeded();await tab('CA').click();await page.locator('.artifact-card').first().waitFor();await page.locator('.artifact-card').first().click();assert.equal(await page.locator('#detail-dialog').evaluate(d=>d.open),true);await page.screenshot({path:'test-results/mobile-detail.png'});await page.keyboard.press('Escape');
const fallback=await browser.newPage();await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return String(type).startsWith('webgl')?null:original.call(this,type,...rest);};});await fallback.goto('http://127.0.0.1:4175',{waitUntil:'domcontentloaded'});await fallback.locator('#globe-fallback').waitFor({state:'visible'});await fallback.locator('[data-country="GB"]').click();await fallback.locator('.artifact-card').first().waitFor();assert.match(await fallback.locator('#collection-title').innerText(),/영국/);
assert.deepEqual(errors,[]);console.log('PASS: data totals, unique source IDs, globe, object detail, 3D source, search, filters, pagination, rapid country selection, seven cases, loan distinction, mobile, WebGL fallback.');
}finally{await browser.close();}
