import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const missing=[];
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!pathname.startsWith('/heritage/')){missing.push(pathname);res.writeHead(404).end();return;}
  const relative=decodeURIComponent(pathname.slice('/heritage/'.length))||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403).end();return;}
  try{const data=await fs.readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);}catch{missing.push(pathname);res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const p=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/heritage/';
 await p.goto(url,{waitUntil:'domcontentloaded'});await p.locator('#globe-canvas[data-ready]').waitFor();
 assert.equal(await p.locator('#record-total').innerText(),'21,474');
 assert.equal(new URL(await p.locator('link[rel="icon"]').getAttribute('href'),url).pathname,'/heritage/favicon.svg');
 assert.equal((await p.request.get(url+'favicon.svg')).status(),200);
 for(const country of ['JP','US','GB','DE','CA','FR','RU','NL','CN']){
  await p.selectOption('#map-country',country);await p.locator('.map-object').first().waitFor();
  await p.locator('#open-country').click();await p.locator('#card-list[aria-busy="false"] .artifact-card').first().waitFor();
  assert.ok(await p.locator('.artifact-card').count()>0,country+' records must load');await p.locator('#close-collection').click();
 }
 await p.selectOption('#map-country','JP');await p.locator('#open-country').click();await p.locator('.artifact-card').first().click();await p.locator('#detail-dialog[open]').waitFor();await p.keyboard.press('Escape');await p.locator('#close-collection').click();
 await p.locator('[data-mode="cases"]').click();await p.locator('.case-card').first().waitFor();assert.equal(await p.locator('.case-card').count(),7);await p.keyboard.press('Escape');
 await p.locator('[data-view="globe"]').click();await p.locator('#earth-canvas[data-ready]').waitFor();assert.equal(await p.locator('#earth-stage').isVisible(),true);await p.locator('[data-view="points"]').click();
 await p.locator('.brand').click();await p.locator('#globe-canvas[data-ready]').waitFor();assert.equal(p.url(),url);
 await p.reload({waitUntil:'domcontentloaded'});await p.locator('#globe-canvas[data-ready]').waitFor();
 assert.deepEqual(missing,[],'all local requests must stay under /heritage/ and exist');assert.deepEqual(errors,[]);
 console.log('PASS production /heritage/: JS/CSS, icon, map, all 9 country datasets, details, cases, home link and reload; no missing local paths.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
