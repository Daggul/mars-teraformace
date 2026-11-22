// Peer discovery, seat authentication and reconnection follow the Mezisvět table protocol.
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomBytes = length => crypto.getRandomValues(new Uint8Array(length));
const newCode = () => [...randomBytes(7)].map(n => alphabet[n % alphabet.length]).join('');
const token = () => [...randomBytes(20)].map(n => n.toString(16).padStart(2,'0')).join('');
const prefix = 'mars-tharsis-v1-';
export const cleanName = value => String(value || '').trim().replace(/\s+/g,' ').slice(0,28) || 'Velitel';
export const basicOptions = {corporateEra:false,prelude:false,venus:false,colonies:false,turmoil:false};
const colors = ['red','blue','green','yellow','black'];
export function roomCode(raw) {
  const v = String(raw || '').trim();
  if (/^(https?:|file:)/i.test(v)) { try { return roomCode(new URLSearchParams(new URL(v).hash.slice(1)).get('stul')); } catch { return ''; } }
  return v.replace(/[\s-]/g,'').toUpperCase();
}
export function store(storage, key, value) {
  try {
    if (value === undefined) return JSON.parse(storage.getItem(prefix+key) || 'null');
    if (value === null) storage.removeItem(prefix+key); else storage.setItem(prefix+key,JSON.stringify(value));
    return true;
  } catch { return null; }
}
export class Table {
  constructor({onView=()=>{},onStatus=()=>{},onError=()=>{},local=globalThis.localStorage,session=globalThis.sessionStorage,peerFactory=id=>new globalThis.Peer(id,{debug:0,secure:true}),rules=globalThis.MarsRules}={}) {
    Object.assign(this,{onView,onStatus,onError,local,session,peerFactory,rules});
    this.connections=new Map(); this.status=''; this.online=false; this.closed=false;
  }
  static saved(local,session) { return store(session,'active') || store(local,'last'); }
  setStatus(s) { this.status=s; this.onStatus(s); }
  save() {
    if (!this.mode) return;
    const meta={mode:this.mode,code:this.code,id:this.id,key:this.key,name:this.name};
    if (this.mode!=='guest') {
      const ok=store(this.local,'room-'+this.code,{state:this.state,keys:this.keys,game:this.game ? this.rules.save(this.game) : null});
      if(!ok && !this.saveWarned) {this.saveWarned=true;this.onError('Prohlížeč nemohl uložit partii. Nech tuto záložku otevřenou.');}
    }
    store(this.session,'active',meta); store(this.local,'last',meta);
  }
  openHost(name,{solo=false,beginner=false,options={}}={}) {
    this.name=cleanName(name); this.mode=solo?'solo':'host'; this.code=newCode(); this.id='p-'+token(); this.key=token(); this.keys={[this.id]:this.key};
    this.state={host:this.id,code:this.code,rev:0,phase:'lobby',players:[{id:this.id,name:this.name,color:colors[0],beginner:solo?false:beginner}],options:{...basicOptions,...options}};
    if(solo) {this.state.options.corporateEra=true; this.online=true; this.setStatus('Sólová mise'); this.start();}
    this.broadcast(); if(!solo) this.connectHost();
  }
  openGuest(name,value,beginner=false) {
    this.name=cleanName(name); this.code=roomCode(value); this.beginner=beginner;
    if(!/^[A-HJ-NP-Z2-9]{7}$/.test(this.code)) throw Error('Zadej sedmimístný kód nebo odkaz na stůl.');
    const seat=store(this.session,'seat-'+this.code) || store(this.local,'seat-'+this.code);
    this.mode='guest'; this.id=seat?.id || 'p-'+token(); this.key=seat?.key || token(); this.connectGuest();
  }
  restore(meta) {
    if(!meta) return false;
    Object.assign(this,meta);
    if(this.mode==='guest') {this.connectGuest();return true;}
    const saved=store(this.local,'room-'+this.code);
    if(!saved?.state || saved.keys?.[this.id]!==this.key) return false;
    this.state=saved.state;this.keys=saved.keys;this.game=saved.game?this.rules.restore(saved.game):null;
    if(this.mode==='solo'){this.online=true;this.setStatus('Sólová mise');}
    this.broadcast();if(this.mode==='host')this.connectHost();return true;
  }
  addGuest(id,name,beginner) {
    if(this.state.phase!=='lobby') throw Error('Tato partie už začala. Do rozehrané hry se mohou vrátit její hráči.');
    if(this.state.players.length>=5) throw Error('Stůl je plný. V jedné partii může hrát nejvýše pět hráčů.');
    const color=colors.find(c=>!this.state.players.some(p=>p.color===c));
    this.state.players.push({id,name:cleanName(name),color,beginner:!!beginner}); this.state.rev++;
  }
    setupPeer(host) {
      let peer;
      try { peer=this.peerFactory(host ? "mars-tharsis-v1-"+this.code : undefined); }
      catch { this.setStatus("Připojení není dostupné"); this.onError("Pro online stůl je potřeba prohlížeč s podporou WebRTC."); return null; }
      this.peer=peer;
      peer.on("error",e=>{
        if (this.closed || this.peer!==peer) return;
        if (!host && e.type === "peer-unavailable") {this.setStatus("Čekám na hostitele"); this.retryGuest(); return;}
        if (host && e.type === "unavailable-id") {
          this.setStatus("Kód je ještě připojený"); this.retryHost(); return;
        }
        if (e.type === "peer-unavailable" && host) return;
        this.setStatus("Obnovuji spojení…");
        if (host) this.retryHost(); else this.retryGuest();
      });
      return peer;
    }
    connectHost() {
      if (this.closed) return;
      this.setStatus("Připojuji stůl…");
      const peer=this.setupPeer(true); if (!peer) return;
      peer.on("open",()=>{ if (this.peer===peer && !this.closed) {this.online=true; this.setStatus("Stůl je online"); this.broadcast();} });
      peer.on("connection",c=>this.accept(c));
      peer.on("disconnected",()=>{if (this.peer!==peer || this.closed) return;this.online=false;this.setStatus("Obnovuji spojení…");this.retryHost();});
    }
    retryHost() {
      clearTimeout(this.hostTimer); this.hostTimer=setTimeout(()=>{
        if (this.closed) return;
        if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
          try {this.peer.reconnect(); this.retryHost();return;} catch { /* A new signaling connection is needed. */ }
        }
        if (this.online && !this.peer?.destroyed) return;
        this.destroyPeer(); this.connectHost();
      },3500);
    }
    connectGuest() {
      if (this.closed) return;
      this.setStatus("Hledám stůl "+this.code+"…");
      if (this.peer && !this.peer.destroyed && !this.peer.disconnected && this.peer.open) { this.dial(); return; }
      this.destroyPeer(); const peer=this.setupPeer(false); if (!peer) return;
      peer.on("open",()=>{if (this.peer===peer && !this.closed) this.dial();});
      peer.on("disconnected",()=>{if (this.peer===peer && !this.closed && !this.online) this.retryGuest();});
      this.retryGuest(14000);
    }
    dial() {
      if (this.closed || this.online) return;
      const c=this.peer.connect("mars-tharsis-v1-"+this.code,{reliable:true,serialization:"binary"});
      if (this.connection) { const stale=this.connection; this.connection=null; stale.close(); }
      this.connection=c;
      c.on("open",()=>{if(this.connection===c)c.send({type:"hello",version:1,id:this.id,key:this.key,name:this.name,beginner:this.beginner});});
      c.on("data",msg=>{
        if (this.closed || c!==this.connection || !msg) return;
        if (msg.type==="view" && msg.value?.id===this.id && msg.value.code===this.code) {
          clearTimeout(this.retryTimer); this.attempts=0; this.online=true; this.view=msg.value;
          store(this.session,"seat-"+this.code,{id:this.id,key:this.key}); store(this.local,"seat-"+this.code,{id:this.id,key:this.key});
          this.save(); this.setStatus("Připojeno"); this.onView(this.view);
        } else if (msg.type==="error") {
          if(msg.fatal){this.blocked=true;this.online=false;clearTimeout(this.retryTimer);this.setStatus("Připojení odmítnuto");}
          this.onError(msg.message);
        }
      });
      const lost=()=>{ if (this.closed || this.connection!==c || this.blocked) return; this.online=false; this.setStatus("Čekám na hostitele"); this.retryGuest(); };
      c.on("close",lost); c.on("error",lost); this.retryGuest(12000);
    }
    retryGuest(ms=2800) {
      clearTimeout(this.retryTimer); if (this.closed || this.blocked) return;
      this.retryTimer=setTimeout(()=>{ if(this.closed || this.online || this.blocked)return;
        this.attempts=(this.attempts||0)+1;
        if(this.attempts===3) this.onError("Stůl zatím neodpovídá. Zkontroluj kód a jestli má hostitel hru otevřenou. Zkouším to dál.");
        this.connectGuest();
      },ms);
    }
    accept(c) {
      let seat=null;
      const limit=setTimeout(()=>{if(!seat)c.close();},15000);
      const send=(msg)=>{if(c.open)c.send(msg);};
      c.on("data",msg=>{
        if(this.closed || !msg || typeof msg!=="object")return;
        try {
          if(!seat) {
            if(msg.type!=="hello" || msg.version!==1 || !/^p-[a-f0-9]{40}$/.test(msg.id) || !/^[a-f0-9]{40}$/.test(msg.key))throw Error("Hra vyžaduje stejnou verzi na všech zařízeních.");
            if(this.keys[msg.id]) {
              if(this.keys[msg.id]!==msg.key || msg.id===this.state.host) throw Error("Toto místo patří jinému hráči.");
            } else {
              this.addGuest(msg.id,msg.name,msg.beginner); this.keys[msg.id]=msg.key;
            }
            seat=msg.id; clearTimeout(limit); const old=this.connections.get(seat);
            this.connections.set(seat,c); if(old && old!==c)old.close(); this.broadcast(); return;
          }
          if(this.connections.get(seat)!==c)return;
          if(msg.type==="action")this.command(seat,msg.action);
        } catch(e) {send({type:"error",message:e.message,fatal:!seat}); if(seat)send({type:"view",value:this.snapshot(seat)}); if(!seat)setTimeout(()=>c.close(),120);}
      });
      const lost=()=>{clearTimeout(limit);if(seat && this.connections.get(seat)===c){this.connections.delete(seat);this.broadcast();}};
      c.on("close",lost); c.on("error",lost);
    }
  start() {
    if(this.mode!=='solo' && this.state.players.length<2) throw Error('Pro společnou partii se musí připojit alespoň dva hráči.');
    if(this.state.players.some(p=>p.id!==this.id && !this.connections.has(p.id))) throw Error('Některý hráč je odpojený. Počkej na jeho návrat nebo uvolni místo.');
    const seats=[...this.state.players];
    const first=randomBytes(1)[0]%seats.length;
    this.game=this.rules.create({players:[...seats.slice(first),...seats.slice(0,first)],options:this.state.options});
    this.state.phase='game'; this.state.rev++;
  }
  command(id,a) {
    if(!a || typeof a!=='object') throw Error('Neplatná volba.');
    if(a.rev!==this.state.rev) throw Error('Stůl se mezitím změnil. Zkontroluj volbu a potvrď ji znovu.');
    if(a.type==='answer' && this.game && this.state.phase==='game') {
      this.rules.choose(this.game,id,a.rows); this.state.rev++;
    } else if(this.state.phase==='lobby') {
      if(a.type==='beginner') {this.state.players.find(p=>p.id===id).beginner=!!a.value;this.state.rev++;}
      else if(id!==this.state.host) throw Error('Tuto volbu nastavuje hostitel.');
      else if(a.type==='start') this.start();
      else if(a.type==='options' && Object.hasOwn(basicOptions,a.option)) {this.state.options[a.option]=!!a.value;this.state.rev++;}
      else if(a.type==='remove' && a.target!==id && !this.connections.has(a.target) && this.keys[a.target]) {this.state.players=this.state.players.filter(p=>p.id!==a.target);delete this.keys[a.target];this.state.rev++;}
      else throw Error('Tato volba teď není k dispozici.');
    } else throw Error('Tato volba teď není k dispozici.');
    this.broadcast();
  }
  send(action) {
    const a={...action,rev:this.view?.rev};
    if(this.mode==='guest') {
      if(!this.online || !this.connection?.open) throw Error('Počkej na obnovení spojení s hostitelem.');
      this.connection.send({type:'action',action:a});
    } else this.command(this.id,a);
  }
  snapshot(id) {
    const players=this.state.players.map(p=>({...p,connected:p.id===this.state.host || this.connections.has(p.id)}));
    return {...this.state,id,players,game:this.game?this.rules.view(this.game,id):null};
  }
  broadcast() {
    if(this.closed || !this.state) return;
    this.save();this.view=this.snapshot(this.id); this.onView(this.view);
    for(const [id,conn] of this.connections) if(conn.open) conn.send({type:'view',value:this.snapshot(id)});
  }
  destroyPeer() {const p=this.peer;this.peer=null;if(p && !p.destroyed)p.destroy();}
  close() {this.closed=true;clearTimeout(this.retryTimer);clearTimeout(this.hostTimer);this.destroyPeer();store(this.session,'active',null);}
}
