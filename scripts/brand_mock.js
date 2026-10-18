/* 브랜드 화면 미리보기용 가짜 서버 (예시 주문) */
(function(){
  var now = Date.now(), O = [
    {id:"SK2610180003", at:new Date(now - 3 * 3600e3).toISOString(), canceled:false, ship:{name:"김민수", phone:"010-1234-5678", zip:"06236", addr1:"서울 강남구 테헤란로 123", addr2:"456호", memo:"문 앞에 놓아주세요"}, items:[{name:"퍼펙트 콜라드그린 진정 올인원", optName:"1개", q:1}], shipment:null},
    {id:"SK2610170011", at:new Date(now - 26 * 3600e3).toISOString(), canceled:false, ship:{name:"이준호", phone:"010-9876-5432", zip:"13529", addr1:"경기 성남시 분당구 판교로 1", addr2:"", memo:""}, items:[{name:"퍼펙트 콜라드그린 장벽 크림", optName:"2개", q:1}], shipment:null},
    {id:"SK2610170002", at:new Date(now - 30 * 3600e3).toISOString(), canceled:false, ship:{name:"박서준", phone:"010-5555-0000", zip:"04524", addr1:"서울 중구 세종대로 110", addr2:"", memo:""}, items:[{name:"퍼펙트 콜라드그린 올인원·장벽크림 세트", optName:"", q:1}], shipment:{carrier:"cj", tracking:"123456789012"}},
    {id:"SK2610160005", at:new Date(now - 50 * 3600e3).toISOString(), canceled:true, ship:{name:"최유진", phone:"010-2222-3333", zip:"03001", addr1:"서울 종로구 사직로 1", addr2:"", memo:""}, items:[{name:"퍼펙트 콜라드그린 진정 올인원", optName:"1개", q:1}], shipment:null}];
  function res(o, s){ return Promise.resolve(new Response(JSON.stringify(o), {status:s || 200, headers:{"content-type":"application/json"}})); }
  var ST = [{id:"minic-allinone", name:"퍼펙트 콜라드그린 진정 올인원", price:21500, soldOut:false, qty:3, manual:false}, {id:"minic-cream", name:"퍼펙트 콜라드그린 장벽 크림", price:21400, soldOut:false, qty:null, manual:false}],
    TK = [{id:"C1", orderId:"SK2610170011", type:"return", status:"open", escalated:false, customer:{name:"이준호", phone:"010-9876-5432"}, items:[{name:"퍼펙트 콜라드그린 장벽 크림", q:1}], messages:[{from:"customer", text:"사이즈가 안 맞아서 반품하고 싶어요.", at:new Date(now - 6 * 3600e3).toISOString()}]}];
  var real = window.fetch, LOGGED = false;
  function auth(u, bd){ var b = bd;
    if(u.indexOf("/api/partner/login") >= 0){ if(String(bd.code || "").replace(/[^A-Za-z0-9]/g, "").length >= 12){ LOGGED = true; return res({ok:true, brand:"MINIC"}); } return res({error:"코드가 맞지 않아요"}, 401); }
    if(u.indexOf("/api/partner/logout") >= 0){ LOGGED = false; return res({ok:true}); }
    if(!LOGGED) return res({error:"unauthorized"}, 401);
    if(u.indexOf("/api/partner/me") >= 0) return res({brand:"MINIC"});
    if(u.indexOf("/api/partner/home") >= 0){ var todo = O.filter(function(x){ return !x.canceled && !(x.shipment && x.shipment.tracking); }).length; return res({brand:"MINIC", counts:{todo:todo, done:O.length - todo - 1, canceled:1, doneToday:todo ? 0 : 3}, late:todo ? 1 : 0, oldestHours:todo ? 27 : 0, week:[["10-12",3],["10-13",5],["10-14",2],["10-15",7],["10-16",4],["10-17",6],["10-18",3]].map(function(x){ return {d:x[0], n:x[1]}; }), top:[{name:"퍼펙트 콜라드그린 진정 올인원", q:36},{name:"퍼펙트 콜라드그린 장벽 크림", q:21},{name:"퍼펙트 콜라드그린 올인원·장벽크림 세트", q:14}], month:{m:"2026-10", sales:702000, refund:21500, fee:102075, payout:578425, feeRate:15, n:71}, cs:{open:1, waitingReturn:1}, stock:{total:3, alerts:[{name:"퍼펙트 콜라드그린 진정 올인원", qty:3, soldOut:false}]}, history:[]}); }
    if(u.indexOf("/api/partner/stock") >= 0){ if(b.id){ ST.forEach(function(x){ if(x.id === b.id){ if("qty" in b){ x.qty = b.qty; x.soldOut = b.qty === 0; } if("soldOut" in b){ x.manual = b.soldOut; x.soldOut = b.soldOut; } } }); return res({ok:true}); } return res({products:ST}); }
    if(u.indexOf("/api/partner/cs/") >= 0){ TK.forEach(function(t){ if(t.id === b.id){ if(u.indexOf("reply") >= 0) t.messages.push({from:"partner", text:b.text, at:new Date().toISOString()}); if(u.indexOf("decide") >= 0) t.status = b.action === "approve" ? "approved" : "rejected"; if(u.indexOf("received") >= 0) t.status = "refunded"; } }); return res({ok:true}); }
    if(u.indexOf("/api/partner/cs") >= 0) return res({tickets:TK});
    if(u.indexOf("/api/partner/settlements") >= 0) return res({settlements:[{month:"2026-09", n:58, sales:640000, refund:0, feeRate:15, fee:96000, payout:544000, paidAt:new Date(now - 10 * 864e5).toISOString()}]});
    if(u.indexOf("/api/partner/ship-bulk") >= 0){ var d = 0, rs = (b.rows || []).map(function(r){ var o = O.filter(function(x){ return x.id === r.orderId; })[0]; if(!o) return {ok:false, error:"내 브랜드 주문이 아니에요"}; o.shipment = {carrier:r.carrier, tracking:r.tracking}; d++; return {ok:true}; }); return res({ok:true, done:d, results:rs}); }
    return null;
  }
  window.fetch = function(u, o){
    u = String(u); var b = {}; try{ b = JSON.parse((o && o.body) || "{}"); }catch(e){}
    var ax = u.indexOf("/api/partner/") >= 0 ? auth(u, b) : null; if(ax) return ax;
    if(u.indexOf("/api/partner/orders") >= 0) return res({brand:"MINIC", orders:O});
    if(u.indexOf("/api/partner/ship") >= 0){ if(!/^[0-9A-Za-z\-]{6,30}$/.test(String(b.tracking || "").trim())) return res({error:"송장번호를 확인해주세요"}, 400); O.forEach(function(x){ if(x.id === b.orderId) x.shipment = {carrier:b.carrier, tracking:String(b.tracking).trim()}; }); return res({ok:true}); }
    return real.apply(this, arguments);
  };
})();
