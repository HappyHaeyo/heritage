import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
await p.goto('http://127.0.0.1:4175',{waitUntil:'domcontentloaded'});await p.locator('#globe-canvas[data-ready]').waitFor();assert.equal(await p.locator('.country-cluster').count(),9);assert.equal(await p.locator('#globe-canvas').getAttribute('data-record-points'),'21474');
await p.screenshot({path:'test-results/distribution-overview.png',fullPage:true});
await p.locator('.country-cluster[data-code="JP"]').click();await p.locator('.map-object.has-photo').first().waitFor();await p.waitForTimeout(2500);await p.screenshot({path:'test-results/distribution-photos.png',fullPage:true});
await p.locator('.map-object[data-id="okchf:47070"]').click();await p.locator('#detail-dialog[open]').waitFor();assert.match(await p.locator('#detail-title').innerText(),/나전/);await p.keyboard.press('Escape');
await p.locator('#open-country').click();await p.locator('.artifact-card').first().waitFor();assert.match(await p.locator('#results-count').innerText(),/전체 5,700건.*2,111건/);await p.locator('#close-collection').click();
await p.locator('#reset-view').click();await p.waitForFunction(()=>document.querySelectorAll('.map-object').length===0);assert.equal(await p.locator('.map-object').count(),0);
await p.locator('.country-cluster[data-code="JP"]').click();await p.locator('.map-object.has-photo').first().waitFor();
const before=await p.locator('.map-object[data-id="okchf:47070"]').boundingBox();
await p.mouse.move(before.x+before.width/2,before.y+before.height/2);await p.keyboard.down('Control');await p.mouse.wheel(0,150);await p.waitForTimeout(150);assert.equal(await p.locator('#globe-stage').getAttribute('data-level'),'points');
await p.mouse.wheel(0,-150);await p.keyboard.up('Control');await p.waitForTimeout(150);assert.equal(await p.locator('#globe-stage').getAttribute('data-level'),'photos');
const after=await p.locator('.map-object[data-id="okchf:47070"]').boundingBox();assert.ok(Math.abs((before.x+before.width/2)-(after.x+after.width/2))<4,'zoom must preserve the record under the pointer');
await p.locator('#reset-view').click();await p.locator('.country-cluster[data-code="FR"]').click();await p.locator('.map-object.no-image').first().waitFor();assert.equal(await p.locator('.map-object.has-photo').count(),0);await p.locator('.map-object.no-image').first().click();await p.locator('#detail-dialog[open]').waitFor();await p.keyboard.press('Escape');
await p.locator('#reset-view').click();await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);await p.screenshot({path:'test-results/distribution-mobile.png',fullPage:true});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await p.locator('.country-cluster[data-code="US"]').click();await p.locator('.map-object.has-photo').first().waitFor();await p.waitForTimeout(1000);await p.screenshot({path:'test-results/distribution-mobile-photos.png',fullPage:true});assert.equal(await p.locator('#globe-stage').getAttribute('data-level'),'photos');
await p.locator('#reset-view').click();await p.locator('[data-mode="cases"]').click();await p.locator('.case-card').first().waitFor();assert.equal(await p.locator('.case-card').count(),7);await p.locator('[data-id="oegyujanggak"]').click();assert.match(await p.locator('#detail-content').innerText(),/소유권 반환 아님/);await p.keyboard.press('Escape');await p.locator('#close-collection').click();
const fb=await b.newPage({viewport:{width:1100,height:900},reducedMotion:'reduce'});await fb.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return String(t).startsWith('webgl')?null:get.call(this,t,...a);};});await fb.goto('http://127.0.0.1:4175',{waitUntil:'domcontentloaded'});await fb.locator('#globe-canvas[data-ready]').waitFor();await fb.locator('.country-cluster[data-code="JP"]').click();await fb.locator('.map-object.has-photo').first().waitFor();await fb.close();
assert.deepEqual(errors,[]);console.log('PASS overview, photo zoom, same record detail, collection counts, zoom out, missing-image records, mobile.');
}finally{await b.close();}

