import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, '../data/collected_2026-10-02/tables/all_source_records.json');
const original = JSON.parse((await fs.readFile(from, 'utf8')).replace(/^\uFEFF/, ''));
const countries = [
  ['JP','일본','Japan',392,36,138], ['US','미국','United States',840,39,-98],
  ['GB','영국','United Kingdom',826,54,-2], ['DE','독일','Germany',276,51,10],
  ['CA','캐나다','Canada',124,56,-106], ['FR','프랑스','France',250,46,2],
  ['RU','러시아','Russia',643,60,90], ['NL','네덜란드','Netherlands',528,52,5],
  ['CN','중국','China',156,35,105]
].map(([code,name,en,iso,lat,lon]) => ({code,name,en,iso,lat,lon}));
const sources = {
  okchf:{name:'국외소재문화유산재단',url:'https://www.overseaschf.or.kr/archive/search/category.do'},
  nrich:{name:'국립문화유산연구원',url:'https://portal.nrich.go.kr/kor/overseasSearchList.do?menuIdx=840&webyn=Y'},
  cleveland:{name:'클리블랜드미술관',url:'https://openaccess-api.clevelandart.org/'},
  chicago:{name:'시카고미술관',url:'https://api.artic.edu/docs/'},
  va:{name:'빅토리아앤앨버트박물관',url:'https://developers.vam.ac.uk/guide/v2/welcome.html'},
  smithsonian:{name:'스미스소니언 국립아시아미술관',url:'https://github.com/Smithsonian/OpenAccess'},
  met_partial:{name:'메트로폴리탄미술관 · 일부 수집',url:'https://metmuseum.github.io/'}
};
const preferred = ['okchf:47070','okchf:18672','okchf:19359','okchf:21482','cleveland:98823','cleveland:153383','cleveland:154403','va:O22363'];
const output = path.join(root,'public/data'); await fs.mkdir(output,{recursive:true});
for (const c of countries) {
  const rows = original.filter(r=>r.holding_country===c.name).map(r=>({
    id:r.source+':'+r.source_id,source:r.source,title:r.title_ko||r.title,originalTitle:r.title,
    country:c.code,institution:r.institution,date:r.date_text,type:r.object_type,
    materials:r.materials,dimensions:r.dimensions,accession:r.accession_number,
    acquisition:r.acquisition_date,credit:r.credit_line,provenance:r.provenance_text,
    history:r.object_history_text,description:r.description,image:r.image_url,
    imageRights:r.image_rights,model:r.model_url,url:r.source_url,review:r.review_required
  }));
  const score=r=>(preferred.includes(r.id)?1000-preferred.indexOf(r.id):0)+(r.image?100:0)+(r.description?30:0)+(r.provenance?15:0)+(r.model?5:0)+(r.type==='전적'?0:2);
  rows.sort((a,b)=>score(b)-score(a)||a.title.localeCompare(b.title,'ko'));
  c.count=rows.length;c.images=rows.filter(r=>r.image).length;c.institutions=new Set(rows.map(r=>r.institution)).size;
  await fs.writeFile(path.join(output,c.code+'.json'),JSON.stringify(rows));
}
let cases=JSON.parse((await fs.readFile(path.join(root,'../data/documented_removals_2026-10-02/cases.json'),'utf8')).replace(/^\uFEFF/,''));
cases=cases.map(c=>({...c,country:countries.find(x=>x.name===c.removal_country)?.code,state:c.id==='oegyujanggak'?'loan':c.id==='yeonjisa_bell'?'abroad':'returned'}));
await fs.writeFile(path.join(output,'cases.json'),JSON.stringify(cases));
const manifest={date:'2026-10-02',total:original.length,countries,sources,modelLinks:original.filter(r=>r.model_url).length,note:'출처별 수집 레코드. 출처 사이 동일 유물이 중복될 수 있으며 국가별 전체 보유량이 아닙니다.'};
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest));
const worldFile=path.join(output,'world.json');
try{await fs.access(worldFile)}catch{
 const res=await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json');if(!res.ok)throw Error('World map HTTP '+res.status);await fs.writeFile(worldFile,await res.text());
}
console.log(`Prepared ${original.length} records / ${countries.length} countries / ${cases.length} cases. Raw files unchanged.`);
