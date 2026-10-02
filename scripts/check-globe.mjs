import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:4175',{waitUntil:'domcontentloaded'});await p.locator('#globe-canvas[data-ready]').waitFor();await p.waitForTimeout(500);
async function assertHome(){const pos=await p.evaluate(()=>{const h=document.querySelector('#globe-canvas').getBoundingClientRect(),p=document.querySelector('.home-pin .pin-dot').getBoundingClientRect();return {dx:(p.left+p.width/2)-(h.left+h.width/2),dy:(p.top+p.height/2)-(h.top+h.height/2)};});assert.ok(Math.abs(pos.dx)<3&&Math.abs(pos.dy)<3,JSON.stringify(pos));}
await assertHome();await p.locator('.atlas').screenshot({path:'test-results/globe-korea.png'});
for(const c of ['GB','US']){await p.locator(`#country-tabs [data-country="${c}"]`).click();await p.waitForTimeout(300);await p.locator('.atlas').screenshot({path:`test-results/globe-upright-${c}.png`});}
const bounds=await p.locator('#globe-canvas').boundingBox();await p.mouse.move(bounds.x+bounds.width*.7,bounds.y+bounds.height*.6);await p.mouse.down();await p.mouse.move(bounds.x+bounds.width*.7,bounds.y-400,{steps:12});await p.mouse.up();
await p.locator('#reset-view').click();await p.waitForTimeout(200);await assertHome();
await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);await assertHome();await p.screenshot({path:'test-results/globe-korea-mobile.png'});assert.deepEqual(errors,[]);
console.log('PASS: Korea centered on initial load, after country changes and reset, and on mobile; no runtime errors.');await b.close();
