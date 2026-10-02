import * as THREE from 'three';
import {feature} from 'topojson-client';

export function createDistribution({countries,world,loadCountry,onOpen,onCountry}) {
  const host=document.querySelector('#globe-canvas'),stage=document.querySelector('#globe-stage'),labels=document.querySelector('#globe-labels');
  const photoLayer=document.createElement('div');photoLayer.className='map-photos';stage.append(photoLayer);
  const locations={GB:[.105,.19],NL:[.265,.045],DE:[.255,.34],FR:[.105,.61],RU:[.445,.045],CN:[.40,.64],JP:[.625,.47],CA:[.83,.065],US:[.85,.51]};
  const scene=new THREE.Scene();let renderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);}catch{document.querySelector('#globe-fallback').hidden=false;}
  const camera=new THREE.OrthographicCamera(0,1,1,0,-10,10);camera.position.z=5;
  const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1000;const ctx=canvas.getContext('2d');
  const mx=lon=>((lon-127.8+540)%360-180+180)/360,my=lat=>(83-lat)/143;
  for(const f of feature(world,world.objects.countries).features){
    if(Number(f.id)===10)continue;
    ctx.fillStyle=Number(f.id)===410?'#597873':countries.some(c=>c.iso===Number(f.id))?'#c9c6b8':'#dedbd0';ctx.strokeStyle='#f4f0e7';ctx.lineWidth=1.2;
    for(const rings of f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates){ctx.beginPath();
      for(const ring of rings){let prev=(mx(ring[0][0])-.5)*360;const coords=[];
        for(const [lon,lat] of ring){let x=(mx(lon)-.5)*360;while(x-prev>180)x-=360;while(x-prev< -180)x+=360;coords.push([(x+180)/360*2400,my(lat)*1000]);prev=x;}
        for(const shift of [-2400,0,2400]){coords.forEach(([x,y],i)=>i?ctx.lineTo(x+shift,y):ctx.moveTo(x+shift,y));ctx.closePath();}
      }ctx.fill('evenodd');ctx.stroke();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const map=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));map.position.z=-2;scene.add(map);
  const sprite=document.createElement('canvas');sprite.width=sprite.height=32;const sc=sprite.getContext('2d');sc.fillStyle='white';sc.beginPath();sc.arc(16,16,14,0,Math.PI*2);sc.fill();const dotTexture=new THREE.CanvasTexture(sprite);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('map-connections');svg.setAttribute('aria-hidden','true');const wires=document.createElementNS(svg.namespaceURI,'g');svg.append(wires);stage.insertBefore(svg,labels);
  let width=1,height=1,spacing=2,zoom=1,panX=0,panY=0,selected=null,animation=null,frame=0,ignoreClickUntil=0;
  let active=true;
  const photoNodes=new Map();
  const explorer=document.createElement('div');explorer.className='map-explorer';stage.before(explorer);explorer.append(stage);
  const navigator=document.createElement('aside');navigator.className='record-navigator';navigator.hidden=true;navigator.setAttribute('aria-label','전체 기록에서 탐색 위치 선택');
  navigator.innerHTML='<div class="navigator-copy"><strong id="navigator-title"></strong><p>묶음을 눌러 이동 · 진한 점은 사진 있음</p></div><canvas id="record-overview" width="440" height="440" tabindex="0" role="img" aria-label="전체 기록과 현재 화면 영역. 클릭 또는 방향키로 이동"></canvas><div class="navigator-actions"><p class="viewport-key"><i></i>지금 보는 영역</p><div class="pan-buttons" aria-label="사진 영역 이동"><button data-pan="left" aria-label="왼쪽 영역 보기">←</button><button data-pan="up" aria-label="위쪽 영역 보기">↑</button><button data-pan="down" aria-label="아래쪽 영역 보기">↓</button><button data-pan="right" aria-label="오른쪽 영역 보기">→</button></div><button id="country-fit">이 나라 전체 보기</button><button id="photo-center">사진 있는 중심으로</button></div>';
  explorer.prepend(navigator);
  const mini=navigator.querySelector('canvas'),miniContext=mini.getContext('2d');let miniBounds=null;
  const groupBounds=g=>({left:g.x+(g.ext.minX-.5)*spacing,right:g.x+(g.ext.maxX+.5)*spacing,top:g.y+(g.ext.minY-.5)*spacing,bottom:g.y+(g.ext.maxY+.5)*spacing});
  function navigateBy(dx,dy){animation=null;panX-=dx*width*.8;panY-=dy*height*.8;schedule();}
  navigator.querySelectorAll('[data-pan]').forEach(b=>b.onclick=()=>navigateBy(b.dataset.pan==='left'?-1:b.dataset.pan==='right'?1:0,b.dataset.pan==='up'?-1:b.dataset.pan==='down'?1:0));
  navigator.querySelector('#country-fit').onclick=()=>{const g=groups.find(g=>g.c.code===selected);if(!g)return;const r=groupBounds(g);const z=Math.max(1.1,Math.min((width-60)/(r.right-r.left),(height-60)/(r.bottom-r.top)));move(z,width/2-(r.left+r.right)/2*z,height/2-(r.top+r.bottom)/2*z);};
  navigator.querySelector('#photo-center').onclick=()=>focus(selected);
  function jumpTo(e){if(!miniBounds)return;const r=mini.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*220,y=(e.clientY-r.top)/r.height*220;const g=groups.find(g=>g.c.code===selected);if(!g)return;let wx=miniBounds.left+(x-12)/miniBounds.scale,wy=miniBounds.top+(y-12)/miniBounds.scale;
    // Empty corners of the spiral jump to the closest real record.
    let nearest=g.cells[0],distance=Infinity;for(const cell of g.cells){const d=(g.x+cell[0]*spacing-wx)**2+(g.y+cell[1]*spacing-wy)**2;if(d<distance){distance=d;nearest=cell;}}
    wx=g.x+nearest[0]*spacing;wy=g.y+nearest[1]*spacing;const z=Math.max(zoom,Math.min(170,112/spacing));move(z,width/2-wx*z,height/2-wy*z,false);
  }
  mini.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();mini.setPointerCapture(e.pointerId);jumpTo(e);});mini.addEventListener('pointermove',e=>{if(mini.hasPointerCapture(e.pointerId))jumpTo(e);});
  mini.addEventListener('keydown',e=>{const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(keys[e.key]){e.preventDefault();navigateBy(...keys[e.key]);}});
  function updateNavigator(){const g=groups.find(g=>g.c.code===selected);const visible=zoom>1.05&&!!g;navigator.hidden=!visible;explorer.classList.toggle('exploring',visible);if(!visible)return;
    navigator.querySelector('#navigator-title').textContent=g.c.name+' 전체 '+g.c.count.toLocaleString('ko-KR')+'건';
    navigator.querySelector('#photo-center').textContent=g.c.images?'사진 있는 중심으로':'기록 중심으로';
    const r=groupBounds(g),scale=196/Math.max(r.right-r.left,r.bottom-r.top);miniBounds={left:r.left,top:r.top,scale};
    const c=miniContext;c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,220,220);c.fillStyle='#eee8dc';c.fillRect(0,0,220,220);
    const size=Math.max(.7,spacing*scale*.72);g.cells.forEach(([cx,cy],i)=>{c.fillStyle=g.rows&&!g.rows[i]?.image?'#c5bdae':'#a65338';c.fillRect(12+(g.x+cx*spacing-r.left)*scale-size/2,12+(g.y+cy*spacing-r.top)*scale-size/2,size,size);});
    const vx=12+(-panX/zoom-r.left)*scale,vy=12+(-panY/zoom-r.top)*scale,vw=width/zoom*scale,vh=height/zoom*scale;
    c.fillStyle='#1f6d7755';c.strokeStyle='#155761';c.lineWidth=2;c.fillRect(vx,vy,vw,vh);c.strokeRect(vx,vy,vw,vh);
    mini.dataset.viewport=[vx,vy,vw,vh].map(n=>n.toFixed(2)).join(',');mini.dataset.country=g.c.code;
    const epsilon=1/zoom;const viewLeft=-panX/zoom,viewTop=-panY/zoom;
    navigator.querySelector('[data-pan="left"]').disabled=viewLeft<=r.left+epsilon;navigator.querySelector('[data-pan="right"]').disabled=viewLeft+width/zoom>=r.right-epsilon;
    navigator.querySelector('[data-pan="up"]').disabled=viewTop<=r.top+epsilon;navigator.querySelector('[data-pan="down"]').disabled=viewTop+height/zoom>=r.bottom-epsilon;
  }
  function spiral(n){const out=[];let x=0,y=0,dx=1,dy=0,len=1;out.push([x,y]);while(out.length<n){for(let turn=0;turn<2;turn++){for(let step=0;step<len&&out.length<n;step++){x+=dx;y+=dy;out.push([x,y]);}const old=dx;dx=-dy;dy=old;}len++;}return out;}
  const groups=countries.map(c=>{
    const cells=spiral(c.count);const xs=cells.map(p=>p[0]),ys=cells.map(p=>p[1]);const ext={minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
    const el=document.createElement('button');el.className='country-cluster';el.dataset.code=c.code;el.setAttribute('aria-label',`${c.name} ${c.count.toLocaleString('ko-KR')}개 수집 기록 확대`);
    const heading=document.createElement('span');heading.className='cluster-heading';const name=document.createElement('span');name.className='cluster-name';name.textContent=c.name;const count=document.createElement('strong');count.textContent=c.count.toLocaleString('ko-KR');heading.append(name,count);el.append(heading);labels.append(el);el.onclick=()=>focus(c.code);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(c.count*3),3));
    const material=new THREE.PointsMaterial({color:0xa45438,size:1.5,map:dotTexture,transparent:true,alphaTest:.1,sizeAttenuation:false,depthTest:false});const points=new THREE.Points(geometry,material);scene.add(points);
    const path=document.createElementNS(svg.namespaceURI,'path');path.classList.add('country-connector');wires.append(path);const marker=document.createElementNS(svg.namespaceURI,'circle');marker.setAttribute('r','2.5');marker.classList.add('country-location');wires.append(marker);
    return {c,cells,ext,el,geometry,material,path,marker,x:0,y:0,rows:null,pending:false,failed:false};
  });
  const home=document.createElement('span');home.className='map-home';home.innerHTML='<i></i><span>대한민국</span>';labels.append(home);
  let mapTop=0,mapHeight=1;
  const fallback=document.createElement('canvas');fallback.className='map-canvas-fallback';if(!renderer)host.append(fallback);
  const screen=(x,y)=>({x:x*zoom+panX,y:y*zoom+panY});
  function schedule(){if(active&&!frame)frame=requestAnimationFrame(draw);}
  function fetchRows(g){if(g.rows||g.pending||g.failed)return;g.pending=true;loadCountry(g.c.code).then(rows=>{g.rows=rows;g.pending=false;schedule();}).catch(()=>{g.failed=true;g.pending=false;schedule();});}
  function updatePhotos(){
    const step=spacing*zoom;const show=step>=60;const needed=new Set();let pending=false,failed=false;
    if(show){
      for(const g of groups){const left=(g.x+g.ext.minX*spacing)*zoom+panX,right=(g.x+g.ext.maxX*spacing)*zoom+panX,top=(g.y+g.ext.minY*spacing)*zoom+panY,bottom=(g.y+g.ext.maxY*spacing)*zoom+panY;
        if(right< -step||left>width+step||bottom< -step||top>height+step)continue;
        fetchRows(g);pending ||=g.pending;failed ||=g.failed;if(!g.rows)continue;
        for(let i=0;i<g.cells.length;i++){
          const [cx,cy]=g.cells[i],p=screen(g.x+cx*spacing,g.y+cy*spacing);if(p.x< -step||p.x>width+step||p.y< -step||p.y>height+step)continue;
          const row=g.rows[i];if(!row)continue;const key=g.c.code+':'+row.id;needed.add(key);
          let b=photoNodes.get(key);
          if(!b){b=document.createElement('button');b.className='map-object'+(row.image?' has-photo':' no-image');b.dataset.id=row.id;b.dataset.country=g.c.code;b.setAttribute('aria-label',row.title+(row.image?' 상세 보기':' · 사진 주소 없음, 소장 기록 보기'));b.title=row.title+(row.image?'':' · 수집본에 사진 주소 없음');
            if(row.image&&/^https?:\/\//i.test(row.image)){const img=document.createElement('img');img.alt=row.title;img.draggable=false;img.referrerPolicy='no-referrer';img.loading='lazy';img.decoding='async';img.onload=()=>b.classList.add('photo-loaded');img.src=row.image;img.onerror=()=>{b.classList.add('image-failed');b.classList.remove('has-photo');img.remove();b.title=row.title+' · 사진 연결 실패';};b.append(img);}
            const marker=document.createElement('span');marker.className='object-dot';b.append(marker);const caption=document.createElement('span');caption.className='object-caption';caption.textContent=row.title; b.append(caption);
            b.addEventListener('click',()=>{if(performance.now()>ignoreClickUntil)onOpen(row);});photoLayer.append(b);photoNodes.set(key,b);
          }
          const size=step*.84;b.style.width=b.style.height=`${size}px`;b.style.transform=`translate(${p.x-size/2}px,${p.y-size/2}px)`;b.style.opacity=String(Math.min(1,(step-60)/16));b.style.pointerEvents=step>68?'auto':'none';
        }
      }
    }
    for(const [key,node] of photoNodes){if(!needed.has(key)){node.remove();photoNodes.delete(key);}}
    const status=document.querySelector('#zoom-reading');status.textContent=failed?'사진 자료를 불러오지 못했습니다. 국가 기록 보기에서 다시 확인하세요.':pending?'이 영역의 사진을 불러오는 중…':show?(countries.find(c=>c.code===selected)?.images===0?'이 국가의 수집본에는 사진이 없습니다. 점을 누르면 소장 기록이 열립니다.':'휠·드래그로 이동 · 사진을 누르면 상세 보기 · Ctrl+휠로 확대·축소'):'국가를 선택하면 사진으로 확대 · 휠·두 손가락으로 확대·축소';
    stage.dataset.level=show?'photos':'points';
  }
  function draw(now){
    frame=0;if(!active)return;
    if(animation){const t=Math.min(1,(now-animation.start)/520),e=1-Math.pow(1-t,3);zoom=animation.from.z+(animation.to.z-animation.from.z)*e;panX=animation.from.x+(animation.to.x-animation.from.x)*e;panY=animation.from.y+(animation.to.y-animation.from.y)*e;if(t===1)animation=null;else schedule();}
    if(!animation&&zoom>2&&!(spacing*zoom>=60&&selected)){const cx=(width/2-panX)/zoom,cy=(height/2-panY)/zoom;let nearest=groups[0];for(const g of groups)if((g.x-cx)**2+(g.y-cy)**2<(nearest.x-cx)**2+(nearest.y-cy)**2)nearest=g;if(selected!==nearest.c.code)choose(nearest.c.code);}
    if(!animation){if(zoom===1){panX=0;panY=0;}else{const xs=groups.flatMap(g=>[g.x+g.ext.minX*spacing,g.x+g.ext.maxX*spacing]);const ys=groups.flatMap(g=>[g.y+g.ext.minY*spacing,g.y+g.ext.maxY*spacing]);panX=THREE.MathUtils.clamp(panX,48-Math.max(...xs)*zoom,width-48-Math.min(...xs)*zoom);panY=THREE.MathUtils.clamp(panY,48-Math.max(...ys)*zoom,height-48-Math.min(...ys)*zoom);}}
    if(!animation&&spacing*zoom>=60&&selected){const r=groupBounds(groups.find(g=>g.c.code===selected));const limit=(value,min,max)=>min>max?(min+max)/2:THREE.MathUtils.clamp(value,min,max);panX=limit(panX,width-r.right*zoom,-r.left*zoom);panY=limit(panY,height-r.bottom*zoom,-r.top*zoom);}
    camera.left=-panX/zoom;camera.right=(width-panX)/zoom;camera.top=height+panY/zoom;camera.bottom=height-(height-panY)/zoom;camera.updateProjectionMatrix();
    wires.setAttribute('transform',`translate(${panX} ${panY}) scale(${zoom})`);svg.style.opacity=zoom>4?'0':'1';
    const mobile=width<650;
    for(const g of groups){g.material.size=Math.min(5,Math.max(.7,spacing*.67*zoom));const x=g.x+(g.ext.minX+g.ext.maxX)/2*spacing,y=g.y+g.ext.minY*spacing;const p=screen(x,y);
      g.el.hidden=zoom>4||p.x< -100||p.x>width+100||p.y< -100||p.y>height+100;
      const gw=(g.ext.maxX-g.ext.minX)*spacing*zoom,bw=Math.max(mobile?66:100,gw+14);g.el.style.left=`${p.x-bw/2}px`;g.el.style.top=`${p.y-(mobile?38:46)}px`;g.el.style.width=`${bw}px`;g.el.style.height=`${(g.ext.maxY-g.ext.minY)*spacing*zoom+(mobile?46:56)}px`;
      g.el.classList.toggle('selected',g.c.code===selected);
    }
    const hp=screen(mx(127.8)*width,mapTop+my(36.5)*mapHeight);home.style.left=`${hp.x}px`;home.style.top=`${hp.y}px`;home.hidden=zoom>4;
    if(renderer)renderer.render(scene,camera);else{
      const fc=fallback.getContext('2d');fc.clearRect(0,0,width,height);fc.save();fc.translate(panX,panY);fc.scale(zoom,zoom);fc.drawImage(canvas,0,mapTop,width,mapHeight);fc.fillStyle='#a45438';for(const g of groups)for(const [x,y] of g.cells){fc.beginPath();fc.arc(g.x+x*spacing,g.y+y*spacing,Math.min(2.5/zoom,spacing*.34),0,Math.PI*2);fc.fill();}fc.restore();
    }
    updateNavigator();updatePhotos();document.querySelector('#zoom-value').textContent=`${zoom.toFixed(1)}×`;document.querySelector('#reset-view').disabled=zoom===1&&panX===0&&panY===0;
    document.querySelector('#zoom-out').disabled=zoom<=1;document.querySelector('#zoom-in').disabled=zoom>=180;
    host.dataset.ready='true';host.dataset.recordPoints=String(countries.reduce((s,c)=>s+c.count,0));
  }
  function move(z,x,y,smooth=true){z=THREE.MathUtils.clamp(z,1,180);if(z===1){x=0;y=0;}animation=null;
    if(smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches)animation={start:performance.now(),from:{z:zoom,x:panX,y:panY},to:{z,x,y}};else{zoom=z;panX=x;panY=y;}schedule();
  }
  function choose(code){selected=code;document.querySelector('#map-country').value=code||'';const c=countries.find(c=>c.code===code);document.querySelector('#zoom-country').textContent=c?`${c.name} · 전체 ${c.count.toLocaleString('ko-KR')}건 · 사진 주소 ${c.images.toLocaleString('ko-KR')}건`:'전체 분포';document.querySelector('#open-country').hidden=!c;document.querySelector('#open-country').textContent=c?`${c.name} 기록 보기 ↗`:'';onCountry?.(code);}
  function focus(code){const g=groups.find(g=>g.c.code===code);if(!g)return;choose(code);fetchRows(g);const z=Math.min(170,112/spacing);move(z,width/2-g.x*z,height/2-g.y*z);}
  function zoomAt(factor,x=width/2,y=height/2){const nz=THREE.MathUtils.clamp(zoom*factor,1,180);const wx=(x-panX)/zoom,wy=(y-panY)/zoom;move(nz,x-wx*nz,y-wy*nz,false);if(nz>2){let nearest=null,dist=Infinity;for(const g of groups){const d=(g.x-wx)**2+(g.y-wy)**2;if(d<dist){dist=d;nearest=g;}}if(nearest)choose(nearest.c.code);}else choose(null);}
  function resize(){if(!active||!host.clientWidth||!host.clientHeight)return;const old=width,oldSpacing=spacing,oldZoom=zoom;const anchor=groups.find(g=>g.c.code===selected);const offset=anchor?{x:((width/2-panX)/zoom-anchor.x)/spacing,y:((height/2-panY)/zoom-anchor.y)/spacing}:null;width=host.clientWidth;height=host.clientHeight;if(!width||!height)return;renderer?.setSize(width,height,false);fallback.width=width;fallback.height=height;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    spacing=2.2*Math.min(width/1180,height/530);mapHeight=width*.4;mapTop=(height-mapHeight)*.46;map.scale.set(width,mapHeight,1);map.position.set(width/2,height-mapTop-mapHeight/2,-2);
    for(const g of groups){const [nx,ny]=locations[g.c.code],head=width<650?39:48;g.x=nx*width-(g.ext.minX+g.ext.maxX)/2*spacing;g.y=ny*(height-110)+head-g.ext.minY*spacing;
      const a=g.geometry.attributes.position.array;g.cells.forEach(([x,y],i)=>{a[i*3]=g.x+x*spacing;a[i*3+1]=height-g.y-y*spacing;a[i*3+2]=0;});g.geometry.attributes.position.needsUpdate=true;g.geometry.computeBoundingSphere();
      const ax=mx(g.c.lon)*width,ay=mapTop+my(g.c.lat)*mapHeight,bx=g.x,by=g.y,vx=ax-bx,vy=ay-by;const halfW=(g.ext.maxX-g.ext.minX)*spacing/2+8,halfH=(g.ext.maxY-g.ext.minY)*spacing/2+8,t=Math.min(1,halfW/Math.max(.001,Math.abs(vx)),halfH/Math.max(.001,Math.abs(vy)));g.path.setAttribute('d',`M${ax} ${ay}L${bx+vx*t} ${by+vy*t}`);g.marker.setAttribute('cx',ax);g.marker.setAttribute('cy',ay);
    }
    if(old>1&&oldZoom>1&&anchor&&offset){zoom=THREE.MathUtils.clamp(oldZoom*oldSpacing/spacing,1,180);panX=width/2-(anchor.x+offset.x*spacing)*zoom;panY=height/2-(anchor.y+offset.y*spacing)*zoom;animation=null;}schedule();
  }
  stage.addEventListener('wheel',e=>{e.preventDefault();if(spacing*zoom>=60&&!e.ctrlKey&&!e.metaKey){animation=null;const unit=e.deltaMode===1?16:e.deltaMode===2?height:1;panX-=Math.max(-600,Math.min(600,(e.shiftKey?e.deltaY:e.deltaX)*unit));panY-=e.shiftKey?0:Math.max(-600,Math.min(600,e.deltaY*unit));schedule();return;}const r=stage.getBoundingClientRect();zoomAt(Math.exp(-Math.max(-150,Math.min(150,e.deltaY))*.005),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  const pointers=new Map();let drag=null,pinch=null;
  const distance=()=>{const p=[...pointers.values()];return Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);};
  stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;animation=null;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,px:panX,py:panY,moved:false};if(pointers.size===2){const r=stage.getBoundingClientRect(),p=[...pointers.values()],cx=(p[0].x+p[1].x)/2-r.left,cy=(p[0].y+p[1].y)/2-r.top;pinch={d:distance(),z:zoom,wx:(cx-panX)/zoom,wy:(cy-panY)/zoom};}});
  stage.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2&&pinch){const r=stage.getBoundingClientRect(),p=[...pointers.values()],cx=(p[0].x+p[1].x)/2-r.left,cy=(p[0].y+p[1].y)/2-r.top;const nz=THREE.MathUtils.clamp(pinch.z*distance()/pinch.d,1,180);move(nz,cx-pinch.wx*nz,cy-pinch.wy*nz,false);ignoreClickUntil=performance.now()+500;return;}
    if(!drag)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(Math.hypot(dx,dy)>5){drag.moved=true;stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');panX=drag.px+dx;panY=drag.py+dy;schedule();}
  });
  function end(e){if(drag?.moved)ignoreClickUntil=performance.now()+350;pointers.delete(e.pointerId);drag=null;pinch=null;stage.classList.remove('dragging');}
  stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
  stage.addEventListener('click',e=>{if(performance.now()<ignoreClickUntil){e.stopPropagation();e.preventDefault();}},true);
  stage.addEventListener('dragstart',e=>e.preventDefault());
  stage.tabIndex=0;stage.addEventListener('keydown',e=>{if(e.target!==stage&&!e.target.closest('.map-object'))return;if(['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='0'){choose(null);move(1,0,0);}else if(['+','=','-'].includes(e.key))zoomAt(e.key==='-'?1/1.6:1.6);else{panX+=e.key==='ArrowLeft'?80:e.key==='ArrowRight'?-80:0;panY+=e.key==='ArrowUp'?80:e.key==='ArrowDown'?-80:0;schedule();}}});
  new ResizeObserver(resize).observe(host);resize();choose(null);
  return {setActive(value){active=value;if(!active){if(frame)cancelAnimationFrame(frame);frame=0;animation=null;}else{resize();choose(selected);schedule();}},focus,select(code){if(code!==selected&&countries.some(c=>c.code===code))focus(code);},setMode(){},reset(){choose(null);move(1,0,0);},zoom(delta){zoomAt(delta<0?1.8:1/1.8);},getCountry(){return selected;}};
}
