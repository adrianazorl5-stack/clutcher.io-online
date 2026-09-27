const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const WebSocket=require('ws');

const PORT=Number(process.env.PORT||8080);
const DATA=path.join(__dirname,'data');
const DB=path.join(DATA,'accounts.json');
fs.mkdirSync(DATA,{recursive:true});
if(!fs.existsSync(DB))fs.writeFileSync(DB,'{}');

const accounts=JSON.parse(fs.readFileSync(DB,'utf8')||'{}');
const tokens=new Map();
const clients=new Map();
const rooms=new Map();
const hash=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const newToken=()=>crypto.randomBytes(24).toString('hex');
const json=(res,code,obj)=>{const b=Buffer.from(JSON.stringify(obj));res.writeHead(code,{'Content-Type':'application/json','Content-Length':b.length,'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type'});res.end(b)};

const server=http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,GET,OPTIONS'});return res.end()}
  if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true,users:Object.keys(accounts).length,rooms:rooms.size});
  if(req.method==='POST'&&(req.url==='/api/register'||req.url==='/api/login')){
    let b='';req.on('data',c=>b+=c);req.on('end',()=>{
      try{
        const x=JSON.parse(b||'{}');
        const u=String(x.username||'').trim().toLowerCase();
        const p=String(x.password||'');
        if(!/^[a-z0-9_ -]{3,24}$/i.test(u))return json(res,400,{ok:false,error:'Usuario inválido.'});
        if(p.length<4)return json(res,400,{ok:false,error:'La contraseña debe tener al menos 4 caracteres.'});
        if(req.url==='/api/register'){
          if(accounts[u])return json(res,409,{ok:false,error:'Ese usuario ya existe.'});
          accounts[u]={username:u,pass:hash(p),created:Date.now()};
          fs.writeFileSync(DB,JSON.stringify(accounts,null,2));
        }else if(!accounts[u]||accounts[u].pass!==hash(p))return json(res,401,{ok:false,error:'Usuario o contraseña incorrectos.'});
        const t=newToken();tokens.set(t,u);return json(res,200,{ok:true,token:t,username:accounts[u].username});
      }catch(e){return json(res,400,{ok:false,error:'Solicitud inválida.'})}
    });return;
  }
  return json(res,404,{ok:false,error:'Not found'});
});

const wss=new WebSocket.Server({server});
function send(ws,o){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(o))}
function broadcast(r,o){for(const p of r.players)send(p.ws,o)}
function roomList(){return [...rooms.values()].map(r=>({id:r.id,name:r.name,mode:r.mode,map:r.map,maxPlayers:r.maxPlayers,players:r.players.length,locked:!!r.password,started:r.started}))}
function publicRoom(r,forUser){return {id:r.id,name:r.name,mode:r.mode,map:r.map,maxPlayers:r.maxPlayers,host:r.host===forUser,hostUser:r.host,started:r.started,players:r.players.map((p,i)=>({username:p.username,host:p.username===r.host,team:i%2===0?'CT':'T'}))}}
function auth(ws,t){const u=tokens.get(t);if(!u)return false;ws.user=u;clients.set(u,ws);return true}
function currentRoom(ws){for(const r of rooms.values())if(r.players.some(p=>p.ws===ws))return r;return null}
function leave(ws){const r=currentRoom(ws);if(!r)return;r.players=r.players.filter(p=>p.ws!==ws);if(r.host===ws.user)r.host=r.players[0]?.username||null;if(!r.players.length)rooms.delete(r.id);else{for(const p of r.players)send(p.ws,{type:'room-state',room:publicRoom(r,p.username)})}}

wss.on('connection',ws=>{
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    if(m.type==='auth'){
      if(!auth(ws,m.token))return send(ws,{type:'error',error:'Sesión no válida'});
      send(ws,{type:'rooms',rooms:roomList()});return;
    }
    if(!ws.user)return send(ws,{type:'error',error:'Debes iniciar sesión'});
    if(m.type==='list-rooms')return send(ws,{type:'rooms',rooms:roomList()});

    if(m.type==='create-room'){
      const name=String(m.name||'').trim();
      if(name.length<2)return send(ws,{type:'error',error:'Nombre de sala demasiado corto'});
      const mode=String(m.mode||'deathmatch').toLowerCase()==='defusal'?'defusal':'deathmatch';
      const map=['oasis','dusker'].includes(String(m.map||''))?String(m.map):'oasis';
      const r={id:crypto.randomBytes(4).toString('hex'),name,password:String(m.password||''),mode,map,maxPlayers:Math.max(2,Math.min(16,Number(m.maxPlayers)||8)),players:[{username:ws.user,ws}],host:ws.user,started:false};
      rooms.set(r.id,r);return send(ws,{type:'joined',room:publicRoom(r,ws.user)});
    }

    if(m.type==='join-room'){
      const r=rooms.get(m.roomId);
      if(!r)return send(ws,{type:'error',error:'La sala ya no existe'});
      if(r.started)return send(ws,{type:'error',error:'La partida ya ha empezado'});
      if(r.players.length>=r.maxPlayers)return send(ws,{type:'error',error:'Sala llena'});
      if(r.password!==String(m.password||''))return send(ws,{type:'error',error:'Contraseña incorrecta'});
      if(r.players.some(p=>p.username===ws.user))return send(ws,{type:'error',error:'Ya estás dentro'});
      r.players.push({username:ws.user,ws});
      for(const p of r.players)send(p.ws,{type:'room-state',room:publicRoom(r,p.username)});
      return;
    }

    if(m.type==='leave-room'){
      leave(ws);return send(ws,{type:'rooms',rooms:roomList()});
    }

    if(m.type==='start-room'){
      const r=currentRoom(ws);
      if(!r||r.host!==ws.user)return send(ws,{type:'error',error:'Solo el host puede iniciar'});
      r.started=true;
      for(const p of r.players)send(p.ws,{type:'room-state',room:publicRoom(r,p.username)});
      return;
    }

    if(m.type==='game-event'){
      const r=currentRoom(ws);if(!r||!r.started)return;
      const event=m.event&&typeof m.event==='object'?m.event:null;if(!event)return;
      // Relay only the small real-time messages used by the game integration.
      if(!['state','shot','hit','death'].includes(event.type))return;
      for(const p of r.players)if(p.ws!==ws)send(p.ws,{type:'game-event',from:ws.user,event});
    }
  });
  ws.on('close',()=>{leave(ws);if(ws.user&&clients.get(ws.user)===ws)clients.delete(ws.user)});
});

server.listen(PORT,'0.0.0.0',()=>console.log(`Clutcher Online Server escuchando en 0.0.0.0:${PORT}`));
