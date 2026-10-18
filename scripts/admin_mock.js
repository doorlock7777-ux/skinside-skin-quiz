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
