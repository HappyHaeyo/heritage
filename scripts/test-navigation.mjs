import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const viewport=()=>p.locator('#record-overview').getAttribute('data-viewport');
const ids=()=>p.locator('.map-object').evaluateAll(nodes=>nodes.map(n=>n.dataset.id).sort().join('|'));
try{
 await p.goto('http://127.0.0.1:4175',{waitUntil:'domcontentloaded'});await p.locator('#globe-canvas[data-ready]').waitFor();await p.selectOption('#map-country','JP');await p.locator('.map-object.photo-loaded').first().waitFor();await p.waitForTimeout(250);
 await p.screenshot({path:'test-results/navigation-desktop.png',fullPage:true});
 let old=await viewport(),oldIds=await ids();const stage=await p.locator('#globe-stage').boundingBox();const z=await p.locator('#zoom-value').innerText();
 await p.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2);await p.mouse.wheel(0,350);await p.waitForTimeout(150);
 assert.equal(await p.locator('#zoom-value').innerText(),z,'wheel should move, not zoom');assert.notEqual(await viewport(),old);assert.notEqual(await ids(),oldIds);
 old=await viewport();await p.locator('[data-pan="right"]').click();await p.waitForFunction(previous=>document.querySelector('#record-overview').dataset.viewport!==previous,old);assert.notEqual(await viewport(),old);
 const mini=await p.locator('#record-overview').boundingBox();oldIds=await ids();await p.mouse.click(mini.x+mini.width*.77,mini.y+mini.height*.7);await p.waitForTimeout(150);assert.notEqual(await ids(),oldIds,'minimap should reach distant records');
 await p.screenshot({path:'test-results/navigation-jump.png',fullPage:true});
 const record=p.locator('.map-object').filter({visible:true});
 // Open the record at the viewport centre after a long jump, then close it and continue.
 await p.mouse.click(stage.x+stage.width/2,stage.y+stage.height/2);await p.locator('#detail-dialog[open]').waitFor();await p.keyboard.press('Escape');
 await p.locator('#country-fit').click();await p.waitForTimeout(150);assert.equal(await p.locator('#globe-stage').getAttribute('data-level'),'points');
 await p.locator('#photo-center').click();await p.locator('.map-object.has-photo').first().waitFor();
 // Drag a fully loaded image; native image dragging must not steal the gesture.
 const r=p.locator('.map-object[data-id="okchf:47070"]');await p.waitForTimeout(150);const a=await r.boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(a.x+a.width/2+75,a.y+a.height/2+30,{steps:8});await p.mouse.up();await p.waitForTimeout(100);const moved=await r.boundingBox();assert.ok(Math.abs(moved.x-a.x-75)<4);assert.equal(await p.locator('#detail-dialog').evaluate(d=>d.open),false);
 for(const width of [390,320]){
  await p.setViewportSize({width,height:844});await p.selectOption('#map-country','JP');await p.waitForTimeout(250);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const nav=await p.locator('[data-pan="right"]').boundingBox();assert.ok(nav.y+nav.height<844);
  old=await viewport();await p.locator('[data-pan="right"]').click();await p.waitForFunction(previous=>document.querySelector('#record-overview').dataset.viewport!==previous,old);assert.notEqual(await viewport(),old);
  await p.screenshot({path:`test-results/navigation-mobile-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('PASS wheel pans to new records, direction buttons move, minimap jumps to distant records, detail opens after jump, country overview and photo return work, loaded image drag works, mobile controls remain visible.');
}finally{await b.close();}

