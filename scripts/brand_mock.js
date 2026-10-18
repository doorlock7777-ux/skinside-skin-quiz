/* 브랜드 화면 미리보기용 가짜 서버 (예시 주문) */
(function(){
  var now = Date.now(), O = [
    {id:"SK2610180003", at:new Date(now - 3 * 3600e3).toISOString(), canceled:false, ship:{name:"김민수", phone:"010-1234-5678", zip:"06236", addr1:"서울 강남구 테헤란로 123", addr2:"456호", memo:"문 앞에 놓아주세요"}, items:[{name:"퍼펙트 콜라드그린 진정 올인원", optName:"1개", q:1}], shipment:null},
    {id:"SK2610170011", at:new Date(now - 26 * 3600e3).toISOString(), canceled:false, ship:{name:"이준호", phone:"010-9876-5432", zip:"13529", addr1:"경기 성남시 분당구 판교로 1", addr2:"", memo:""}, items:[{name:"퍼펙트 콜라드그린 장벽 크림", optName:"2개", q:1}], shipment:null},
    {id:"SK2610170002", at:new Date(now - 30 * 3600e3).toISOString(), canceled:false, ship:{name:"박서준", phone:"010-5555-0000", zip:"04524", addr1:"서울 중구 세종대로 110", addr2:"", memo:""}, items:[{name:"퍼펙트 콜라드그린 올인원·장벽크림 세트", optName:"", q:1}], shipment:{carrier:"cj", tracking:"123456789012"}},
    {id:"SK2610160005", at:new Date(now - 50 * 3600e3).toISOString(), canceled:true, ship:{name:"최유진", phone:"010-2222-3333", zip:"03001", addr1:"서울 종로구 사직로 1", addr2:"", memo:""}, items:[{name:"퍼펙트 콜라드그린 진정 올인원", optName:"1개", q:1}], shipment:null}];
  function res(o, s){ return Promise.resolve(new Response(JSON.stringify(o), {status:s || 200, headers:{"content-type":"application/json"}})); }
  var real = window.fetch;
  window.fetch = function(u, o){
    u = String(u); var b = {}; try{ b = JSON.parse((o && o.body) || "{}"); }catch(e){}
    if(u.indexOf("/api/brand/orders") >= 0) return res({brand:"MINIC", orders:O});
    if(u.indexOf("/api/brand/ship") >= 0){ if(!/^[0-9A-Za-z\-]{6,30}$/.test(String(b.tracking || "").trim())) return res({error:"송장번호를 확인해주세요"}, 400); O.forEach(function(x){ if(x.id === b.orderId) x.shipment = {carrier:b.carrier, tracking:String(b.tracking).trim()}; }); return res({ok:true}); }
    return real.apply(this, arguments);
  };
  try{ sessionStorage.setItem("brd", "demo"); }catch(e){}
})();
