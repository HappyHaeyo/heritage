export function createRecordMap({host,manifest,loadCountry,onRange}){
 const datasets=new Map(),canvases=new Map(),geometry=new WeakMap();let active='',shown=new Set(),selected=null,matched=null;
 const label=document.createElement('div');label.className='record-map-key';label.innerHTML='<span><i></i>사진 주소 있음</span><span><i class="no-image"></i>사진 주소 없음</span><span><i class="in-view"></i>목록에 펼친 기록</span><small>점 하나 = 수집 기록 한 건<br>모든 나라에 같은 점 크기와 간격을 적용합니다.</small>';
 host.querySelector('.explorer-scope').before(label);
 host.querySelectorAll('[data-explore-country]').forEach(button=>{
  const code=button.dataset.exploreCountry,canvas=document.createElement('canvas');canvas.className='record-country-map';canvas.setAttribute('aria-hidden','true');button.append(canvas);canvases.set(code,canvas);
  canvas.onclick=e=>{e.stopPropagation();pick(e,canvas,code);};
 });
 const strip=document.createElement('section');strip.className='record-focus-map';strip.setAttribute('aria-label','전체 기록에서 탐색할 구간 선택');
 strip.innerHTML='<div class="record-focus-caption"><span>전체 기록에서 구간 선택</span><span class="record-range-caption" role="status"></span></div><canvas class="record-focus-canvas" tabindex="0" role="slider" aria-label="기록 구간 선택" aria-valuemin="1" aria-valuemax="1" aria-valuenow="1"></canvas><div class="record-focus-foot"><span class="record-focus-hint">점을 누르면 해당 구간의 기록이 아래에 펼쳐집니다.</span><div><button class="record-prev" aria-label="이전 48건">← 이전</button><button class="record-next" aria-label="다음 48건">다음 →</button></div></div>';
 host.querySelector('.explorer-catalog-head').after(strip);const focus=strip.querySelector('canvas');let start=0,end=0,full=[];
 const getPosition=(index,columns,pitch)=>({x:3+(index%columns)*pitch,y:3+Math.floor(index/columns)*pitch});
 function draw(canvas,code,large=false){
  const records=datasets.get(code);if(!records)return;
  const width=canvas.clientWidth;if(!width)return;
  const columns=large?Math.max(1,Math.floor((width-8)/2.25)):160;
  const pitch=large?2.25:Math.min(1.35,(width-8)/160),height=Math.ceil(records.length/columns)*pitch+6;
  canvas.style.height=height+'px';const ratio=devicePixelRatio||1;canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);geometry.set(canvas,{columns,pitch,count:records.length});
  const isActive=code===active;
  for(let i=0;i<records.length;i++){
   const r=records[i],p=getPosition(i,columns,pitch),inRange=isActive&&shown.has(r.id),isSelected=isActive&&r.id===selected;
   ctx.globalAlpha=isActive&&matched&&!matched.has(r.id)?.18:1;
   ctx.fillStyle=isSelected?'#282a25':inRange?'#b65333':r.image?'#6b776a':'#cfc4b1';
   ctx.beginPath();ctx.arc(p.x,p.y,large?.79:.45,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  if(isActive&&shown.size){
   ctx.strokeStyle='#b65333';ctx.lineWidth=large?1:.65;
   // One outline per occupied row keeps exact positions visible, even for search results.
   const indexes=records.map((r,i)=>shown.has(r.id)?i:-1).filter(i=>i>=0);
   let first=indexes[0],last=first;
   const segment=()=>{const p=getPosition(first,columns,pitch);ctx.strokeRect(p.x-pitch/2,p.y-pitch/2,(last-first+1)*pitch,pitch);};
   for(let k=1;k<indexes.length;k++){const i=indexes[k];if(i!==last+1||Math.floor(i/columns)!==Math.floor(last/columns)){segment();first=i;}last=i;}if(first!==undefined)segment();
  }
  if(isActive&&selected){const i=records.findIndex(r=>r.id===selected);if(i>=0){const p=getPosition(i,columns,pitch);ctx.strokeStyle='#262a25';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(p.x,p.y,large?4:2.3,0,Math.PI*2);ctx.stroke();}}
 }
 function indexAt(e,canvas){const g=geometry.get(canvas);if(!g)return -1;const r=canvas.getBoundingClientRect();const col=Math.round((e.clientX-r.left-3)/g.pitch),row=Math.round((e.clientY-r.top-3)/g.pitch);if(col<0||col>=g.columns||row<0)return -1;const i=row*g.columns+col;return i<g.count?i:-1;}
 function pick(e,canvas,code){const i=indexAt(e,canvas);if(i>=0)onRange(code,i);}
 focus.onclick=e=>pick(e,focus,active);
 focus.onmousemove=e=>{const i=indexAt(e,focus),r=datasets.get(active)?.[i];focus.title=r?`${i+1} · ${r.title||'명칭 미제공'} · ${r.image?'사진 주소 있음':'사진 주소 없음'}`:'';};
 const navigate=delta=>{if(full.length)onRange(active,Math.max(0,Math.min(full.length-1,start+delta)));};
 focus.onkeydown=e=>{let target;if(e.key==='ArrowRight'||e.key==='ArrowDown')target=start+48;else if(e.key==='ArrowLeft'||e.key==='ArrowUp')target=start-48;else if(e.key==='Home')target=0;else if(e.key==='End')target=full.length-1;else return;e.preventDefault();onRange(active,Math.max(0,Math.min(full.length-1,target)));};
 strip.querySelector('.record-prev').onclick=()=>navigate(-48);strip.querySelector('.record-next').onclick=()=>navigate(48);
 function redraw(){for(const [code,canvas]of canvases)draw(canvas,code);draw(focus,active,true);}
 const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();manifest.countries.forEach(async c=>{try{datasets.set(c.code,await loadCountry(c.code));draw(canvases.get(c.code),c.code);}catch{canvases.get(c.code).title='기록을 불러오지 못했습니다. 나라를 선택하면 다시 시도합니다.';}});},{rootMargin:'300px'});observer.observe(host);
 new ResizeObserver(redraw).observe(host);
 return {update({code,records,visible,selectedId,matches}){
  active=code;full=records;datasets.set(code,records);shown=new Set(visible.map(r=>r.id));selected=selectedId;matched=matches.length===records.length?null:new Set(matches.map(r=>r.id));
  const indices=records.map((r,i)=>shown.has(r.id)?i:-1).filter(i=>i>=0);start=indices[0]??0;end=indices.at(-1)??0;
  strip.querySelector('.record-range-caption').textContent=indices.length?`${start+1}–${end+1} / ${records.length.toLocaleString('ko-KR')}건${matched?' · 검색 결과 위치':''}`:'선택된 기록 없음';
  focus.setAttribute('aria-valuemax',String(records.length||1));focus.setAttribute('aria-valuenow',String(start+1));focus.setAttribute('aria-valuetext',`${start+1}번째부터 ${visible.length}건 표시`);
  strip.querySelector('.record-prev').disabled=start===0||!!matched;strip.querySelector('.record-next').disabled=end>=records.length-1||!!matched;
  strip.querySelector('.record-focus-hint').textContent=matched?'검색 결과의 원래 위치를 표시합니다. 점을 누르면 전체 기록 탐색으로 돌아갑니다.':'점 선택 · 방향키로 48건씩 이동 · 검은 테두리는 선택한 기록';redraw();
 }};
}