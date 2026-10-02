import * as THREE from 'three';
import { feature } from 'topojson-client';

const point = (lat, lon, r = 1.015) => {
  const a = THREE.MathUtils.degToRad(lat), b = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(r * Math.cos(a) * Math.cos(b), r * Math.sin(a), -r * Math.cos(a) * Math.sin(b));
};

export function createGlobe({ countries, world, onSelect, onChange, host, labels }) {
  const stage=host.parentElement;
  let ignoreClickUntil=0;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch { return { available:false }; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.setClearColor(0x000000, 0);
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 20);
  camera.position.z = 3.55;
  const group = new THREE.Group(); scene.add(group);
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const light = new THREE.DirectionalLight(0xfff8e9, 2.2); light.position.set(-3, 4, 5); scene.add(light);
  const fill = new THREE.DirectionalLight(0xd9e5df, .7); fill.position.set(3, -1, 2); scene.add(fill);
  const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const pickCanvas = document.createElement('canvas'); pickCanvas.width = 2048; pickCanvas.height = 1024;
  const pickCtx = pickCanvas.getContext('2d', { willReadFrequently: true });
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const features = feature(world, world.objects.countries).features;
  let selected = null, mode = 'objects', caseRows = [], target = null, dirty = true;
  let yaw = 0, pitch = 0;
  const maxPitch = THREE.MathUtils.degToRad(65);
  const applyRotation = () => group.rotation.set(pitch, yaw, 0, 'XYZ');
  function polygon(context, rings) {
    context.beginPath();
    for (const ring of rings) {
      const unwrapped = []; let prev = ring[0][0];
      for (const [raw, lat] of ring) {
        let lon = raw;
        while (lon - prev > 180) lon -= 360;
        while (lon - prev < -180) lon += 360;
        unwrapped.push([(lon + 180) / 360 * 2048, (90 - lat) / 180 * 1024]); prev = lon;
      }
      for (const offset of [-2048, 0, 2048]) {
        unwrapped.forEach(([x,y], i) => i ? context.lineTo(x + offset,y) : context.moveTo(x + offset,y));
        context.closePath();
      }
    }
    context.fill('evenodd'); context.stroke();
  }
  function drawTexture() {
    ctx.fillStyle = '#e7e5d8'; ctx.fillRect(0,0,2048,1024);
    pickCtx.clearRect(0,0,2048,1024);
    ctx.lineWidth = .65; ctx.strokeStyle = '#cbcbbb';
    for (let x=0;x<=2048;x+=2048/24) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1024);ctx.stroke(); }
    for (let y=0;y<=1024;y+=1024/12) { ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(2048,y);ctx.stroke(); }
    for (const f of features) {
      const c = countries.find(c => c.iso === Number(f.id));
      const active = c && (mode === 'objects' || caseRows.some(r=>r.country===c.code));
      ctx.fillStyle = c?.code === selected ? '#b66c4c' : active ? '#b4b29a' : '#cbcbb9';
      ctx.strokeStyle = '#f0eee2'; ctx.lineWidth = .9;
      const id = Number(f.id) || 0;
      pickCtx.fillStyle = pickCtx.strokeStyle = `rgb(${id >> 8},${id & 255},0)`;
      pickCtx.lineWidth = .1;
      const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const rings of polygons) { polygon(ctx,rings); polygon(pickCtx,rings); }
    }
    texture.needsUpdate = true; dirty = true;
  }
  drawTexture();
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ map:texture, roughness:1, metalness:0 }));
  group.add(globe);
  const home = {code:'KR',name:'대한민국',lat:36.5,lon:127.8};
  const pins = [...countries,home].map(c => {
    const el = document.createElement('button'); el.className = 'globe-pin'+(c.code==='KR'?' home-pin':'');
    el.dataset.code=c.code;
    el.setAttribute('aria-label', c.code==='KR'?'대한민국 중심으로 보기':`${c.name} 자료 보기`);
    const dot = document.createElement('span'); dot.className = 'pin-dot';
    const label = document.createElement('span'); label.className = 'pin-label';
    label.append(document.createTextNode(c.name+' ')); const count = document.createElement('b'); label.append(count);
    el.append(dot,label); labels.append(el); el.addEventListener('click',()=>{if(c.code==='KR')onSelect(null);else onSelect(c.code);});
    return {c,el,count,vec:point(c.lat,c.lon)};
  });
  function refreshPins() {
    pins.forEach(({c,el,count})=>{
      const n = c.code==='KR'?1:mode === 'objects' ? c.count : caseRows.filter(r=>r.country===c.code).length;
      el.dataset.active = String(n>0); el.classList.toggle('selected', c.code === selected);
      el.setAttribute('aria-pressed',String(c.code===selected));
      count.textContent = c.code==='KR'?'기준 위치':n.toLocaleString('ko-KR');
    });
  }
  function focus(code, immediate=false) {
    dirty = true;
    const c = code==='KR'?home:countries.find(c=>c.code===code) || home;
    const nextYaw = THREE.MathUtils.degToRad(-c.lon - 90);
    const shortest = Math.atan2(Math.sin(nextYaw-yaw), Math.cos(nextYaw-yaw));
    target = { yaw: yaw + shortest, pitch: THREE.MathUtils.clamp(THREE.MathUtils.degToRad(c.lat-(code==='KR'?0:7)), -maxPitch, maxPitch) };
    if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) { yaw=target.yaw;pitch=target.pitch;applyRotation();target=null; }
  }
  let width=1,height=1;
  const resize = new ResizeObserver(()=>{ width=host.clientWidth; height=host.clientHeight; if (!width||!height) return; renderer.setSize(width,height,false); camera.aspect=width/height; camera.updateProjectionMatrix(); dirty = true; }); resize.observe(host);
  const raycaster = new THREE.Raycaster();
  let drag = null;
  stage.addEventListener('pointerdown',e=>{ if(e.button!==0) return; target=null; drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};  });
  stage.addEventListener('pointermove',e=>{
    if(!drag) return;
    if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5)return;
    stage.setPointerCapture(e.pointerId);host.classList.add('dragging');
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    yaw += dx*.004; pitch = THREE.MathUtils.clamp(pitch+dy*.004, -maxPitch, maxPitch);
    applyRotation(); dirty = true; drag.x=e.clientX;drag.y=e.clientY;
  });
  stage.addEventListener('pointerup',e=>{
    if (!drag) return;
    const clicked = Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5;
    drag=null;host.classList.remove('dragging');
    if (!clicked){ignoreClickUntil=performance.now()+350;return;}
    if(e.target.closest('.globe-pin'))return;
    const rect=host.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    const hit=raycaster.intersectObject(globe)[0];
    if(hit?.uv){const px=pickCtx.getImageData(Math.min(2047,Math.floor(hit.uv.x*2048)),Math.min(1023,Math.floor((1-hit.uv.y)*1024)),1,1).data;const c=countries.find(c=>c.iso===(px[0]*256+px[1]));if(c && (mode==='objects'||caseRows.some(r=>r.country===c.code)))onSelect(c.code);}
  });
  stage.addEventListener('click',e=>{if(performance.now()<ignoreClickUntil){e.preventDefault();e.stopPropagation();}},true);
  stage.addEventListener('pointercancel',()=>{drag=null;host.classList.remove('dragging');});
  stage.addEventListener('wheel',e=>{e.preventDefault();camera.position.z=THREE.MathUtils.clamp(camera.position.z+Math.max(-.4,Math.min(.4,e.deltaY*.002)),2.6,4.8);dirty=true;},{passive:false});
  host.tabIndex=0;host.setAttribute('aria-label','지구본. 드래그 또는 방향키로 회전, 휠 또는 플러스 마이너스로 확대 축소.');
  host.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;e.preventDefault();target=null;if(e.key==='0'){onSelect(null);return;}if(['+','=','-'].includes(e.key))camera.position.z=THREE.MathUtils.clamp(camera.position.z+(e.key==='-'?.3:-.3),2.6,4.8);else{yaw+=e.key==='ArrowLeft'?-.2:e.key==='ArrowRight'?.2:0;pitch=THREE.MathUtils.clamp(pitch+(e.key==='ArrowUp'?-.15:e.key==='ArrowDown'?.15:0),-maxPitch,maxPitch);applyRotation();}dirty=true;});
  focus('KR',true);refreshPins();
  const v = new THREE.Vector3(); const projected = new THREE.Vector3();
  let active=true,frame=0;
  let lastTime = performance.now();
  function animate() {
    if(!active)return;frame=requestAnimationFrame(animate);
    const now=performance.now(),dt=Math.min((now-lastTime)/1000,.1);lastTime=now;
    if(document.hidden || (!dirty && !target)) return;
    dirty = false;
    if(target){
      const a=1-Math.exp(-8*dt);yaw+=(target.yaw-yaw)*a;pitch+=(target.pitch-pitch)*a;
      if(Math.abs(target.yaw-yaw)+Math.abs(target.pitch-pitch)<.001){yaw=target.yaw;pitch=target.pitch;target=null;}
      applyRotation();
    }
    scene.updateMatrixWorld();
    const occupied=[];
    const ordered=[...pins].sort((a,b)=>Number(b.c.code===selected)-Number(a.c.code===selected));
    ordered.forEach(({el,vec,c})=>{
      v.copy(vec).applyQuaternion(group.quaternion);
      const visible=el.dataset.active==='true' && v.dot(camera.position.clone().sub(v))>.05;
      el.hidden=!visible;if(!visible)return;
      projected.copy(v).project(camera);
      el.style.left=`${(projected.x+1)/2*width}px`;el.style.top=`${(1-projected.y)/2*height}px`;
      const x=(projected.x+1)/2*width,y=(1-projected.y)/2*height;
      const crowded=occupied.some(p=>Math.abs(x-p.x)<95&&Math.abs(y-p.y)<48);
      el.dataset.crowded=String(crowded);if(!crowded)occupied.push({x,y});
      el.style.zIndex=String(c.code===selected?500:Math.round(v.z*100)+100);
    });
    renderer.render(scene,camera);host.dataset.yaw=String(yaw);host.dataset.pitch=String(pitch);
    onChange?.({country:selected,zoom:3.55/camera.position.z,min:camera.position.z>=4.8,max:camera.position.z<=2.6});
  }
  animate();host.dataset.ready='true';
  return {
    available:true,
    getCountry(){return selected;},
    setActive(value){if(active===value)return;active=value;if(active){dirty=true;lastTime=performance.now();animate();}else{cancelAnimationFrame(frame);drag=null;host.classList.remove('dragging');}},
    select(code,{move=true}={}){selected=code;drawTexture();refreshPins();if(move&&code!=='all')focus(code);},
    reset(){selected=null;drawTexture();refreshPins();camera.position.z=3.55;focus('KR');},
    zoom(delta){camera.position.z=THREE.MathUtils.clamp(camera.position.z+delta,2.6,4.8);dirty=true;},
    setMode(next, rows){mode=next;caseRows=rows;refreshPins();drawTexture();}
  };
}

