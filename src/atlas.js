import {createDistribution} from './distribution.js';
import {createGlobe} from './globe.js';

export function createAtlas({countries,world,loadCountry,onOpen,onSelectCountry}) {
  const $=s=>document.querySelector(s);
  const points=createDistribution({countries,world,loadCountry,onOpen});
  const pointsPanel=$('.map-explorer');
  const earthPanel=document.createElement('div');earthPanel.id='earth-stage';earthPanel.className='globe-stage sphere-stage';earthPanel.hidden=true;
  earthPanel.innerHTML='<div id="earth-canvas" class="sphere-host"></div><div id="earth-labels" class="globe-labels"></div>';
  pointsPanel.after(earthPanel);
  const pointKey=$('.unit-key').innerHTML,pointNote=$('#scope-note').textContent;
  let view='points',earth=null;
  const current=()=>view==='points'?points:earth;
  function earthStatus({country,zoom,min,max}) {
    if(view!=='globe')return;
    const c=countries.find(c=>c.code===country);
    $('#map-country').value=country||'';
    $('#zoom-country').textContent=c?`${c.name} · 전체 ${c.count.toLocaleString('ko-KR')}건 · 사진 주소 ${c.images.toLocaleString('ko-KR')}건`:'한국 중심 세계 지도';
    $('#zoom-reading').textContent='드래그·방향키로 회전 · 휠로 확대 · 국가를 누르면 기록 보기';
    $('#open-country').hidden=!c;$('#open-country').textContent=c?`${c.name} 기록 보기 ↗`:'';
    $('#zoom-value').textContent=zoom.toFixed(1)+'×';$('#zoom-in').disabled=max;$('#zoom-out').disabled=min;$('#reset-view').disabled=false;
  }
  function switchView(next) {
    if(next===view)return;
    const selected=current().getCountry();
    if(next==='globe') {
      if(!earth) {
        earthPanel.hidden=false;
        earth=createGlobe({countries,world,host:$('#earth-canvas'),labels:$('#earth-labels'),onChange:earthStatus,onSelect:code=>{if(code){earth.select(code);onSelectCountry(code);}else earth.reset();}});
        if(!earth.available){earthPanel.hidden=true;earth=null;const button=$('[data-view="globe"]');button.disabled=true;button.title='이 브라우저에서는 3D 지구본을 사용할 수 없습니다.';$('#zoom-reading').textContent='3D 지구본을 사용할 수 없어 점 분포를 유지합니다.';return;}
      }
      points.setActive(false);pointsPanel.hidden=true;earthPanel.hidden=false;view='globe';earth.setActive(true);
      if(selected!==earth.getCountry()){if(selected)earth.select(selected);else earth.reset();}
      // Also refresh shared controls when returning to an unchanged globe.
      earth.select(earth.getCountry(),{move:false});
      $('.unit-key').innerHTML='<i></i> 국가 위치와 수집 기록 수 <span>드래그하여 지구본 회전</span>';
      $('#scope-note').textContent='출처 간 중복이 포함된 수집 기록이며 국가별 전체 보유량이 아닙니다. 표시는 국가 대표 위치이며 개별 유물의 실제 위치가 아닙니다.';
      $('#reset-view').textContent='한국 중심 ↺';$('#reset-view').setAttribute('aria-label','한국 중심으로 돌아가기');
      $('.skip-link').href='#earth-canvas';
    }else {
      earth.setActive(false);earthPanel.hidden=true;pointsPanel.hidden=false;view='points';points.setActive(true);
      if(selected!==points.getCountry()){if(selected)points.focus(selected);else points.reset();}
      $('.unit-key').innerHTML=pointKey;$('#scope-note').textContent=pointNote;
      $('#reset-view').textContent='전체 보기 ↺';$('#reset-view').setAttribute('aria-label','세계 전체 보기');$('.skip-link').href='#globe-stage';
    }
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    document.querySelector('.atlas').dataset.view=view;
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
  return {
    focus(code){view==='points'?points.focus(code):earth.select(code);},
    select(code){if(current().getCountry()!==code)this.focus(code);},
    reset(){current().reset();},zoom(delta){current().zoom(delta);},getCountry(){return current().getCountry();}
  };
}
