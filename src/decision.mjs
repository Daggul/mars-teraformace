import {art,asset,card,cardName,esc,ico} from './ui.mjs';
import {translatePrompt} from './i18n.mjs';
export const tr = text => translatePrompt(String(text||'').trim(),cardName);
const projectCost=(v,item)=>v.cardsInHand.find(c=>c.name===item?.name)?.calculatedCost ?? item?.calculatedCost ?? card(item?.name)?.cost ?? 0;
const actionIcon = title => /project card|cards to|patents/i.test(title)?'cards':/standard project/i.test(title)?'building':/award|milestone/i.test(title)?'trophy':/end turn|pass/i.test(title)?'flag':/plant|greenery/i.test(title)?'leaf':/heat|temperature/i.test(title)?'temp':/ocean|aquifer/i.test(title)?'water':/delegate|party/i.test(title)?'users':/city/i.test(title)?'city':/action/i.test(title)?'bolt':'hex';
const creditNames={megaCredits:'Megakredity',steel:'Ocel',titanium:'Titan',heat:'Teplo',microbes:'Mikrobi',floaters:'Levitující plošiny'};
const creditIcons={megaCredits:'coin',steel:'steel',titanium:'ore',heat:'heat',microbes:'microbe',floaters:'orbit'};
function paymentEntries(v,node,chosen) {
  const c=card(chosen?.name); const tags=c?.tags||[];
  const entries=[['megaCredits',v.megaCredits,1]];
  if(node.canUseSteel || (chosen && tags.includes('building'))) entries.push(['steel',v.steel,v.steelValue]);
  if(node.canUseTitanium || (chosen && tags.includes('space'))) entries.push(['titanium',v.titanium,v.titaniumValue]);
  if(node.canUseHeat) entries.push(['heat',v.heat,1]);
  if(node.microbes && tags.includes('plant')) entries.push(['microbes',node.microbes,2]);
  if(node.floaters && tags.includes('venus')) entries.push(['floaters',node.floaters,3]);
  return entries.filter(([key,have])=>key==='megaCredits' || have>0);
}
const zeroPay=()=>({megaCredits:0,steel:0,titanium:0,heat:0,microbes:0,floaters:0});
function defaultPay(entries,cost) {
  const pay=zeroPay();let left=cost;
  for(const [key,have,rate] of entries){const use=Math.min(have,Math.ceil(left/rate));pay[key]=use;left=Math.max(0,left-use*rate);}
  const other=entries.reduce((total,[key,,rate])=>total+(key==='megaCredits'?0:pay[key]*rate),0);
  pay.megaCredits=Math.max(0,Math.min(pay.megaCredits,cost-other));
  return pay;
}
export class Decision {
  constructor(v){this.view=v;this.root=v.waitingFor;this.values=new Map();this.step=0;this.pending=false;this.signature=JSON.stringify(this.root);}
  get steps(){const opts=this.root?.inputType===0?this.root.options:[];return opts.map((_,i)=>i).sort((a,b)=>Number(opts[a].title==='Select how to pay for cards')-Number(opts[b].title==='Select how to pay for cards'));}
  state(path){if(!this.values.has(path))this.values.set(path,{});return this.values.get(path);}
  at(path){return path.split('.').slice(1).reduce((n,i)=>n?.options?.[Number(i)],this.root);}
  active(path='r'){
    const n=this.at(path); if(!n)return null;
    if(n.inputType===0) return this.active(path+'.'+this.steps[this.step]);
    if(n.inputType===1 && this.state(path).choice!=null) return this.active(path+'.'+this.state(path).choice);
    return {node:n,path};
  }
  select(path,value) {
    const n=this.at(path),s=this.state(path);
    if(!n) return;
    if(n.inputType===1){s.choice=Number(value);return;}
    if(n.inputType===3){const chosen=s.cards??[];if(chosen.includes(value)){s.cards=chosen.filter(x=>x!==value);return;}
      if(n.maxCardsToSelect===1)s.cards=[value];else if(chosen.length<n.maxCardsToSelect)s.cards=[...chosen,value];else throw Error(`Můžeš vybrat nejvýše ${n.maxCardsToSelect} karet.`);return;}
    if(n.inputType===5){s.card=value;delete s.pay;return;}
    s.value=value;
  }
  back(path){const self=this.state(path);if(this.at(path)?.inputType===5 && self.card){delete self.card;delete self.pay;return;}
    const parts=path.split('.');while(parts.length>1){parts.pop();const ancestor=parts.join('.');if(this.at(ancestor)?.inputType===1){delete this.state(ancestor).choice;return;}}}
  payment(path){const node=this.at(path),s=this.state(path),selected=node.inputType===5?node.cards.find(c=>c.name===s.card):null;
    const buy=this.root?.options?.findIndex(o=>o.title==='Select which cards to take into hand');
    const amount=node.title==='Select how to pay for cards' && buy>=0?(this.state('r.'+buy).cards?.length||0)*this.view.cardCost:selected?projectCost(this.view,selected):Number(node.amount||0),entries=paymentEntries(this.view,node,selected);
    if(!s.pay || s.price!==amount){s.pay=defaultPay(entries,amount);s.price=amount;}const sum=entries.reduce((t,[key,,rate])=>t+s.pay[key]*rate,0);
    return {entries,amount,pay:s.pay,sum};}
  setPay(path,resource,value){const p=this.payment(path);const entry=p.entries.find(e=>e[0]===resource);if(!entry)return;
    p.pay[resource]=Math.max(0,Math.min(entry[1],Math.floor(Number(value)||0)));
    if(resource!=='megaCredits'){const fromOthers=p.entries.reduce((sum,[key,,rate])=>sum+(key==='megaCredits'?0:p.pay[key]*rate),0);p.pay.megaCredits=Math.max(0,Math.min(this.view.megaCredits,p.amount-fromOthers));}}
  row(path='r'){
    const n=this.at(path),s=this.state(path);if(!n)return null;
    switch(n.inputType){
      case 0:{const rows=n.options.map((_,i)=>this.row(path+'.'+i));return rows.every(x=>x && x.length===1)?rows.map(r=>r[0]):null;}
      case 1:{if(s.choice==null)return null;const child=this.row(path+'.'+s.choice);return child?.length===1?[[String(s.choice),...child[0]]]:null;}
      case 2:return [[String(s.value??0)]];
      case 3:{const a=s.cards||[];return a.length>=(n.minCardsToSelect??0) && a.length<=(n.maxCardsToSelect??n.cards.length)?[[...a]]:null;}
      case 4:case 5:{if(n.inputType===5 && !s.card)return null;const p=this.payment(path);if(p.sum<p.amount)return null;return [[...(s.card?[s.card]:[]),JSON.stringify(p.pay)]];}
      case 6:return [[]];
      case 7:case 8:case 9:case 10:return s.value==null?null:[[String(s.value)]];
      default:return null;
    }
  }
  space(){const a=this.active();return a?.node.inputType===8?{path:a.path,allowed:a.node.availableSpaces,selected:this.state(a.path).value}:null;}
  playableProjects() {
    const projects = new Map();
    function visit(node, path) {
      if (node.inputType === 5) {
        for (const item of node.cards) projects.set(item.name, path);
      } else if (node.inputType === 1) {
        node.options.forEach((child, i) => visit(child, path + '.' + i));
      }
    }
    if (this.root && !this.pending) visit(this.root, 'r');
    return projects;
  }
  quickCard(name) {
    const path = this.playableProjects().get(name);
    if (!path) return false;
    let parent = 'r';
    for (const index of path.split('.').slice(1)) {
      this.select(parent, index);
      parent += '.' + index;
    }
    this.select(path, name);
    return true;
  }
  initialProjects() {
    if (this.root.inputType !== 0) return null;
    const slot = this.root.options.findIndex(n => n.title === 'Select initial cards to buy');
    if (slot < 0) return null;
    const names = this.state('r.' + slot).cards || [];
    return this.root.options[slot].cards.filter(item => names.includes(item.name));
  }
  selectedCorp(){if(this.root?.inputType!==0)return null;const i=this.root.options.findIndex(o=>/corporation/i.test(o.title));return i>=0?card(this.state('r.'+i).cards?.[0]):null;}
  renderPayment(path) {
    const {entries,amount,pay,sum} = this.payment(path);
    return `<div class="payment"><div class="row"><strong>Platba</strong><b class="money">${amount} M€</b></div>
      ${entries.map(([key,have,rate]) => `<div class="payline">${ico(creditIcons[key])}<span>${creditNames[key]}<small>V zásobě ${have}${rate>1?' · '+rate+' M€/ks':''}</small></span>
        <div class="pay-stepper">
          <button data-do="adjust-pay" data-resource="${key}" data-value="-1" data-path="${path}" aria-label="Odebrat jednotku · ${creditNames[key]}" ${pay[key]<=0?'disabled':''}>−</button>
          <input type="number" inputmode="numeric" min="0" max="${have}" step="1" value="${pay[key]}" aria-label="${creditNames[key]} na platbu" data-pay="${key}" data-path="${path}">
          <button data-do="adjust-pay" data-resource="${key}" data-value="1" data-path="${path}" aria-label="Přidat jednotku · ${creditNames[key]}" ${pay[key]>=have?'disabled':''}>+</button>
        </div></div>`).join('')}
      <div class="pay-total"><span>Celkem</span><b>${sum} / ${amount} M€</b></div></div>`;
  }
  renderCards(path,n,s){const chosen=s.cards||[];return `<div class="picks">${n.cards.map(item=>{const c=card(item.name);if(!c)return '';const on=chosen.includes(item.name) || s.card===item.name;return `<div class="pickrow${on?' chosen':''}"><button class="pick" data-do="choose" data-path="${path}" data-value="${esc(item.name)}" aria-pressed="${on}"><img src="${asset('art/'+art(c)+'.webp')}" alt="" loading="lazy"><span><b>${esc(c.name)}</b><small>${c.kind==='corporation'?'Počáteční kapitál '+c.credits+' M€':c.kind==='prelude'?'Karta předehry':'Zahrání '+(n.inputType===5?projectCost(this.view,item):c.cost)+' M€'}</small></span><i class="pickcheck">${on?ico('check'):''}</i></button><button class="peek" data-do="detail" data-card="${esc(c.id)}" title="Účinek karty" aria-label="Účinek karty ${esc(c.name)}">${ico('info')}</button></div>`;}).join('')}</div>`;}
  renderNode(path){const n=this.at(path),s=this.state(path);let html='';
    if(n.inputType===1){html=`<div class="action-list">${n.options.map((o,i)=>`<button data-do="choose" data-path="${path}" data-value="${i}"><i>${ico(actionIcon(o.title))}</i><span>${esc(tr(o.title))}</span>${ico('chevron')}</button>`).join('')}</div>`;}
    if(n.inputType===2)html=`<label class="form-label">Počet (0–${n.max})<input type="number" min="0" max="${n.max}" value="${esc(s.value??0)}" data-amount="${path}"></label>`;
    if(n.inputType===3){const lo=n.minCardsToSelect??0,hi=n.maxCardsToSelect??n.cards.length;const corp=this.selectedCorp();const price=corp?.key==='Polyphemos'?5:corp?.key==='Terralabs Research'?1:(this.view.cardCost??3);const purchase=/to buy|which cards to take into hand|to research|card.?s? to buy/i.test(n.title);const budget=this.selectedCorp()?.credits??this.view.megaCredits;
      html=`<p class="guide">${lo===hi?'Vyber přesně '+lo+'.':'Můžeš vybrat '+lo+' až '+hi+' karet.'}${purchase?' Každá stojí '+price+' M€.':''}</p>${this.renderCards(path,n,s)}<div class="pick-total"><b>Vybráno ${(s.cards||[]).length}</b>${purchase?`<span>Nákup ${(s.cards||[]).length*price} M€ · kapitál ${budget} M€</span>`:''}</div>`;}
    if(n.inputType===4)html=this.renderPayment(path);
    if(n.inputType===5){if(s.card){const c=card(s.card);html=`<div class="selected-preview"><img src="${asset('art/'+art(c)+'.webp')}" alt=""><strong>${esc(c.name)}</strong><p>${esc(c.text)}</p></div>${this.renderPayment(path)}`;}else html=this.renderCards(path,n,s);}
    if(n.inputType===6 && /pass for this generation/i.test(n.title))html='<p class="guide">V této generaci už další akci neprovedeš. Až pasují všichni, proběhne produkce.</p>';
    if(n.inputType===7||n.inputType===9||n.inputType===10){const values=n.players||n.parties||[];html=`<div class="action-list">${values.map(id=>`<button class="${s.value===id?'selected':''}" data-do="choose" data-path="${path}" data-value="${esc(id)}">${ico('user')}<span>${esc(this.view.players.find(p=>p.id===id)?.name || (id==='NEUTRAL'?'Neutrální delegát':tr(id)))}</span></button>`).join('')}</div>`;}
    if(n.inputType===8)html=`<p class="guide">Vyber zvýrazněné pole na mapě Tharsis.</p><label class="form-label">Pole<select data-space-select="${path}"><option value="">Vyber pole</option>${n.availableSpaces.map(id=>`<option value="${esc(id)}" ${s.value===id?'selected':''}>${esc(id)}${this.view.spaces.find(x=>x.id===id)?.spaceType==='colony'?' · oběžná dráha':''}</option>`).join('')}</select></label>`;
    return html;
  }
  render(){if(!this.root)return '';const a=this.active();if(!a)return '';const {path,node}=a;
    const steps=this.root.inputType===0?this.root.options:null, setup=steps?.some(s=>/corporation/i.test(s.title));const leafReady=!!this.row(path);const next=steps && this.step<steps.length-1;
    const back=(path.split('.').length>(steps?2:1)) || (node.inputType===5 && this.state(path).card);
    const title=setup?'Příprava korporace':(this.root.inputType===1 && path==='r'?'Tvoje akce':'Tvoje volba');
    const heading=(path==='r' && node.inputType===1)?'Vyber, co provedeš.':tr(node.title)||'Potvrď volbu';
    return `<div class="turn-scroll"><div class="turn-head"><span class="overline orange"><span class="line"></span>Na řadě</span><h2>${title}</h2></div>${steps?`<div class="step-tabs">${this.steps.map((slot,i)=>`<button data-do="step" data-value="${i}" aria-label="Krok ${i+1} · ${esc(tr(steps[slot].title))}" aria-current="${i===this.step?'step':'false'}" class="${i===this.step?'active':''}" title="${esc(tr(steps[slot].title))}">${this.row('r.'+slot)&&i!==this.step?ico('check'):i+1}</button>`).join('')}</div>`:''}<h3 class="choice-title">${esc(heading)}</h3>${this.renderNode(path)}</div><div class="turn-foot">${back?`<button class="btn subtle" data-do="choice-back" data-path="${path}">Zpět</button>`:''}${node.inputType!==1 && (node.inputType!==5 || this.state(path).card)?`<button class="btn primary" data-do="${next?'next-step':'submit'}" ${(!leafReady||(!next&&!this.row())||this.pending)?'disabled':''}>${this.pending?'Odesílám…':next?'Další krok':/pass for this generation/i.test(node.title)?'Pasovat':node.inputType===5?'Zaplatit a zahrát':'Potvrdit volbu'}</button>`:''}</div>`;
  }
}
