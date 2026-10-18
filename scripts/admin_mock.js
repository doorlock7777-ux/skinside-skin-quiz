/* 관리자 미리보기용 가짜 서버 (예시 데이터) */
(function(){
  var CATS = window.__CATS || {}, extra = [], kakao = {friends:8144, name:"문장군", updated:null};
  var TOP = [["엔젤 탄산 효소 세안제","본코리아",412,1380],["퍼펙트 콜라드그린 진정 올인원","MINIC",338,1190],["엔젤 비타민 앰플","본코리아",301,1024],["마데카소사이드 수분 선세럼","MEDIHEAL",244,880],["챕터3 율무 진정 앰플","LIVNA",207,760],["포어 올킬 원스텝 코팩","GRAFEN",181,702],["시티로버 레티놀 스킨부스터 세럼","본코리아",156,615],["원스탭 매트 왁스","GRAFEN",133,540],["시카 진정 시트팩","TORRIDEN",118,480],["선포켓 오일컷 스틱","GRAFEN",97,402]];
  var TYPES = {"ORNT":412,"CRNT-O":388,"OSNT":301,"CRNT-D":260,"DRNT":244,"OSPT":190,"CSNT":176,"ORPT":150,"DSNT":132,"ORNW":121,"CRPT":108,"OSPW":96,"DRNW":80,"CSNW":61,"DSPT":44,"DSPW":23};
  function res(o, s){ return Promise.resolve(new Response(JSON.stringify(o), {status:s || 200, headers:{"content-type":"application/json"}})); }
  var real = window.fetch;
  window.fetch = function(u, o){
    u = String(u); var b = {}; try{ b = JSON.parse((o && o.body) || "{}"); }catch(e){}
    var auth = o && o.headers && (o.headers.authorization || o.headers.Authorization);
    if(u.indexOf("script.google.com") >= 0){ var t = 0; for(var k in TYPES) t += TYPES[k]; return res({total:t, types:TYPES}); }
    if(u.indexOf("/data/products.json") >= 0) return res({categories:CATS});
    if(u.indexOf("/api/manage/") < 0) return real.apply(this, arguments);
    if(auth !== "Bearer demo") return res({error:"unauthorized"}, 401);
    if(u.indexOf("/api/manage/dashboard") >= 0){ var d = +(u.split("days=")[1] || 7), f = d === 1 ? 0.16 : d === 30 ? 3.6 : 1; return res({days:d, top:TOP.map(function(x, i){ return {id:"p" + i, name:x[0], brand:x[1], clicks:Math.round(x[2] * f), views:Math.round(x[3] * f)}; }), events:{quiz_start:Math.round(1520 * f), quiz_done:Math.round(1204 * f), kakao_click:Math.round(980 * f), kakao_unlock:Math.round(871 * f)}, kakao:kakao}); }
    if(u.indexOf("/api/manage/kakao") >= 0){ kakao = {friends:Math.round(+b.friends || 0), name:b.name || "문장군", updated:new Date().toISOString()}; return res({ok:true, kakao:kakao}); }
    if(u.indexOf("/api/manage/brand-mail") >= 0) return res({results:[{brand:"minic", name:"MINIC", email:"order@minic.example", orders:1, cancels:0, sent:false}, {brand:"grafen", name:"GRAFEN", email:"", orders:1, cancels:0, sent:false}, {brand:"bonkorea", name:"본코리아", email:"cs@bonkorea.example", orders:0, cancels:1, sent:false}]});
    if(u.indexOf("/api/manage/brand-links") >= 0) return res({links:[["minic","MINIC","order@minic.example"],["grafen","GRAFEN",""],["bonkorea","본코리아","cs@bonkorea.example"]].map(function(x){ return {key:x[0], name:x[1], email:x[2], link:"https://skinside.co.kr/brand/#k=" + x[0] + ".(브랜드별 비밀 코드)"}; })});
    if(u.indexOf("/api/manage/products") >= 0) return res({products:extra});
    if(u.indexOf("/api/manage/product-delete") >= 0){ extra = extra.filter(function(x){ return x.id !== b.id; }); return res({ok:true}); }
    if(u.indexOf("/api/manage/product") >= 0){
      var list = Math.round(+b.list), price = Math.round(+b.price);
      if(!b.name || !b.brandName) return res({error:"제품명과 브랜드명을 입력해주세요"}, 400);
      if(!CATS[b.cat]) return res({error:"카테고리를 선택해주세요"}, 400);
      if(!(price > 0) || !(list >= price)) return res({error:"정가와 할인가를 확인해주세요 (정가는 할인가 이상)"}, 400);
      if(!/^https?:\/\/\S+$/.test(b.url || "")) return res({error:"바로가기 링크는 http(s)로 시작해야 해요"}, 400);
      var p = {id:"x" + Date.now().toString(36), cat:b.cat, name:b.name, brandName:b.brandName, price:price, list:list > price ? list : undefined, img:b.img, url:b.url}; extra.push(p); return res({ok:true, product:p});
    }
    return res({error:"not found"}, 404);
  };
  try{ sessionStorage.setItem("adm", "demo"); }catch(e){}
})();

/* 주문 관리 화면(미리보기 안의 iframe)용 가짜 서버: window.__ORDERS 가 있을 때만 동작 */
(function(){
  if(!window.__ORDERS_MOCK) return;
  var now = Date.now(), O = [
    {id:"SK2610180003", createdAt:new Date(now - 3600e3).toISOString(), status:"paid", total:51500, sent:{minic:new Date(now - 1800e3).toISOString()}, items:[{brand:"minic", name:"퍼펙트 콜라드그린 진정 올인원", optName:"1개", q:1}, {brand:"grafen", name:"포어 올킬 원스텝 코팩", q:2}], ship:{name:"김민수", phone:"010-1234-5678", zip:"06236", addr1:"서울 강남구 테헤란로 123", addr2:"456호", memo:"문 앞에 놓아주세요"}},
    {id:"SK2610180002", createdAt:new Date(now - 5 * 3600e3).toISOString(), status:"shipped", total:29900, items:[{brand:"bonkorea", name:"엔젤 탄산 효소 세안제", q:1}], ship:{name:"이준호", phone:"010-9876-5432", zip:"13529", addr1:"경기 성남시 분당구 판교로 1", addr2:"", memo:""}, shipments:{bonkorea:{carrier:"cj", tracking:"123456789012"}}},
    {id:"SK2610170007", createdAt:new Date(now - 30 * 3600e3).toISOString(), status:"canceled", total:21400, items:[{brand:"grafen", name:"팁 스케치 멀티 커버 파운데이션", q:1}], ship:{name:"박서준", phone:"010-5555-0000", zip:"04524", addr1:"서울 중구 세종대로 110", addr2:"", memo:""}}];
  var BR = {minic:{name:"MINIC"}, grafen:{name:"GRAFEN"}, bonkorea:{name:"본코리아"}};
  var real = window.fetch;
  function res(o, s){ return Promise.resolve(new Response(JSON.stringify(o), {status:s || 200, headers:{"content-type":"application/json"}})); }
  window.fetch = function(u, o){
    u = String(u); var b = {}; try{ b = JSON.parse((o && o.body) || "{}"); }catch(e){}
    if(u.indexOf("/api/admin/orders") >= 0) return res({orders:O, brands:BR});
    if(u.indexOf("/api/admin/ship") >= 0){ O.forEach(function(x){ if(x.id === b.orderId){ x.shipments = x.shipments || {}; x.shipments[b.brand] = {carrier:b.carrier, tracking:b.tracking}; } }); return res({ok:true}); }
    if(u.indexOf("/api/admin/cancel") >= 0){ O.forEach(function(x){ if(x.id === b.orderId) x.status = "canceled"; }); return res({ok:true}); }
    if(u.indexOf("/api/admin/settlement") >= 0) return Promise.resolve(new Response("정산 예시", {status:200}));
    return real.apply(this, arguments);
  };
  window.confirm = function(){ return true; }; window.alert = function(){};
  try{ sessionStorage.setItem("adm", "demo"); }catch(e){}
  document.addEventListener("click", function(e){ var a = e.target.closest && e.target.closest('a[href="/admin/"]'); if(a){ e.preventDefault(); try{ parent.postMessage({skadm:"home"}, "*"); }catch(x){} } }, true);
})();
