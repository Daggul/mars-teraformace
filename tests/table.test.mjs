import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {Table,roomCode} from '../src/room.mjs';
import {Decision} from '../src/decision.mjs';
import {art,card,cards} from '../src/ui.mjs';
import {mapHTML,scores} from '../src/board.mjs';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/mars-rules.js',import.meta.url),'utf8'));
const rules=globalThis.MarsRules;
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const wait=()=>new Promise(resolve=>setImmediate(resolve));
function localPeers(){const endpoints=new Map();let seq=0;
  class Channel extends EventEmitter{constructor(){super();this.open=true;}send(msg){if(this.open)queueMicrotask(()=>this.other.emit('data',structuredClone(msg)));}close(){if(!this.open)return;this.open=false;this.other.open=false;this.emit('close');this.other.emit('close');}}
  class Peer extends EventEmitter{constructor(id){super();this.id=id||'guest-'+(++seq);this.chans=[];this.open=true;endpoints.set(this.id,this);queueMicrotask(()=>this.emit('open'));}connect(id){const target=endpoints.get(id),a=new Channel(),b=new Channel();a.other=b;b.other=a;this.chans.push(a);target.chans.push(b);queueMicrotask(()=>{target.emit('connection',b);a.emit('open');b.emit('open');});return a;}destroy(){this.destroyed=true;endpoints.delete(this.id);for(const c of this.chans)c.close();}}
  return id=>new Peer(id);
}
test('All engine cards have Czech descriptions, unique IDs and local illustrations',()=>{
  assert.equal(cards.length,397);assert.equal(new Set(cards.map(c=>c.key)).size,397);const base=cards.filter(c=>['base','corporate'].includes(c.set)&&c.kind!=='corporation');assert.equal(base.length,208);assert.equal(base.filter(c=>c.set==='base').length,137);
  for(const meta of rules.cards()){const c=card(meta.name);assert.ok(c?.name&&c?.text,meta.name);assert.ok(fs.existsSync(new URL('../public/art/'+art(c)+'.webp',import.meta.url)),c.name);}
});
test('Seats synchronize, keep hands private, reject duplicate submissions and reconnect to the same seat',async t=>{
  const peerFactory=localPeers(),args=()=>({peerFactory,local:memory(),session:memory(),rules});const hostArgs=args(),guestArgs=args();const host=new Table(hostArgs),guest=new Table(guestArgs);let again;
  t.after(()=>{again?.close();guest.close();host.close();});host.openHost('Ada',{beginner:true});await wait();guest.openGuest('Borek',roomCode('https://example.test/#stul='+host.code),true);await wait();assert.equal(host.view.players.length,2);assert.equal(guest.view.players.length,2);
  host.send({type:'start'});await wait();assert.equal(host.view.game.cardsInHand.length,10);assert.equal(guest.view.game.cardsInHand.length,10);assert.equal(host.view.game.players.some(p=>'cardsInHand' in p),false);assert.equal(guest.view.game.players.some(p=>'dealtCorporationCards' in p),false);
  const now=guest.view.game.waitingFor?guest:host,old=now.view.rev;const d=new Decision(now.view.game);const options=d.root.options;const std=options.findIndex(o=>o.title==='Pay for a Standard Project');d.select('r',std);const aq=options[std].options.findIndex(o=>o.title.includes('Aquifer'));d.select('r.'+std,aq);now.send({type:'answer',rows:d.row()});await wait();
  const mapChoice=new Decision(now.view.game);assert.ok(mapChoice.space()?.allowed.length);const {path,allowed}=mapChoice.space();mapChoice.select(path,allowed[0]);now.send({type:'answer',rows:mapChoice.row()});await wait();assert.equal(guest.view.game.oceans,1);assert.equal(host.view.game.oceans,1);assert.throws(()=>host.command(now.id,{type:'answer',rev:old,rows:d.row()}),/změnil/);
  const meta=Table.saved(guest.local,guest.session);guest.close();await wait();assert.equal(host.view.players.find(p=>p.id===guest.id).connected,false);again=new Table(guestArgs);assert.ok(again.restore(meta));await wait();assert.equal(again.id,guest.id);assert.equal(again.view.game.oceans,1);assert.equal(again.view.players.length,2);
});
function step(d,path='r'){
  const n=d.at(path),v=d.view;
  if(n.inputType===0){n.options.forEach((_,i)=>step(d,path+'.'+i));return;}
  if(n.inputType===1){let choice=0;
    if(/Take action for action/.test(n.title)){
      const std=n.options.findIndex(o=>o.title==='Pay for a Standard Project');const pass=n.options.findIndex(o=>/Pass for this generation/.test(o.title));let found=false;
      if(std>=0){const s=n.options[std];const pick=s.options.findIndex(o=>(v.oceans<9&&/Aquifer/.test(o.title))||(v.oxygenLevel<14&&/Greenery/.test(o.title))||(v.temperature<8&&/Asteroid/.test(o.title)));if(pick>=0){d.select(path,std);d.select(path+'.'+std,pick);step(d,path+'.'+std+'.'+pick);found=true;}}
      if(found)return;
      const use=n.options.findIndex(o=>/Convert .*plants|Convert .*heat/i.test(o.title));choice=use>=0?use:pass>=0?pass:0;
    }else if(/final greenery/i.test(n.title)){choice=n.options.findIndex(o=>/do not|decline|pass|skip/i.test(o.title));if(choice<0)choice=0;}
    d.select(path,choice);step(d,path+'.'+choice);return;
  }
  if(n.inputType===3){for(const c of n.cards.slice(0,n.minCardsToSelect))d.select(path,c.name);return;}
  if(n.inputType===8){d.select(path,n.availableSpaces[0]);return;}
  if(n.inputType===7||n.inputType===9){d.select(path,n.players[0]);return;}
  if(n.inputType===5){d.select(path,n.cards[0].name);return;}
}
test('The visible choices support a complete two-player game, board placement and scoring',()=>{
  let session=rules.create({players:[{id:'a',name:'Alena',beginner:true},{id:'b',name:'Boris',beginner:true}],options:{corporateEra:false},seed:.41});let placed=0,actions=0;
  for(;actions<1800;actions++){
    const all=['a','b'].map(id=>rules.view(session,id));if(all[0].phase==='end')break;const v=all.find(p=>p.waitingFor);assert.ok(v,'Game must have an active choice');const d=new Decision(v);assert.ok(d.render());if(d.space()){placed++;assert.ok(mapHTML(v,d).includes('eligible'));}
    step(d);const rows=d.row();assert.ok(rows,d.root.title);rules.choose(session,v.id,rows);
    if(actions===11){const json=JSON.parse(JSON.stringify(rules.save(session)));const other=rules.restore(json);assert.deepEqual(rules.view(other,'a'),rules.view(session,'a'));session=other;}
  }
  const v=rules.view(session,'a');assert.equal(v.phase,'end');assert.equal(v.oceans,9);assert.equal(v.oxygenLevel,14);assert.equal(v.temperature,8);assert.ok(placed>=9);assert.match(scores(v),/Celkem/);
});
test('Solo and the four optional expansions initialize and restore all pending initial choices',()=>{
  for(const expanded of [false,true]){const args={players:[{id:'me',name:'Velitel'}],options:{corporateEra:true,prelude:expanded,venus:expanded,colonies:expanded,turmoil:expanded},seed:.2};const game=rules.create(args),v=rules.view(game,'me');assert.equal(v.terraformRating,14);assert.equal(v.spaces.filter(s=>s.color==='neutral').length,4);const d=new Decision(v);step(d);rules.choose(game,'me',d.row());const copied=rules.restore(rules.save(game));assert.deepEqual(rules.view(copied,'me'),rules.view(game,'me'));}
});
test('A player can pay with materials without losing unnecessary credits',()=>{
 const v={cardsInHand:[],megaCredits:12,steel:2,steelValue:2,heat:0,titanium:0,titaniumValue:3,waitingFor:{title:'Pay',inputType:4,amount:13,canUseSteel:true}};const d=new Decision(v);assert.deepEqual([d.payment('r').sum,d.payment('r').pay.megaCredits,d.payment('r').pay.steel],[13,11,1]);d.setPay('r','steel',2);assert.equal(d.payment('r').pay.megaCredits,9);assert.ok(d.row());
});
