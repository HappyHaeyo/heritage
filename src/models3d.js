// 05 페이지: 클리블랜드미술관이 공개한 한국 유물 3D 모델 20점을 돌려 보는 화면.
// 3D 뷰어(Sketchfab)는 무거워서, 이 구간이 화면 가까이 왔을 때 처음 불러온다.
import './models3d.css';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = v => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
const embed = id => `https://sketchfab.com/models/${encodeURIComponent(id)}/embed?autostart=1&ui_infos=0&ui_hint=0&ui_inspector=0&ui_settings=0&ui_vr=0&ui_ar=0&dnt=1`;

export async function initModels({ after }) {
  const res = await fetch(import.meta.env.BASE_URL + 'data/models-3d.json');
  if (!res.ok) throw Error('3D 유물 자료 요청 실패');
  const { items } = await res.json();
  const section = document.createElement('section');
  section.id = 'heritage-3d';
  section.className = 'heritage-3d';
  section.innerHTML = `
    <header class="m3d-heading">
      <div><p class="m3d-step">05 / 3D 유물</p><h1>돌려 보는 유물</h1>
      <p>미국 클리블랜드미술관이 공개한 한국 유물 3D 모델 ${items.length}점입니다. 끌어서 돌리고, 휠로 확대합니다.</p></div>
      <p class="m3d-count"><strong>${items.length}</strong><span>점 · 클리블랜드미술관</span></p>
    </header>
    <div class="m3d-main">
      <div class="m3d-viewer"><div class="m3d-frame" id="m3d-frame"><p class="m3d-wait">3D 모델을 준비하는 중…</p></div></div>
      <article class="m3d-info" id="m3d-info" aria-live="polite"></article>
    </div>
    <ol class="m3d-list" id="m3d-list" aria-label="3D 유물 목록">
      ${items.map((m, i) => `<li><button data-i="${i}" aria-pressed="false" title="${esc(m.title)} · ${esc(m.date)}"><span class="m3d-thumb">${safe(m.image) ? `<img src="${esc(safe(m.image))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span><span class="m3d-name">${esc(m.title)}</span><span class="m3d-date">${esc(m.date)}</span></button></li>`).join('')}
    </ol>
    <p class="m3d-source">출처: 클리블랜드미술관 오픈 액세스, 3D 모델은 Sketchfab에서 불러옵니다(인터넷 연결 필요) · 수집일 2026. 10. 2. · 소장 이력과 설명은 미술관 원문(영어) 그대로입니다. · 우리가 모은 기록 2만여 건 가운데 3D 모델이 있는 것은 이 20점뿐입니다.</p>`;
  after.after(section);

  const frame = section.querySelector('#m3d-frame'), info = section.querySelector('#m3d-info'), list = section.querySelector('#m3d-list');
  let current = 0, ready = false;

  function show(i) {
    current = i;
    const m = items[i];
    list.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
    if (ready) frame.innerHTML = `<iframe title="${esc(m.title)} 3D 모델" src="${esc(embed(m.id))}" allow="autoplay; fullscreen; xr-spatial-tracking; accelerometer; gyroscope" loading="lazy"></iframe>`;
    const history = String(m.provenance || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    info.innerHTML = `
      <p class="m3d-kicker">${esc(m.country)} · ${esc(m.institution)}</p>
      <h2>${esc(m.title)}</h2>
      ${m.titleEn && m.titleEn !== m.title ? `<p class="m3d-en">${esc(m.titleEn)}</p>` : ''}
      <dl>${[['시대', m.date], ['재질', m.materials], ['크기', m.dimensions], ['미술관 입수', m.acquired ? m.acquired + '년' : ''], ['소장품 번호', m.accession]].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${history.length ? `<section><h3>소장 이력 <small>미술관 원문</small></h3><ol class="m3d-history">${history.map(h => `<li>${esc(h)}</li>`).join('')}</ol></section>` : '<section><h3>소장 이력</h3><p class="m3d-none">미술관 자료에 소장 이력이 없습니다.</p></section>'}
      ${safe(m.source) ? `<a class="m3d-link" href="${esc(safe(m.source))}" target="_blank" rel="noopener noreferrer">미술관 원문 보기 ↗</a>` : ''}`;
  }

  list.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) show(+b.dataset.i); });
  list.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (current + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    show(next); list.querySelector(`[data-i="${next}"]`).focus();
  });
  list.querySelectorAll('img').forEach(img => img.onerror = () => img.remove());

  // 화면 가까이 오면 그때 3D 뷰어를 불러온다.
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { ready = true; io.disconnect(); show(current); }
  }, { rootMargin: '300px 0px' });
  io.observe(section);
  show(0);
  return section;
}
