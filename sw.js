/* ============================================================
   SERVICE WORKER — Telefon Savdo
   ============================================================ */

const CACHE_NOMI = "telefon-savdo-v1";
// Ikonkalar ham keshga qo'shildi
const STATIK_FAYLLAR = [
  "./",
  "index.html", 
  "style.css", 
  "app.js", 
  "manifest.json",
  "icon-192x192.png",
  "icon-512x512.png"
];

// install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NOMI)
      .then((cache) => cache.addAll(STATIK_FAYLLAR))
      .then(() => self.skipWaiting())
  );
});

// activate — eski keshlarni tozalash
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((k) => {
            if (k !== CACHE_NOMI) return caches.delete(k);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// fetch
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // Faqat GET so'rovlarini keshga olish (POST, PUT kabilarni emas)
  if (event.request.method !== "GET") return;

  // Supabase API so'rovlari — network-first
  if (url.includes("supabase.co") || url.includes("/rest/v1/")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NOMI).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Statik fayllar — cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      
      return fetch(event.request)
        .then((res) => {
          // Agar javob muvaffaqiyatli bo'lsa va bu GET so'rov bo'lsa keshga saqlaymiz
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NOMI).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => {
          // Agar tarmoq bo'lmasa va so'rov HTML sahifa uchun bo'lsa, index.html ni qaytaramiz
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("index.html");
          }
        });
    })
  );
});