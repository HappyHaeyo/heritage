// 클리블랜드미술관 3D 모델 20점에서 5페이지(3D 유물)에 필요한 항목만 뽑아 public/data/models-3d.json으로 저장한다.
import { readFileSync, writeFileSync } from 'node:fs';
const src = new URL('../../data/collected_2026-10-02/tables/models_3d.json', import.meta.url);
const raw = JSON.parse(readFileSync(src, 'utf8'));
const rows = Array.isArray(raw) ? raw : Object.values(raw)[0];
const out = rows.map(r => ({
  id: r.model_url.split('/').pop(),
  title: r.title_ko || r.title,
  titleEn: r.title,
  date: r.date_text,
  start: Number(r.date_start) || null,
  type: r.object_type,
  materials: r.materials,
  dimensions: r.dimensions,
  institution: r.institution,
  country: r.holding_country,
  accession: r.accession_number,
  acquired: (r.acquisition_date || '').slice(0, 4),
  credit: r.credit_line,
  provenance: r.provenance_text,
  description: r.description,
  image: r.image_url,
  source: r.source_url,
  model: r.model_url,
})).sort((a, b) => (a.start ?? 9999) - (b.start ?? 9999));
writeFileSync(new URL('../public/data/models-3d.json', import.meta.url), JSON.stringify({ collected: '2026-10-02', source: '클리블랜드미술관 오픈 액세스 · Sketchfab 3D 모델', items: out }, null, 1));
console.log(out.length, 'items', out.filter(o => o.image).length, 'with image');
