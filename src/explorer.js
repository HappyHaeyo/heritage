import './explorer.css';
import { createZoomGrid } from './zoom-grid.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n).toLocaleString('ko-KR');
const safe=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
export function createExplorer({host,manifest,loadCountry}){
 const caseButton=host.querySelector('[data-mode="cases"]');
 host.className='record-explorer';host.setAttribute('aria-labelledby','explorer-title');
 host.innerHTML=`<header class="explorer-header"><div><p class="step-number">04 / 수집 기록 탐색</p><h1 id="explorer-title">나라별 유물 사진과 기록</h1></div><div class="explorer-total"><strong>${num(manifest.total)}</strong><span>수집 기록 · ${manifest.countries.length}개국</span></div></header><div class="explorer-layout"><aside class="explorer-countries" aria-label="탐색할 나라"><p class="explorer-label">나라 <span>수집 기록 · 건</span></p>${manifest.countries.map(c=>`<button data-explore-country="${c.code}" aria-pressed="false"><span>${esc(c.name)}</span><span>${num(c.count)}</span></button>`).join('')}<p class="explorer-scope">출처별 수집 기록입니다.<br>중복·묶음 기록을 포함하며<br>국가별 전체 보유량이 아닙니다.</p><div class="explorer-cases"></div></aside><section class="explorer-catalog" aria-label="선택한 나라의 기록"><header class="explorer-catalog-head"><div><h2 id="explorer-country-name"></h2><p id="explorer-count" role="status" aria-live="polite"></p></div><label class="explorer-search"><span>기록 검색</span><input type="search" id="explorer-search" placeholder="유물 이름, 소장처" /></label></header><div class="explorer-scroll" tabindex="0" aria-label="유물 기록 목록"><div class="explorer-grid" id="explorer-grid" aria-busy="true"></div><button class="explorer-more" hidden>기록 더 보기 ↓</button></div><p class="explorer-bottom">칸 하나 = 수집 기록 한 건 · 사진이 없는 기록도 함께 표시합니다.</p></section><aside class="explorer-detail" aria-label="선택한 기록 상세" tabindex="-1"></aside></div>`;
 if(caseButton){caseButton.className='explorer-case-button';host.querySelector('.explorer-cases').append(caseButton);}
 const $=s=>host.querySelector(s),grid=$('.explorer-grid'),scroll=$('.explorer-scroll'),detail=$('.explorer-detail');
 const states=new Map();let code='',rows=[],token=0,loading=false,entered=false;
 const current=()=>states.get(code);
 let view='macro',macro;
 host.dataset.explorerView=view;
 const toggle=document.createElement('div');toggle.className='explorer-view-toggle';toggle.setAttribute('role','group');toggle.setAttribute('aria-label','4번 화면 비교');toggle.innerHTML='<button data-explorer-view="macro" aria-pressed="true">격자 → 사진</button><button data-explorer-view="catalog" aria-pressed="false">사진 탐색</button>';
 host.querySelector('.explorer-header').append(toggle);
 const macroHost=document.createElement('section');macroHost.className='macro-view';macroHost.setAttribute('aria-label','전체 기록 격자에서 사진으로 확대');host.querySelector('.explorer-layout').before(macroHost);
 const switchView=next=>{view=next;host.dataset.explorerView=next;toggle.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.explorerView===next)));macro.setActive(next==='macro');if(next==='macro'&&code&&macro.getCountry()!==code)macro.focus(code);};
 toggle.querySelectorAll('button').forEach(b=>b.onclick=()=>switchView(b.dataset.explorerView));
 macro=createZoomGrid({host:macroHost,countries:manifest.countries,loadCountry,onCountry:next=>select(next),onOpen:async(r,next)=>{await select(next);showDetail(r);host.classList.add('macro-detail-open');}});
 function image(r,large=false){return safe(r.image)?`<img src="${esc(safe(r.image))}" alt="${esc(r.title||'유물 사진')}" loading="${large?'eager':'lazy'}" referrerpolicy="no-referrer">`:'<div class="explorer-no-image"><span>사진 미수집</span><small>명칭과 소장 기록으로 살펴보기</small></div>';}
 function images(root){root.querySelectorAll('img').forEach(img=>img.onerror=()=>{const holder=document.createElement('div');holder.className='explorer-no-image';holder.textContent='외부 사진 연결 불가 · 원문에서 확인';img.replaceWith(holder);});}
 const fact=(k,v)=>v?`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`:'';
 const link=(url,label)=>safe(url)?`<a href="${esc(safe(url))}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`:'';
 function showDetail(r){
  current().selected=r?.id??null;detail.scrollTop=0;macro?.setSelected(r?.id??null);if(!r)host.classList.remove('macro-detail-open');
  if(!r){detail.innerHTML='<div class="explorer-detail-empty"><span>기록 상세</span><h2>사진이나 기록을 선택하세요.</h2><p>선택한 유물의 사진, 설명과 출처가 이곳에 표시됩니다.</p></div>';return;}
  detail.innerHTML=`<div class="explorer-detail-top"><span>${esc(manifest.countries.find(c=>c.code===code).name)} / 기록 상세</span><button aria-label="선택한 기록 닫기">×</button></div><div class="explorer-detail-image">${image(r,true)}</div><div class="explorer-detail-body"><p class="explorer-label">${esc(manifest.sources[r.source]?.name||r.source)}</p><h2>${esc(r.title||'명칭 미제공')}</h2>${r.originalTitle&&r.originalTitle!==r.title?`<p>${esc(r.originalTitle)}</p>`:''}<dl>${fact('소장처',r.institution)}${fact('시대',r.date)}${fact('재질',r.materials)}${fact('크기',r.dimensions)}${fact('관리 번호',r.accession)}</dl><h3>유물 설명</h3><p>${esc(r.description||'이번 수집본에는 상세 설명이 없습니다. 출처의 원문에서 확인할 수 있습니다.')}</p>${r.provenance||r.history||r.acquisition?`<h3>소장·이동 기록</h3><p>${esc(r.provenance||r.history||r.acquisition)}</p>`:''}<div class="explorer-detail-links">${link(r.url,'소장 기록 원문')}${link(r.model,'3D 모델')}</div><p class="explorer-rights">${esc(r.imageRights||'사진 이용 조건은 제공 기관 원문 참조')}<br>해외 소장 사실만으로 반출 경위를 판단할 수 없습니다.</p></div>`;
  detail.querySelector('button').onclick=()=>{showDetail(null);grid.querySelectorAll('[aria-pressed]').forEach(b=>b.setAttribute('aria-pressed','false'));};images(detail);
 }
 function filtered(){const q=current().query.trim().toLocaleLowerCase();return q?rows.filter(r=>[r.title,r.originalTitle,r.institution,r.type,r.materials].join(' ').toLocaleLowerCase().includes(q)):rows;}
 function render(animate=false){
  const state=current(),matches=filtered(),shown=matches.slice(0,state.limit),c=manifest.countries.find(c=>c.code===code);
  $('#explorer-count').textContent=`${state.query?'검색 결과 '+num(matches.length)+'건 · ':num(c.count)+'건 · 사진 주소 '+num(c.images)+'건 · '}${num(shown.length)}건 표시`;
  grid.setAttribute('aria-busy','false');grid.classList.toggle('explorer-reveal',animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches);
  grid.innerHTML=shown.length?shown.map((r,i)=>`<button class="explorer-card" data-record-index="${i}" aria-pressed="${state.selected===r.id}"><div class="explorer-card-visual" style="--delay:${Math.min(i,15)*25}ms">${image(r)}</div><span class="explorer-card-title">${esc(r.title||'명칭 미제공')}</span><span class="explorer-card-holder">${esc(r.institution||'소장처 미표기')}</span></button>`).join(''):'<p class="explorer-empty">검색 결과가 없습니다. 다른 이름이나 소장처를 입력해 보세요.</p>';
  $('.explorer-more').hidden=shown.length>=matches.length;
  grid.querySelectorAll('[data-record-index]').forEach(b=>b.onclick=()=>{current().detailScroll=0;showDetail(shown[+b.dataset.recordIndex]);grid.querySelectorAll('[aria-pressed]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));});images(grid);
 }
 async function select(next){
  if(next===code&&!loading)return;
  if(code){current().scroll=scroll.scrollTop;current().detailScroll=detail.scrollTop;}
  code=next;const request=++token;loading=true;
  if(!states.has(code))states.set(code,{query:'',limit:48,scroll:0,selected:null,detailScroll:0});
  const state=current(),c=manifest.countries.find(c=>c.code===code);
  host.querySelectorAll('[data-explore-country]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.exploreCountry===code)));
  $('#explorer-country-name').textContent=c.name;$('#explorer-search').value=state.query;$('#explorer-count').textContent='기록을 불러오는 중…';grid.setAttribute('aria-busy','true');grid.innerHTML='<p class="explorer-empty">기록을 불러오는 중…</p>';$('.explorer-more').hidden=true;detail.innerHTML='';
  try{const loaded=await loadCountry(code);if(request!==token)return;rows=loaded;loading=false;render(entered);if(entered)observer.disconnect();entered=false;scroll.scrollTop=state.scroll;const rememberedScroll=state.detailScroll;showDetail(rows.find(r=>r.id===state.selected));detail.scrollTop=rememberedScroll;}
  catch{if(request!==token)return;loading=false;$('#explorer-count').textContent='자료를 불러오지 못했습니다';grid.setAttribute('aria-busy','false');grid.innerHTML='<button class="explorer-retry">다시 불러오기</button>';grid.querySelector('button').onclick=()=>{loading=true;select(code);};}
 }
 host.querySelectorAll('[data-explore-country]').forEach(b=>b.onclick=()=>select(b.dataset.exploreCountry));
 $('#explorer-search').oninput=e=>{if(loading)return;current().query=e.target.value;current().limit=48;current().scroll=0;render();scroll.scrollTop=0;};
 $('.explorer-more').onclick=()=>{const y=scroll.scrollTop;current().limit+=48;render();scroll.scrollTop=y;};
 const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){entered=true;if(!loading){render(true);observer.disconnect();}}},{threshold:.25});observer.observe(host);
 select('JP');
 return {select:async next=>{await select(next);switchView('catalog');host.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}};
}