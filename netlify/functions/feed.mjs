/* 구글 판매자 센터(Merchant Center) 상품 피드 + 상품 랜딩 페이지 */
import { loadProducts } from "./_lib.mjs";

const SITE = "https://skinside.co.kr";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const abs = (u) => (/^https?:/.test(u) ? u : SITE + "/" + String(u || "").replace(/^\//, ""));
const CATS = { cl: "Health & Beauty > Personal Care > Cosmetics > Skin Care > Facial Cleansers", sk: "Health & Beauty > Personal Care > Cosmetics > Skin Care", sun: "Health & Beauty > Personal Care > Cosmetics > Skin Care > Sunscreen", blackhead: "Health & Beauty > Personal Care > Cosmetics > Skin Care", shower: "Health & Beauty > Personal Care > Cosmetics > Bath & Body", hair: "Health & Beauty > Personal Care > Hair Care > Hair Styling Products", pack: "Health & Beauty > Personal Care > Cosmetics > Skin Care > Facial Masks", mk: "Health & Beauty > Personal Care > Cosmetics > Makeup" };
const visible = (p) => !p.hidden && p.price > 0;
const pageUrl = (p) => SITE + "/product/" + encodeURIComponent(p.id);
const KRW = (n) => Math.round(n) + ".00 KRW";

export function buildFeed(products, cats) {
  const items = products.filter(visible).map((p) => {
    const sale = p.list && p.list > p.price;
    const t = [
      ["g:id", p.id],
      ["g:title", (p.brandName ? p.brandName + " " : "") + p.name],
      ["g:description", (p.note || p.name) + " (" + (p.brandName || "") + " · " + ((cats && cats[p.cat]) || "") + ")"],
      ["g:link", pageUrl(p)],
      ["g:image_link", abs(p.img)],
      ["g:availability", p.soldOut ? "out_of_stock" : "in_stock"],
      ["g:price", KRW(sale ? p.list : p.price)],
      sale ? ["g:sale_price", KRW(p.price)] : null,
      ["g:brand", p.brandName || p.brand],
      ["g:identifier_exists", "no"],
      ["g:condition", "new"],
      ["g:google_product_category", CATS[p.cat] || CATS.sk],
      ["g:product_type", (cats && cats[p.cat]) || ""],
      ["g:adult", "no"],
    ].filter(Boolean);
    return "<item>" + t.map(([k, v]) => "<" + k + ">" + esc(v) + "</" + k + ">").join("") + "</item>";
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>스킨인사이드</title><link>' + SITE + "</link><description>스킨인사이드 남자 스킨케어 스토어</description>" + items.join("") + "</channel></rss>";
}

export function productPage(p, cats) {
  const title = (p.brandName ? p.brandName + " " : "") + p.name;
  const ld = { "@context": "https://schema.org", "@type": "Product", name: title, image: [abs(p.img)], description: p.note || p.name, sku: p.id, brand: { "@type": "Brand", name: p.brandName || p.brand }, offers: { "@type": "Offer", url: pageUrl(p), priceCurrency: "KRW", price: String(Math.round(p.price)), availability: p.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition" } };
  const go = SITE + "/store#/p/" + encodeURIComponent(p.id);
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + " | 스킨인사이드</title><meta name=\"description\" content=\"" + esc(p.note || p.name) + '"><link rel="canonical" href="' + pageUrl(p) + '"><meta property="og:title" content="' + esc(title) + '"><meta property="og:image" content="' + esc(abs(p.img)) + '"><script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, "\\u003c") + '</script></head><body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:20px"><img src="' + esc(abs(p.img)) + '" alt="' + esc(title) + '" style="width:100%"><h1 style="font-size:20px">' + esc(title) + "</h1><p>" + esc(p.note || "") + '</p><p><b>' + Math.round(p.price).toLocaleString("ko-KR") + '원</b>' + (p.soldOut ? " (품절)" : "") + '</p><p><a href="' + go + '">스토어에서 보기</a></p><script>location.replace(' + JSON.stringify(go) + ")</script></body></html>";
}

export default async (req) => {
  const u = new URL(req.url);
  const { data, map } = await loadProducts(req);
  if (u.pathname === "/feed/google.xml") return new Response(buildFeed(data.products, data.categories), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
  const m = u.pathname.match(/^\/product\/([^/]+)$/);
  const p = m && map[decodeURIComponent(m[1])];
  if (!p || !visible(p)) return new Response("not found", { status: 404 });
  return new Response(productPage(p, data.categories), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
};
export const config = { path: ["/feed/google.xml", "/product/*"] };
