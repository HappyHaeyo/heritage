import './style.css';
import './overview.css';
import { createDistribution } from './distribution.js';

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = v => { try { const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:''; }catch{return '';} };
const num = n => Number(n).toLocaleString('ko-KR');
const link = (url,label,primary=false) => safeUrl(url)?`<a class="${primary?'primary':''}" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`:'';
const fact = (label,value) => `<div><dt>${esc(label)}</dt><dd>${esc(value || '자료에 표기 없음')}</dd></div>`;
const noPhoto = (message='수집본에 사진 주소 없음') => `<div class="no-photo"><span aria-hidden="true">器</span>${esc(message)}<small>소장 기록은 확인할 수 있습니다</small></div>`;
const shortSource = {okchf:'국외소재문화유산재단',nrich:'국립문화유산연구원',cleveland:'CLEVELAND',chicago:'ART INSTITUTE',va:'V&A',smithsonian:'SMITHSONIAN',met_partial:'THE MET'};
async function json(path) { const res=await fetch(import.meta.env.BASE_URL + path);if(!res.ok)throw new Error(`자료 요청 실패 (${res.status})`);return res.json(); }
const state={mode:'objects',country:'JP',query:'',source:'all',photos:false,limit:24,rows:[],loading:false};
let manifest, cases, globe, requestId=0;
const cache=new Map();
function imageHTML(row) { return safeUrl(row.image)?`<img src="${esc(safeUrl(row.image))}" alt="${esc(row.title)}" loading="lazy" referrerpolicy="no-referrer" />`:noPhoto(); }
function handleImages(container) { container.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const holder=document.createElement('div');holder.innerHTML=noPhoto('사진을 불러오지 못했습니다');img.replaceWith(holder.firstElementChild);},{once:true})); }
function resetFilters(){state.query='';state.source='all';state.photos=false;state.limit=24;$('#search').value='';$('#source-filter').value='all';$('#photos-only').checked=false;renderCards();}
function renderTabs(){
  const choices=state.mode==='objects'?manifest.countries:[{code:'all',name:'전체 사례'},...['FR','JP','US'].map(code=>manifest.countries.find(c=>c.code===code))];
  $('#country-tabs').setAttribute('aria-label',state.mode==='objects'?'소장 국가 선택':'반출 국가 선택');
  $('#country-tabs').innerHTML=choices.map(c=>`<button class="country-tab ${state.country===c.code?'active':''}" data-country="${c.code}" aria-pressed="${state.country===c.code}">${esc(c.name)}</button>`).join('');
  $('#country-tabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectCountry(b.dataset.country)));
}
function updateHeading(){
  const c=manifest.countries.find(c=>c.code===state.country);
  const isCase=state.mode==='cases';
  $('#collection-eyebrow').textContent=isCase?'DOCUMENTED REMOVALS / '+(c?.en.toUpperCase()||'ALL CASES'):'THE COLLECTION / '+c.en.toUpperCase();
  $('#collection-title').textContent=isCase?(c?c.name+' 반출 사례':'반출과 귀환의 기록'):c.name+'에 있는 유산';
  $('#catalog-index').textContent=isCase?'07 CASES':String(manifest.countries.indexOf(c)+1).padStart(2,'0')+' / 09';
  $('#sort-label').textContent=isCase?'공식 근거가 있는 사례·자료군':'사진·설명이 있는 자료 우선';
  $('#filter-toggle').hidden=isCase;$('#filters').hidden=isCase||$('#filter-toggle').getAttribute('aria-expanded')!=='true';
  $('#search').placeholder=isCase?'사례 이름, 반출 경위 검색':'유물 이름, 소장처 검색';
  $('#search').setAttribute('aria-label',isCase?'사례 이름 또는 반출 경위 검색':'유물 이름 또는 소장처 검색');
  $('#collection-note').textContent=isCase?'사례·자료군 7건입니다. 유물 7점을 뜻하지 않습니다.':'기관의 공개 소장 기록을 바탕으로 구성했습니다.';

}
async function selectCountry(code){
  state.country=code;state.limit=24;state.loading=false;const token=++requestId;
  renderTabs();updateHeading();if(state.mode==='objects')globe?.select(code);$('#card-list').scrollTop=0;
  if(state.mode==='cases'){state.rows=cases.filter(r=>code==='all'||r.country===code);renderCards();return;}
  state.loading=true;state.rows=[];$('#active-filters').hidden=true;$('#card-list').setAttribute('aria-busy','true');$('#card-list').className='card-list';$('#card-list').innerHTML='<div class="skeleton"></div><div class="skeleton"></div>';$('#results-count').textContent='자료를 불러오는 중…';$('#load-more-wrap').hidden=true;
  try{
    if(!cache.has(code))cache.set(code,json(`data/${code}.json`).catch(e=>{cache.delete(code);throw e;}));
    const rows=await cache.get(code);if(token!==requestId)return;state.loading=false;state.rows=rows;renderCards();
  }catch(e){if(token!==requestId)return;state.loading=false;$('#card-list').innerHTML='<div class="empty-state error-state"><strong>자료를 불러오지 못했습니다.</strong><p>연결을 확인한 뒤 다시 시도해 주세요.</p><button id="retry">다시 불러오기</button></div>';$('#retry').onclick=()=>selectCountry(code);$('#results-count').textContent='불러오기 실패';$('#card-list').setAttribute('aria-busy','false');}
}
function caseStatus(r){return r.state==='loan'?'국내 대여 중 · 소유권 반환 아님':r.state==='abroad'?'해외 소장 확인':r.status;}
function renderCards(){
  if(state.loading)return;
  const conditions=[state.query.trim()?'검색: '+state.query.trim():'',state.source!=='all'?manifest.sources[state.source]?.name:'',state.photos?'사진 있는 자료만':''].filter(Boolean);
  $('#active-filters').hidden=!conditions.length;$('#active-filters span').textContent=conditions.join(' · ');
  $('#filter-toggle').firstChild.textContent='필터'+((state.photos?1:0)+(state.source!=='all'?1:0)?' '+((state.photos?1:0)+(state.source!=='all'?1:0)):'')+' '; 
  const isCase=state.mode==='cases';const q=state.query.trim().toLocaleLowerCase();
  const rows=state.rows.filter(r=>{
    if(!isCase&&((state.source!=='all'&&r.source!==state.source)||(state.photos&&!r.image)))return false;
    const hay=isCase?[r.name,r.removal_type,r.evidence_authority,r.evidence_summary]:[r.title,r.originalTitle,r.institution,r.type,r.materials];
    return !q||hay.join(' ').toLocaleLowerCase().includes(q);
  });
  const list=$('#card-list');const scroll=list.scrollTop;list.className='card-list'+(isCase?' case-list':'');list.setAttribute('aria-busy','false');
  $('#results-count').innerHTML=isCase?`<strong>${num(rows.length)}</strong>개 사례·자료군`:`${state.query||state.photos||state.source!=='all'?'조건에 맞는':'전체'} <strong>${num(rows.length)}</strong>건 · 그중 사진 주소 있는 기록 ${num(rows.filter(r=>r.image).length)}건`; 
  $('#load-more-wrap').hidden=isCase||rows.length<=state.limit;
  if(!rows.length){list.innerHTML='<div class="empty-state"><strong>조건에 맞는 기록이 없습니다.</strong><p>검색어나 출처·사진 필터를 바꿔 살펴보세요.</p><button id="reset-empty">검색·필터 초기화</button></div>';$('#reset-empty').onclick=resetFilters;return;}
  const shown=isCase?rows:rows.slice(0,state.limit);
  list.innerHTML=shown.map(r=>isCase?`<button class="case-card" data-id="${esc(r.id)}"><div class="case-head"><span>${esc(r.removal_year||'시점 미확정')} · ${esc(r.removal_type)}</span><span>${esc(r.removal_country)} 반출 ↗</span></div><h3>${esc(r.name)}</h3><p>${esc(r.evidence_summary)}</p><div class="case-state ${r.state}">${esc(caseStatus(r))}</div></button>`:`<button class="artifact-card" data-id="${esc(r.id)}"><div class="card-image">${imageHTML(r)}<span class="record-tag">${r.model?'3D 자료 연결':esc(shortSource[r.source]||r.source)}</span></div><div class="card-meta"><span>${esc(r.date||'제작 시기 미상')}</span>${r.type?'<i></i><span>'+esc(r.type)+'</span>':''}</div><h3>${esc(r.title||'명칭 미제공')}</h3><p class="card-institution">${esc(r.institution)}</p></button>`).join('');
  list.querySelectorAll('[data-id]').forEach(button=>button.onclick=()=>openDetail(shown.find(r=>r.id===button.dataset.id),isCase));handleImages(list);list.scrollTop=scroll;
}
function openDetail(r,isCase){
  if(isCase){
    $('#detail-content').innerHTML=`<article class="case-layout"><p class="eyebrow">DOCUMENTED CASE / ${esc(r.evidence_authority)}</p><h2 id="detail-title">${esc(r.name)}</h2><span class="detail-status ${r.state}">${esc(caseStatus(r))}</span><p class="case-summary">${esc(r.evidence_summary)}</p><div class="case-route"><div><span>반출 국가 · ${esc(r.removal_year||'시점 미확정')}</span><strong>${esc(r.removal_country)}</strong></div><b>→</b><div><span>공식 자료에서 확인한 위치</span><strong>${esc(r.location)}</strong></div></div><dl class="detail-facts">${fact('기록 단위',r.unit)}${fact('반출 경위',r.removal_type)}${fact('귀환·이동 시점',r.return_year||'이 자료에서 확정하지 않음')}${fact('자료의 상태 표기',r.status)}</dl><section class="detail-section"><h3>해석할 때 확인할 점</h3><p>${esc(r.note)}</p>${r.state==='loan'?'<p><strong>국내에 있다는 것과 소유권이 반환되었다는 것은 다릅니다. 이 사례는 대여로 구분합니다.</strong></p>':''}</section><div class="detail-actions">${link(r.evidence_url,'반출 근거 읽기',true)}${link(r.status_url,'위치·상태 근거 읽기')}</div><p class="detail-disclaimer">이 기록은 사례 또는 자료군 단위이며 개별 유물 전체 목록은 아닙니다. 현재 위치는 연결된 공식 자료의 확인 범위에 따릅니다.</p></article>`;
  }else{
    const section=(heading,value,missing)=>`<section class="detail-section"><h3>${heading}</h3>${value?'<small>제공 기관 원문</small><p>'+esc(value)+'</p>':'<p class="missing-info">'+missing+'</p>'}</section>`;
    $('#detail-content').innerHTML=`<article class="detail-layout"><div class="detail-visual">${imageHTML(r)}<p>${esc(r.imageRights||'이미지 이용 조건은 제공 기관의 원문 페이지에서 확인해 주세요.')}</p></div><div class="detail-info"><p class="eyebrow">${esc(manifest.sources[r.source]?.name||r.source)}</p><h2 id="detail-title">${esc(r.title)}</h2>${r.originalTitle&&r.originalTitle!==r.title?'<p class="original-title">'+esc(r.originalTitle)+'</p>':''}<span class="detail-status">소장 기록 · 반출 경위는 별도 확인 필요</span><dl class="detail-facts">${fact('소장처',r.institution)}${fact('제작 시기',r.date)}${fact('분류',r.type)}${fact('재질',r.materials)}${fact('크기',r.dimensions)}${fact('관리 번호',r.accession)}${r.acquisition?fact('취득 표기',r.acquisition):''}</dl>${section('유물 설명',r.description,'이번 수집본에는 상세 설명이 없습니다. 원문 페이지를 확인해 주세요.')}${section('소장·이동 이력',r.provenance||r.history,'이번 수집본에는 소장·이동 이력이 없습니다. 해외 소장 사실만으로 약탈 여부를 판단할 수 없습니다.')}${r.credit?section('기관의 취득·기증 표기',r.credit,''):''}<div class="detail-actions">${link(r.url,'소장 기록 원문',true)}${link(r.model,'3D 모델 보기')}</div><p class="detail-disclaimer">출처별 기록 1건입니다. 동일 유물이 다른 출처에도 등장하거나 하나의 기록이 여러 점을 포함할 수 있습니다.${r.review?' 출처 분류의 추가 검토가 필요한 자료입니다.':''}</p></div></article>`;
  }
  handleImages($('#detail-content'));$('#detail-dialog').setAttribute('aria-labelledby','detail-title');$('#detail-dialog').showModal();$('#detail-dialog').scrollTop=0;
}
function syncNav(mode){document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});}
function setMode(mode){
  syncNav(mode);
  state.mode=mode;state.query='';state.source='all';state.photos=false;$('#search').value='';$('#source-filter').value='all';$('#photos-only').checked=false;
  if(mode==='objects'){if($('#collection-dialog').open)$('#collection-dialog').close();globe?.reset();return;}
  selectCountry('all');if(!$('#collection-dialog').open)$('#collection-dialog').showModal();
}
function getRows(code){if(!cache.has(code))cache.set(code,json('data/'+code+'.json').catch(e=>{cache.delete(code);throw e;}));return cache.get(code);}
function showCollection(code){syncNav('objects');if(state.mode==='objects'&&state.country===code&&state.rows.length&&!state.loading){if(!$('#collection-dialog').open)$('#collection-dialog').showModal();return;}state.mode='objects';state.query='';state.source='all';state.photos=false;$('#search').value='';$('#source-filter').value='all';$('#photos-only').checked=false;selectCountry(code);if(!$('#collection-dialog').open)$('#collection-dialog').showModal();}
async function boot(){
  [manifest,cases]=await Promise.all([json('data/manifest.json'),json('data/cases.json')]);
  $('#record-total').textContent=num(manifest.total);$('#country-total').textContent=manifest.countries.length;
  $('#map-country').innerHTML='<option value="">세계 전체</option>'+manifest.countries.map(c=>`<option value="${c.code}">${esc(c.name)}</option>`).join('');
  $('#map-country').onchange=e=>e.target.value?globe?.focus(e.target.value):globe?.reset();
  $('#about-scope').textContent=`${manifest.countries.length}개국 · ${num(manifest.total)}개 출처별 레코드`;
  $('#source-links').innerHTML=Object.values(manifest.sources).map(s=>link(s.url,s.name)).join('');
  $('#source-filter').innerHTML='<option value="all">모든 출처</option>'+Object.entries(manifest.sources).map(([id,s])=>`<option value="${id}">${esc(s.name)}</option>`).join('');
  $('#search').addEventListener('input',e=>{state.query=e.target.value;state.limit=24;$('#card-list').scrollTop=0;renderCards();});
  $('#filter-toggle').onclick=()=>{const expanded=$('#filter-toggle').getAttribute('aria-expanded')!=='true';$('#filter-toggle').setAttribute('aria-expanded',String(expanded));$('#filters').hidden=!expanded;};
  $('#source-filter').onchange=e=>{state.source=e.target.value;state.limit=24;renderCards();};
  $('#photos-only').onchange=e=>{state.photos=e.target.checked;state.limit=24;renderCards();};
  $('#clear-filters').onclick=resetFilters;$('#reset-active-filters').onclick=resetFilters;
  $('#load-more').onclick=()=>{state.limit+=24;renderCards();};
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  $('#about').onclick=()=>$('#about-dialog').showModal();$('#close-about').onclick=()=>$('#about-dialog').close();$('#close-detail').onclick=()=>$('#detail-dialog').close();
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}));
  $('#close-collection').onclick=()=>$('#collection-dialog').close();
  $('#collection-dialog').addEventListener('close',()=>syncNav('objects'));
  $('#open-country').onclick=()=>{const code=globe?.getCountry();if(code)showCollection(code);};
  const world=await json('data/world.json');globe=createDistribution({countries:manifest.countries,world,loadCountry:getRows,onOpen:r=>openDetail(r,false)});
  $('#reset-view').onclick=()=>globe?.reset();$('#zoom-in').onclick=()=>globe?.zoom(-.3);$('#zoom-out').onclick=()=>globe?.zoom(.3);
}
boot().catch(e=>{console.error(e);$('#card-list').innerHTML='<div class="empty-state error-state"><strong>자료를 준비하지 못했습니다.</strong><p>개발 서버를 통해 접속했는지 확인해 주세요.</p><button onclick="location.reload()">다시 시도</button></div>';$('#card-list').setAttribute('aria-busy','false');$('#results-count').textContent='불러오기 실패';});

