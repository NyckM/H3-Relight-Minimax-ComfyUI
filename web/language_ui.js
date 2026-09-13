import { HELP } from './bilingual_help.js';
export function languageUI(root, kind, getLanguage, setLanguage) {
  const box = document.createElement('div'); box.dataset.bilingual = 'true';
  box.style.cssText = 'width:100%;padding:8px 0;font:12px system-ui;color:#ded8ec';
  const label = document.createElement('label'); label.textContent = 'Idioma / Language: ';
  const select = document.createElement('select');
  select.style.cssText = 'background:#25212e;color:#fff;border:1px solid #665778;border-radius:5px;padding:4px';
  for (const [value,text] of [['pt','Português'],['en','English']]) { const option = document.createElement('option'); option.value=value; option.textContent=text; select.append(option); }
  select.value=getLanguage(); select.onchange=()=>setLanguage(select.value); label.append(select); box.append(label);
  const help = document.createElement('details'); help.style.cssText='margin-top:7px;max-height:220px;overflow:auto;user-select:text';
  const title = document.createElement('summary'); title.textContent='ⓘ Funções — explicações PT / EN · Function guide'; title.style.cursor='pointer'; help.append(title);
  for (const [name,pt,en] of HELP[kind]) {
    const section=document.createElement('div'); section.style.cssText='border-top:1px solid #443c51;padding:8px 3px;line-height:1.45';
    const strong=document.createElement('strong'); strong.textContent=name;
    const p=document.createElement('div'); p.lang='pt-BR'; p.textContent='PT: '+pt;
    const e=document.createElement('div'); e.lang='en'; e.textContent='EN: '+en; e.style.color='#aea5bf'; section.append(strong,p,e); help.append(section);
  }
  box.append(help); root.prepend(box);
  return { sync:()=>{select.value=getLanguage();} };
}
