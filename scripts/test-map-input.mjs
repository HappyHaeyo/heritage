import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
try{
await p.goto('http://127.0.0.1:4175',{waitUntil:'domcontentloaded'});await p.locator('#globe-canvas[data-ready]').waitFor();
const box=await p.locator('.country-cluster[data-code="JP"]').boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2+15;const cdp=await p.context().newCDPSession(p);
for(const spread of [70,70,25]){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-10,y,id:0},{x:x+10,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-spread,y,id:0},{x:x+spread,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
await p.waitForFunction(()=>document.querySelector('#globe-stage').dataset.level==='photos');await p.locator('.map-object.has-photo').first().waitFor();assert.ok(parseFloat(await p.locator('#zoom-value').innerText())>50);
await p.locator('#reset-view').click();await p.locator('.country-cluster[data-code="JP"]').click();await p.locator('.map-object[data-id="okchf:47070"]').waitFor();const record=p.locator('.map-object[data-id="okchf:47070"]'),before=await record.boundingBox();await p.mouse.move(before.x+before.width/2,before.y+before.height/2);await p.mouse.down();await p.mouse.move(before.x+before.width/2+50,before.y+before.height/2+35,{steps:5});await p.mouse.up();await p.waitForTimeout(100);const after=await record.boundingBox();assert.ok(Math.abs(after.x-before.x-50)<3);assert.ok(Math.abs(after.y-before.y-35)<3);assert.equal(await p.locator('#detail-dialog').evaluate(d=>d.open),false);
console.log('PASS two-finger pinch reaches photos; dragging moves the same record and does not open its detail.');
}finally{await b.close();}
