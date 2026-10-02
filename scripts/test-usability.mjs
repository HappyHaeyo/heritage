import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const p=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
const errors=[];p.on('pageerror',e=>errors.push(e.message));
async function visibleInViewport(selector){const box=await p.locator(selector).boundingBox();assert.ok(box&&box.y>=0&&box.y+box.height<=p.viewportSize().height,selector+' must remain in viewport');}
try{
 await p.goto('http://127.0.0.1:4175');await p.locator('#globe-canvas[data-ready]').waitFor();
 await p.screenshot({path:'test-results/ui-desktop.png',fullPage:true});
 await p.selectOption('#map-country','JP');await p.locator('.map-object[data-id="okchf:47070"]').waitFor();
 await visibleInViewport('#open-country');await visibleInViewport('#reset-view');
 assert.match(await p.locator('#zoom-country').innerText(),/5,700.*2,111/);
 await p.selectOption('#map-country','US');await p.waitForFunction(()=>document.querySelector('.map-object')?.dataset.country==='US');
 await p.selectOption('#map-country','JP');await p.waitForFunction(()=>document.querySelector('.map-object')?.dataset.country==='JP');
 const first=p.locator('.map-object[data-id="okchf:47070"]');const before=await first.boundingBox();
 await p.mouse.move(before.x+before.width/2,before.y+before.height/2);await p.mouse.down();await p.mouse.move(before.x+before.width/2+60,before.y+before.height/2+25,{steps:5});await p.mouse.up();
 await p.setViewportSize({width:1200,height:800});await p.waitForTimeout(250);const after=await first.boundingBox(),stage=await p.locator('#globe-stage').boundingBox();
 assert.ok(Math.abs(after.x+after.width/2-(stage.x+stage.width/2)-60)<4,'resize should preserve panned record');
 await p.locator('#open-country').click();await p.locator('.artifact-card').first().waitFor();
 await p.fill('#search','나전');await p.locator('#filter-toggle').click();await p.check('#photos-only');await p.locator('#filter-toggle').click();
 assert.match(await p.locator('#active-filters').innerText(),/나전.*사진 있는 자료만/);
 const count=await p.locator('.artifact-card').count();await p.locator('#close-collection').click();await p.locator('#open-country').click();
 assert.equal(await p.inputValue('#search'),'나전');assert.equal(await p.locator('.artifact-card').count(),count);
 await p.locator('#reset-active-filters').click();assert.equal(await p.inputValue('#search'),'');
 await p.locator('#card-list').evaluate(el=>el.scrollTop=250);const scroll=await p.locator('#card-list').evaluate(el=>el.scrollTop);
 await p.locator('#close-collection').click();await p.locator('#open-country').click();assert.equal(await p.locator('#card-list').evaluate(el=>el.scrollTop),scroll);
 await p.locator('#country-tabs [data-country="US"]').click();await p.locator('.artifact-card').first().waitFor();await p.locator('#close-collection').click();assert.equal(await p.inputValue('#map-country'),'US');await p.locator('[data-mode="cases"]').click();assert.equal(await p.locator('[data-mode="cases"]').getAttribute('aria-pressed'),'true');await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('[data-mode="objects"]')?.getAttribute('aria-pressed')==='true');assert.equal(await p.locator('[data-mode="objects"]').getAttribute('aria-pressed'),'true');
 for(const width of [390,320]){
  await p.setViewportSize({width,height:844});await p.selectOption('#map-country','');await p.waitForTimeout(200);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await visibleInViewport('#map-country');await visibleInViewport('#zoom-in');
  await p.screenshot({path:`test-results/ui-mobile-${width}.png`,fullPage:true});
  await p.selectOption('#map-country','JP');await p.locator('.map-object.has-photo').first().waitFor();await visibleInViewport('#open-country');
  await p.screenshot({path:`test-results/ui-mobile-${width}-photos.png`,fullPage:true});
  await p.locator('#open-country').click();await p.locator('.artifact-card').first().waitFor();
  assert.ok((await p.locator('#card-list').boundingBox()).height>150,'list remains usable on mobile');
  await p.screenshot({path:`test-results/ui-mobile-${width}-list.png`,fullPage:true});await p.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);console.log('PASS direct country navigation, visible controls, resize position, persistent search and scroll, active filters, nav state, 390/320px layouts.');
}finally{await browser.close();}

