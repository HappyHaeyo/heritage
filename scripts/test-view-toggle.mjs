import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const url=process.env.TEST_URL||'http://127.0.0.1:4175/';
const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const waitCountry=code=>page.waitForFunction(c=>document.querySelector('#map-country').value===c,code);
async function homeCentered(){await page.waitForFunction(()=>{const host=document.querySelector('#earth-canvas').getBoundingClientRect(),dot=document.querySelector('.home-pin .pin-dot').getBoundingClientRect();return Math.abs(dot.x+dot.width/2-host.x-host.width/2)<3&&Math.abs(dot.y+dot.height/2-host.y-host.height/2)<3;});}
try{
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('#globe-canvas[data-ready]').waitFor();
 await page.locator('[data-view="globe"]').click();await page.locator('#earth-canvas[data-ready]').waitFor();await homeCentered();
 assert.equal(await page.locator('.map-explorer').isVisible(),false);assert.equal(await page.locator('#reset-view').innerText(),'한국 중심 ↺');
 await page.screenshot({path:'test-results/toggle-globe-desktop.png',fullPage:true});
 await page.locator('.globe-pin[data-code="JP"]').click();await page.locator('.artifact-card').first().waitFor();assert.match(await page.locator('#results-count').innerText(),/5,700/);await page.locator('#close-collection').click();
 await page.locator('[data-view="points"]').click();await page.locator('.map-object[data-country="JP"]').first().waitFor();
 const prior=await page.locator('#record-overview').getAttribute('data-viewport');await page.locator('[data-pan="right"]').click();await page.waitForFunction(v=>document.querySelector('#record-overview').dataset.viewport!==v,prior);const before=await page.locator('#record-overview').getAttribute('data-viewport');
 await page.locator('[data-view="globe"]').click();await waitCountry('JP');await page.locator('[data-view="points"]').click();await page.waitForTimeout(250);assert.equal(await page.locator('#record-overview').getAttribute('data-viewport'),before,'point viewport survives round trip');
 await page.locator('[data-view="globe"]').click();await page.selectOption('#map-country','US');await page.waitForFunction(()=>document.querySelector('#zoom-country').textContent.startsWith('미국'));
 await page.locator('[data-view="points"]').click();await page.waitForFunction(()=>document.querySelector('.map-object')?.dataset.country==='US');
 await page.locator('[data-view="globe"]').click();await page.locator('#reset-view').click();await homeCentered();await waitCountry('');
 const old=await page.locator('#zoom-value').innerText();await page.locator('#zoom-in').click();await page.waitForFunction(prev=>document.querySelector('#zoom-value').textContent!==prev,old);
 const host=await page.locator('#earth-canvas').boundingBox();const pitch=Number(await page.locator('#earth-canvas').getAttribute('data-pitch'));
 await page.mouse.move(host.x+host.width/2,host.y+host.height/2);await page.mouse.down();await page.mouse.move(host.x+host.width/2+120,host.y+host.height/2+150,{steps:8});await page.mouse.up();await page.waitForFunction(previous=>Number(document.querySelector('#earth-canvas').dataset.pitch)!==previous,pitch);assert.notEqual(Number(await page.locator('#earth-canvas').getAttribute('data-pitch')),pitch);assert.ok(Math.abs(Number(await page.locator('#earth-canvas').getAttribute('data-pitch')))<1.14);
 await page.locator('[data-view="points"]').click();assert.equal(await page.locator('#earth-stage').isVisible(),false);await page.waitForTimeout(300);assert.equal(await page.locator('#map-country').inputValue(),'');
 for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.locator('[data-view="globe"]').click();await page.locator('#reset-view').click();await homeCentered();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-results/toggle-globe-${width}.png`,fullPage:true});await page.locator('[data-view="points"]').click();}
 const fallback=await browser.newPage();await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return String(t).startsWith('webgl')?null:get.call(this,t,...a);};});await fallback.goto(url,{waitUntil:'domcontentloaded'});await fallback.locator('#globe-canvas[data-ready]').waitFor();await fallback.locator('[data-view="globe"]').click();assert.equal(await fallback.locator('[data-view="globe"]').isDisabled(),true);assert.equal(await fallback.locator('.map-explorer').isVisible(),true);await fallback.close();
 assert.deepEqual(errors,[]);console.log('PASS globe/points toggle, Korea centred, country pin opens records, shared country, preserved point viewport, rotation/zoom, 390/320px mobile, WebGL fallback.');
}finally{await browser.close();}
