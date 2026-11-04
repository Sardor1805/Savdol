/* ============================================================
   TELEFON SAVDO BOSHQARUV TIZIMI — APP.JS
   ============================================================ */

/* ============ A) SUPABASE CLIENT ============ */
// ⚠️ BU YERGA O'ZINGIZNING SUPABASE URL VA ANON KEY INGIZNI YOZING
const SUPABASE_URL = "https://iqtdgbkymsilzxdjwpdl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5qb3UiLzJT0xzSO8O5V-rQ_2s30obcN";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============ B) YORDAMCHI FUNKSIYALAR ============ */

function formatSum(summa) {
  const n = Number(summa) || 0;
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}

function sanaVaqt(d = new Date()) {
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function bugunBoshi() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function validatsiyaTekshir(maydonlar) {
  // maydonlar: [{ nomi, qiymat, majburiy }]
  for (const m of maydonlar) {
    if (m.majburiy && (m.qiymat === "" || m.qiymat === null || m.qiymat === undefined)) {
      xatoKorsatish(`"${m.nomi}" maydoni to'ldirilishi shart`);
      return false;
    }
  }
  return true;
}

let _tasdiqResolve = null;
function tasdiqlash(xabar) {
  return new Promise((resolve) => {
    _tasdiqResolve = resolve;
    document.getElementById("modal-xabar").textContent = xabar;
    document.getElementById("modal-overlay").classList.remove("yashirin");
  });
}

function xatoKorsatish(xabar) {
  toast(xabar, "qizil");
}

function muvaffaqiyatKorsatish(xabar) {
  toast(xabar, "yashil");
}

function toast(xabar, tur) {
  const el = document.createElement("div");
  el.className = `toast toast-${tur}`;
  el.textContent = xabar;
  document.getElementById("toast-konteyner").appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function navigatsiyaYukla(sahifaId) {
  document.querySelectorAll(".sahifa").forEach((s) => s.classList.remove("faol"));
  const target = document.getElementById(sahifaId);
  if (target) target.classList.add("faol");

  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("faol", b.dataset.sahifa === sahifaId);
  });
  document.querySelectorAll(".bnav-btn").forEach((b) => {
    b.classList.toggle("faol", b.dataset.sahifa === sahifaId);
  });

  // Har sahifa uchun yuklash funksiyasini chaqirish
  const yuklashlar = {
    "sahifa-01": yuklaBoshSahifa,
    "sahifa-02": yuklaQidiruv,
    "sahifa-03": yuklaTovarQoshish,
    "sahifa-04": yuklaOmborKirim,
    "sahifa-05": yuklaTahrirlash,
    "sahifa-06": yuklaTovarSotuvi,
    "sahifa-06-1": yuklaXizmatSotuvi,
    "sahifa-07": yuklaXarajat,
    "sahifa-08": yuklaMoslik,
    "sahifa-09": yuklaMijozlar,
  };
  if (yuklashlar[sahifaId]) yuklashlar[sahifaId]();
}

/* ============ C) SUPABASE CRUD ============ */

async function tovarlarniOlish(filtr = {}) {
  let q = supabaseClient.from("tovarlar").select("*, tovar_turlari(nomi)").eq("arxivlangan", false);
  if (filtr.tur_id) q = q.eq("tur_id", filtr.tur_id);
  if (filtr.model_kodi) q = q.eq("model_kodi", filtr.model_kodi);
  const { data, error } = await q.order("yaratilgan_vaqt", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function tovarQoshish(tovar) {
  // unikallik tekshiruvi
  const { data: mavjud } = await supabaseClient
    .from("tovarlar")
    .select("id")
    .eq("model_kodi", tovar.model_kodi)
    .maybeSingle();
  if (mavjud) throw new Error("Bu model kodi allaqachon mavjud");

  const { data, error } = await supabaseClient.from("tovarlar").insert(tovar).select().single();
  if (error) throw error;
  return data;
}

async function tovarTahrirlash(id, malumot) {
  const { data, error } = await supabaseClient
    .from("tovarlar")
    .update(malumot)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function tovarOchirish(id) {
  const { error } = await supabaseClient
    .from("tovarlar")
    .update({ arxivlangan: true })
    .eq("id", id);
  if (error) throw error;
}

async function kirimQoshish(kirim) {
  // tovar soni oshirish
  const { data: tovar, error: e1 } = await supabaseClient
    .from("tovarlar")
    .select("soni")
    .eq("id", kirim.tovar_id)
    .single();
  if (e1) throw e1;

  const yangiSoni = (tovar.soni || 0) + kirim.soni;

  const { error: e2 } = await supabaseClient
    .from("tovarlar")
    .update({ soni: yangiSoni })
    .eq("id", kirim.tovar_id);
  if (e2) throw e2;

  const { data, error } = await supabaseClient.from("kirimlar").insert(kirim).select().single();
  if (error) throw error;
  return data;
}

async function sotuvQoshish(sotuv) {
  // tovar sonini tekshirish va kamaytirish
  const { data: tovar, error: e1 } = await supabaseClient
    .from("tovarlar")
    .select("soni")
    .eq("id", sotuv.tovar_id)
    .single();
  if (e1) throw e1;
  if ((tovar.soni || 0) < sotuv.soni) throw new Error("Omborda yetarli tovar yo'q");

  const { error: e2 } = await supabaseClient
    .from("tovarlar")
    .update({ soni: tovar.soni - sotuv.soni })
    .eq("id", sotuv.tovar_id);
  if (e2) throw e2;

  const { data: sotuvData, error: e3 } = await supabaseClient
    .from("sotuvlar")
    .insert(sotuv)
    .select()
    .single();
  if (e3) throw e3;

  // nasiya bo'lsa nasiyalar jadvaliga
  if (sotuv.tolov_turi === "nasiya" && sotuv.mijoz_id) {
    await supabaseClient.from("nasiyalar").insert({
      mijoz_id: sotuv.mijoz_id,
      sotuv_id: sotuvData.id,
      summa: sotuv.sotuv_narxi * sotuv.soni,
      tolov_summasi: 0,
      tolangan: false,
    });
  }
  return sotuvData;
}

async function xizmatSotuvQoshish(xizmat) {
  const { data: xizmatData, error } = await supabaseClient
    .from("xizmat_sotuvlari")
    .insert(xizmat)
    .select()
    .single();
  if (error) throw error;

  if (xizmat.tolov_turi === "nasiya" && xizmat.mijoz_id) {
    await supabaseClient.from("nasiyalar").insert({
      mijoz_id: xizmat.mijoz_id,
      xizmat_sotuv_id: xizmatData.id,
      summa: xizmat.narxi,
      tolov_summasi: 0,
      tolangan: false,
    });
  }
  return xizmatData;
}

async function xarajatQoshish(xarajat) {
  const { data, error } = await supabaseClient.from("xarajatlar").insert(xarajat).select().single();
  if (error) throw error;
  return data;
}

async function mijozlarniOlish() {
  const { data, error } = await supabaseClient
    .from("mijozlar")
    .select("*")
    .order("yaratilgan_vaqt", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function mijozQoshish(mijoz) {
  const { data, error } = await supabaseClient.from("mijozlar").insert(mijoz).select().single();
  if (error) throw error;
  return data;
}

async function mijozTahrirlash(id, malumot) {
  const { data, error } = await supabaseClient
    .from("mijozlar")
    .update(malumot)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function nasiyalarniOlish(mijozId) {
  const { data, error } = await supabaseClient
    .from("nasiyalar")
    .select("*")
    .eq("mijoz_id", mijozId)
    .eq("tolangan", false);
  if (error) throw error;
  return data || [];
}

async function nasiyaTolash(nasiyaId, summa) {
  const { data: nasiya, error: e1 } = await supabaseClient
    .from("nasiyalar")
    .select("*")
    .eq("id", nasiyaId)
    .single();
  if (e1) throw e1;

  const yangiTolov = (nasiya.tolov_summasi || 0) + summa;
  if (yangiTolov > nasiya.summa) throw new Error("To'lov summasi qarzdan oshib ketdi");

  const tolangan = yangiTolov >= nasiya.summa;

  const { error } = await supabaseClient
    .from("nasiyalar")
    .update({ tolov_summasi: yangiTolov, tolangan })
    .eq("id", nasiyaId);
  if (error) throw error;
}

async function moslikQoshish(asosiyId, mosId) {
  const { data, error } = await supabaseClient
    .from("mosliklar")
    .insert({ asosiy_tovar_id: asosiyId, mos_tovar_id: mosId })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Bu moslik allaqachon mavjud");
    throw error;
  }
  return data;
}

async function moslikTahrirlash(id, malumot) {
  const { data, error } = await supabaseClient
    .from("mosliklar")
    .update(malumot)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Bu moslik allaqachon mavjud");
    throw error;
  }
  return data;
}

async function boshSahifaMalumot() {
  const boshi = bugunBoshi();

  const [sotuvlar, xizmatlar, xarajatlar] = await Promise.all([
    supabaseClient.from("sotuvlar").select("*").gte("sana", boshi),
    supabaseClient.from("xizmat_sotuvlari").select("*").gte("sana", boshi),
    supabaseClient.from("xarajatlar").select("*").gte("sana", boshi),
  ]);

  const s = sotuvlar.data || [];
  const x = xizmatlar.data || [];
  const xr = xarajatlar.data || [];

  // Naqd / karta sotuvlar
  let naqdSotuv = 0, kartaSotuv = 0, naqdXizmat = 0, kartaXizmat = 0;
  let naqdXarajat = 0, kartaXarajat = 0;

  s.forEach((r) => {
    const summa = r.sotuv_narxi * r.soni;
    if (r.tolov_turi === "naqd") naqdSotuv += summa;
    else if (r.tolov_turi === "karta") kartaSotuv += summa;
  });

  x.forEach((r) => {
    if (r.tolov_turi === "naqd") naqdXizmat += r.narxi;
    else if (r.tolov_turi === "karta") kartaXizmat += r.narxi;
  });

  xr.forEach((r) => {
    if (r.tolov_turi === "naqd") naqdXarajat += r.miqdori;
    else if (r.tolov_turi === "karta") kartaXarajat += r.miqdori;
  });

  const naqdKassa = naqdSotuv + naqdXizmat - naqdXarajat;
  const kartaKassa = kartaSotuv + kartaXizmat - kartaXarajat;
  const tushum = naqdSotuv + kartaSotuv + naqdXizmat + kartaXizmat;
  const xarajat = naqdXarajat + kartaXarajat;
  const foyda = tushum - xarajat;

  return { naqdKassa, kartaKassa, tushum, xarajat, foyda };
}

/* ============ D) YUKLASH FUNKSIYALARI ============ */

async function yuklaBoshSahifa() {
  try {
    const m = await boshSahifaMalumot();
    document.getElementById("kassa-naqd").textContent = formatSum(m.naqdKassa);
    document.getElementById("kassa-karta").textContent = formatSum(m.kartaKassa);
    document.getElementById("bugun-tushum").textContent = formatSum(m.tushum);
    document.getElementById("bugun-xarajat").textContent = formatSum(m.xarajat);
    document.getElementById("bugun-foyda").textContent = formatSum(m.foyda);
  } catch (e) {
    xatoKorsatish("Bosh sahifa ma'lumotlarini yuklashda xato: " + e.message);
  }
}

// global keshlar
let _tovarlarKesh = [];
let _turlarKesh = [];

async function turlarniOlish() {
  if (_turlarKesh.length) return _turlarKesh;
  const { data, error } = await supabaseClient.from("tovar_turlari").select("*").order("id");
  if (error) throw error;
  _turlarKesh = data || [];
  return _turlarKesh;
}

async function barchaTovarlar() {
  const { data, error } = await supabaseClient
    .from("tovarlar")
    .select("*, tovar_turlari(nomi)")
    .eq("arxivlangan", false)
    .order("model");
  if (error) throw error;
  _tovarlarKesh = data || [];
  return _tovarlarKesh;
}

/* --- 02 QIDIRUV --- */
async function yuklaQidiruv() {
  try {
    const turlar = await turlarniOlish();
    const turSel = document.getElementById("qidiruv-tur");
    turSel.innerHTML = '<option value="Hammasi">Hammasi</option>' +
      turlar.map((t) => `<option value="${t.id}">${t.nomi}</option>`).join("");

    await barchaTovarlar();
    const modelSel = document.getElementById("qidiruv-model");
    modelSel.innerHTML = '<option value="Hammasi">Hammasi</option>' +
      _tovarlarKesh.map((t) => `<option value="${t.model}">${t.model}</option>`).join("");

    qidiruvIshla();
  } catch (e) {
    xatoKorsatish("Qidiruv yuklashda xato: " + e.message);
  }
}

function qidiruvIshla() {
  const turVal = document.getElementById("qidiruv-tur").value;
  const modelVal = document.getElementById("qidiruv-model").value;
  const matn = document.getElementById("qidiruv-matn").value.toLowerCase().trim();

  let natija = _tovarlarKesh;
  if (turVal !== "Hammasi") natija = natija.filter((t) => String(t.tur_id) === turVal);
  if (modelVal !== "Hammasi") natija = natija.filter((t) => t.model === modelVal);
  
  if (matn) {
    // Matnni bo'laklarga ajratamiz (masalan: ["redmi", "13", "xiaomi"])
    const qismlar = matn.split(/\s+/);
    
    natija = natija.filter((t) => {
      const matnMaydoni = `${t.model_kodi} ${t.model} ${t.marka || ""}`.toLowerCase();
      // Har bir bo'lak tovar ma'lumotida qatnashgan bo'lishi shart
      return qismlar.every(qism => matnMaydoni.includes(qism));
    });
  }

  const tbody = document.getElementById("qidiruv-tbody");
  if (!natija.length) {
    tbody.innerHTML = '<tr class="bosh-qator"><td colspan="5">Natija topilmadi</td></tr>';
  } else {
    tbody.innerHTML = natija
      .map(
        (t) =>
          `<tr>
            <td>${t.model_kodi}</td>
            <td>${t.model}</td>
            <td>${t.marka || "—"}</td>
            <td>${formatSum(t.narx)}</td>
            <td>${t.soni}</td>
          </tr>`
      )
      .join("");
  }

  // Mos modellarni yuklash
  mosModellarniQidiruvdaKorsat(matn);
}

async function mosModellarniQidiruvdaKorsat(matn) {
  const tbody = document.getElementById("mos-modellar-tbody");
  if (!tbody) return;

  if (!matn) {
    tbody.innerHTML = '<tr class="bosh-qator"><td colspan="6">Qidiruv uchun matn kiriting</td></tr>';
    return;
  }

  try {
    // 1. Kiritilgan matnga (bir nechta so'z bo'lsa ham) mos keluvchi barcha tovarlarni topish
    const qismlar = matn.split(/\s+/);
    // SQL so'rov uchun filtr yasaymiz
    let orFilters = qismlar.map(q => `model.ilike.%${q}%,marka.ilike.%${q}%,model_kodi.ilike.%${q}%`).join(",");
    
    const { data: topilganTovarlar, error: tError } = await supabaseClient
      .from("tovarlar")
      .select("id")
      .or(orFilters);
      
    if (tError) throw tError;

    if (!topilganTovarlar || topilganTovarlar.length === 0) {
      tbody.innerHTML = '<tr class="bosh-qator"><td colspan="6">Mos model topilmadi</td></tr>';
      return;
    }

    const ids = topilganTovarlar.map(t => t.id);

    // 2. Mosliklarni qidiramiz
    const { data, error } = await supabaseClient
      .from("mosliklar")
      .select(`
        asosiy_tovar_id,
        mos_tovar_id,
        asosiy:tovarlar!mosliklar_asosiy_tovar_id_fkey(model_kodi, model, marka, narx, soni),
        mos:tovarlar!mosliklar_mos_tovar_id_fkey(model_kodi, model, marka, narx, soni)
      `)
      .or(`asosiy_tovar_id.in.(${ids.join(',')}),mos_tovar_id.in.(${ids.join(',')})`);

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr class="bosh-qator"><td colspan="6">Bu modelga tegishli mosliklar topilmadi</td></tr>';
      return;
    }

    // 3. Takrorlanmaslik uchun Map ishlatamiz va qaysi modelga mosligini saqlaymiz
    const unikalMoslar = new Map();

        data.forEach(r => {
      if (ids.includes(r.asosiy_tovar_id) && r.mos) {
        unikalMoslar.set(r.mos.model_kodi, {
          tovar: r.mos,
          // Mana bu yerda marka ham qo'shildi:
          mosKimga: `${r.asosiy.model} (${r.asosiy.marka || "—"})` 
        });
      }
      if (ids.includes(r.mos_tovar_id) && r.asosiy) {
        unikalMoslar.set(r.asosiy.model_kodi, {
          tovar: r.asosiy,
          // Va bu yerda ham:
          mosKimga: `${r.mos.model} (${r.mos.marka || "—"})`
        });
      }
    });

    if (unikalMoslar.size === 0) {
      tbody.innerHTML = '<tr class="bosh-qator"><td colspan="6">Mos model topilmadi</td></tr>';
      return;
    }

    // 4. Jadvalga chiqarish
    let html = "";
    unikalMoslar.forEach(item => {
      const t = item.tovar;
      html += `<tr>
        <td>${t.model_kodi}</td>
        <td>${t.model}</td>
        <td>${t.marka || "—"}</td>
        <td>${formatSum(t.narx)}</td>
        <td>${t.soni}</td>
        <td><span style="color: #3b82f6; font-size: 13px;">↳ ${item.mosKimga} uchun</span></td>
      </tr>`;
    });

    tbody.innerHTML = html;

  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr class="bosh-qator"><td colspan="6">Xato: ${e.message}</td></tr>`;
  }
}

/* --- 03 TOVAR QO'SHISH --- */
async function yuklaTovarQoshish() {
  try {
    const turlar = await turlarniOlish();
    const sel = document.getElementById("qoshish-tur");
    sel.innerHTML = '<option value="">— Tanlang —</option>' +
      turlar.map((t) => `<option value="${t.id}">${t.nomi}</option>`).join("");

    // Maydonlarni disabled qilish (tur tanlanmaguncha)
    ["qoshish-kod", "qoshish-model", "qoshish-marka", "qoshish-narx"].forEach((id) => {
      document.getElementById(id).disabled = true;
      document.getElementById(id).value = "";
    });
    document.getElementById("qoshish-saqlash").disabled = true;
  } catch (e) {
    xatoKorsatish("Yuklashda xato: " + e.message);
  }
}

/* --- 04 OMBORGA KIRIM --- */
async function yuklaOmborKirim() {
  try {
    await barchaTovarlar();
    const dl = document.getElementById("kirim-kod-list");
    dl.innerHTML = _tovarlarKesh
      .map((t) => `<option value="${t.model_kodi}">${t.model} (${t.marka || ""})</option>`)
      .join("");

    // oxirgi kirimlar
    const { data, error } = await supabaseClient
      .from("kirimlar")
      .select("*, tovarlar(model_kodi)")
      .order("sana", { ascending: false })
      .limit(20);
    if (error) throw error;

    const tbody = document.getElementById("kirim-tbody");
    if (!data || !data.length) {
      tbody.innerHTML = '<tr class="bosh-qator"><td colspan="4">Kirimlar yo\'q</td></tr>';
    } else {
      tbody.innerHTML = data
        .map(
          (r) =>
            `<tr>
              <td>${sanaVaqt(new Date(r.sana))}</td>
              <td>${r.tovarlar ? r.tovarlar.model_kodi : "—"}</td>
              <td>${r.soni}</td>
              <td>${r.izoh || "—"}</td>
            </tr>`
        )
        .join("");
    }
  } catch (e) {
    xatoKorsatish("Kirim yuklashda xato: " + e.message);
  }
}

/* --- 05 TOVARLARNI TAHRIRLASH --- */
let _tahrirFiltrlangan = [];

async function yuklaTahrirlash() {
  try {
    const turlar = await turlarniOlish();
    const turSel = document.getElementById("tahrir-tur");
    turSel.innerHTML = '<option value="Hammasi">Hammasi</option>' +
      turlar.map((t) => `<option value="${t.id}">${t.nomi}</option>`).join("");

    await barchaTovarlar();
    const modelSel = document.getElementById("tahrir-model");
    modelSel.innerHTML = '<option value="Hammasi">Hammasi</option>' +
      _tovarlarKesh.map((t) => `<option value="${t.model}">${t.model}</option>`).join("");

    tahrirIshla();
  } catch (e) {
    xatoKorsatish("Tahrirlash yuklashda xato: " + e.message);
  }
}

function tahrirIshla() {
  const turVal = document.getElementById("tahrir-tur").value;
  const modelVal = document.getElementById("tahrir-model").value;
  const matn = document.getElementById("tahrir-qidiruv").value.toLowerCase().trim();

  let natija = _tovarlarKesh;
  if (turVal !== "Hammasi") natija = natija.filter((t) => String(t.tur_id) === turVal);
  if (modelVal !== "Hammasi") natija = natija.filter((t) => t.model === modelVal);
  if (matn) {
    natija = natija.filter(
      (t) =>
        t.model_kodi.toLowerCase().includes(matn) ||
        t.model.toLowerCase().includes(matn) ||
        (t.marka || "").toLowerCase().includes(matn)
    );
  }

  _tahrirFiltrlangan = natija;

  // 1. Tovar turi nomini aniqlash
  let turNomi = "tovar";
  if (turVal !== "Hammasi") {
    const tanlanganTur = _turlarKesh.find(t => String(t.id) === turVal);
    if (tanlanganTur) turNomi = tanlanganTur.nomi; 
  }
  
  // 2. Barcha tovarlarning umumiy dona sonini hisoblash
  const jamiDona = natija.reduce((sum, tovar) => sum + Number(tovar.soni || 0), 0);
  
  // 3. Natijani ekranga chiqarish (masalan: "Jami 35 ta tovar")
  document.getElementById("tahrir-jami").textContent = `Jami ${jamiDona} ta ${turNomi}`;

  const tbody = document.getElementById("tahrir-tbody");
  if (!natija.length) {
    tbody.innerHTML = '<tr class="bosh-qator"><td colspan="6">Tovar topilmadi</td></tr>';
    return;
  }
  tbody.innerHTML = natija
    .map(
      (t) =>
        `<tr>
          <td>${t.model_kodi}</td>
          <td>${t.model}</td>
          <td>${t.marka || "—"}</td>
          <td>${formatSum(t.narx)}</td>
          <td>${t.soni}</td>
          <td>
            <button class="amal-btn" data-tahrir="${t.id}" title="Tahrirlash">✏️</button>
            <button class="amal-btn" data-ochirish="${t.id}" title="O'chirish">🗑️</button>
          </td>
        </tr>`
    )
    .join("");
}

/* --- 06 TOVAR SOTUVI --- */
let _sotuvTovar = null;

async function yuklaTovarSotuvi() {
  try {
    await barchaTovarlar();
    const dl = document.getElementById("sotuv-kod-list");
    dl.innerHTML = _tovarlarKesh
      .map((t) => `<option value="${t.model_kodi}">${t.model} (${t.marka || ""})</option>`)
      .join("");

    // mijozlar select
    const mijozlar = await mijozlarniOlish();
    const mSel = document.getElementById("sotuv-mijoz");
    mSel.innerHTML = '<option value="">— Mijoz tanlang —</option>' +
      mijozlar.map((m) => `<option value="${m.id}">${m.ism} (${m.telefon || ""})</option>`).join("");
  } catch (e) {
    xatoKorsatish("Sotuv yuklashda xato: " + e.message);
  }
}

/* --- 06.1 XIZMAT SOTUVI --- */
async function yuklaXizmatSotuvi() {
  try {
    const mijozlar = await mijozlarniOlish();
    const mSel = document.getElementById("xizmat-mijoz");
    mSel.innerHTML = '<option value="">— Mijoz tanlang —</option>' +
      mijozlar.map((m) => `<option value="${m.id}">${m.ism} (${m.telefon || ""})</option>`).join("");

    // bugungi xizmatlar
    const boshi = bugunBoshi();
    const { data, error } = await supabaseClient
      .from("xizmat_sotuvlari")
      .select("*")
      .gte("sana", boshi)
      .order("sana", { ascending: false });
    if (error) throw error;

    const tbody = document.getElementById("xizmat-tbody");
    if (!data || !data.length) {
      tbody.innerHTML = '<tr class="bosh-qator"><td colspan="4">Bugun xizmat sotuvlari yo\'q</td></tr>';
    } else {
      tbody.innerHTML = data
        .map(
          (r) =>
            `<tr>
              <td>${r.xizmat_nomi}</td>
              <td>${formatSum(r.narxi)}</td>
              <td>${r.tolov_turi}</td>
              <td>${sanaVaqt(new Date(r.sana))}</td>
            </tr>`
        )
        .join("");
    }
  } catch (e) {
    xatoKorsatish("Xizmat sotuvi yuklashda xato: " + e.message);
  }
}

/* --- 07 XARAJAT --- */
async function yuklaXarajat() {
  try {
    const boshi = bugunBoshi();
    const { data, error } = await supabaseClient
      .from("xarajatlar")
      .select("*")
      .gte("sana", boshi)
      .order("sana", { ascending: false });
    if (error) throw error;

    const tbody = document.getElementById("xarajat-tbody");
    if (!data || !data.length) {
      tbody.innerHTML = '<tr class="bosh-qator"><td colspan="4">Bugun xarajatlar yo\'q</td></tr>';
    } else {
      tbody.innerHTML = data
        .map(
          (r) =>
            `<tr>
              <td>${r.nomi}</td>
              <td>${formatSum(r.miqdori)}</td>
              <td>${r.tolov_turi}</td>
              <td>${sanaVaqt(new Date(r.sana))}</td>
            </tr>`
        )
        .join("");
    }
  } catch (e) {
    xatoKorsatish("Xarajat yuklashda xato: " + e.message);
  }
}

/* --- 08 MOSLIK JADVALI (YANGI TOZA KOD) --- */
async function yuklaMoslik() {
  try {
    await barchaTovarlar(); // Barcha tovarlarni yuklash
    
    // 1. Datalistni to'ldirish (Faqat 1-qadam uchun)
    const asosiyList = document.getElementById("mos-asosiy-list");
    const asosiyKodInput = document.getElementById("mos-asosiy-kod");
    
    if (asosiyList && asosiyKodInput) {
      asosiyList.innerHTML = _tovarlarKesh.map(t => 
        `<option value="${t.model_kodi}">${t.model} (${t.marka || ""})</option>`
      ).join("");

      // Asosiy kod tanlanganda yoki yozilganda ma'lumot chiqarish
      asosiyKodInput.oninput = (e) => {
        const val = e.target.value.trim().toUpperCase();
        const t = _tovarlarKesh.find(x => x.model_kodi.toUpperCase() === val);
        
        if (t) {
          document.getElementById("mos-asosiy-info").value = `${t.model} (${t.marka})`;
        } else {
          document.getElementById("mos-asosiy-info").value = "— Model topilmadi —";
        }
      };
    }

    // 2. Mosliklar jadvalini yuklash
    const { data, error } = await supabaseClient
      .from("mosliklar")
      .select(`
        id,
        asosiy_tovar_id,
        mos_tovar_id,
        asosiy:tovarlar!mosliklar_asosiy_tovar_id_fkey(model_kodi, model, marka),
        mos:tovarlar!mosliklar_mos_tovar_id_fkey(model_kodi, model, marka)
      `)
      .order("asosiy_tovar_id");
      
    if (error) throw error;

    const tbody = document.getElementById("mos-tbody");
    if (!tbody) return;

    if (!data || !data.length) {
      tbody.innerHTML = '<tr class="bosh-qator"><td colspan="3">Mosliklar yo\'q</td></tr>';
      return;
    }

    // 3. Ma'lumotlarni asosiy model bo'yicha guruhlash
    const guruhlar = {};
    data.forEach(r => {
      const asosiyId = r.asosiy_tovar_id;
      if (!guruhlar[asosiyId]) {
        guruhlar[asosiyId] = {
          asosiy: r.asosiy,
          moslar: []
        };
      }
      guruhlar[asosiyId].moslar.push({ id: r.id, model: r.mos });
    });

    // 4. Jadvalga chiqarish
    let html = "";
    for (const id in guruhlar) {
      const g = guruhlar[id];
      const asosiyText = `${g.asosiy.model_kodi} - ${g.asosiy.model} (${g.asosiy.marka})`;
      
      // Ichki kartochkalar dizayni (Qoramtir dizaynga moslangan)
      const moslarHtml = g.moslar.map(m => 
        `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; background: rgba(255, 255, 255, 0.05); padding:8px 12px; border-radius:6px; border:1px solid rgba(255, 255, 255, 0.1);">
          <span style="color: #cbd5e1;">↳ ${m.model.model_kodi} - ${m.model.model} (${m.model.marka})</span>
          <button class="amal-btn" data-mos-ochirish="${m.id}" title="O'chirish" style="color:#ef4444; font-size:16px;">🗑️</button>
        </div>`
      ).join("");

      html += `<tr>
        <td style="font-weight:600; color:#3b82f6; vertical-align:top; padding-top:12px;">${asosiyText}</td>
        <td style="padding: 8px;">${moslarHtml}</td>
        <td style="vertical-align:top; padding-top:12px; text-align:center;">
           <button class="amal-btn" data-asosiy-ochirish="${id}" title="Barcha mosliklarni o'chirish" style="color:#ef4444; font-size:13px;">🗑️ Guruhni o'chirish</button>
        </td>
      </tr>`;
    }
    tbody.innerHTML = html;

  } catch (e) {
    xatoKorsatish("Moslik yuklashda xato: " + e.message);
    console.error(e);
  }
}

  /* --- 08 MOSLIK eventlari (YANGI) --- */
  const mosTozalashBtn = document.getElementById("mos-tozalash");
  if (mosTozalashBtn) {
    mosTozalashBtn.addEventListener("click", () => {
      document.getElementById("mos-asosiy-kod").value = "";
      document.getElementById("mos-asosiy-info").value = "— Model tanlanmagan —";
      document.getElementById("mos-mos-kod").value = "";
      document.getElementById("mos-mos-info").value = "— Model tanlanmagan —";
    });
  }

  const mosSaqlashBtn = document.getElementById("mos-saqlash");
  if (mosSaqlashBtn) {
    mosSaqlashBtn.addEventListener("click", async () => {
      await moslikSaqlashMantiqi(true); // true = formani tozalasin
    });
  }

  const mosQoshishBtn = document.getElementById("mos-qoshish");
  if (mosQoshishBtn) {
    mosQoshishBtn.addEventListener("click", async () => {
      await moslikSaqlashMantiqi(false); // false = faqat mos modelni tozalasin
    });
  }

  // O'chirish eventlari
  const mosTbody = document.getElementById("mos-tbody");
  if (mosTbody) {
    mosTbody.addEventListener("click", async (e) => {
      const mosOchirId = e.target.dataset.mosOchirish;
      const asosiyOchirId = e.target.dataset.asosiyOchirish;

      if (mosOchirId) {
        const ok = await tasdiqlash("Bu moslikni o'chirishni tasdiqlaysizmi?");
        if (!ok) return;
        const { error } = await supabaseClient.from("mosliklar").delete().eq("id", mosOchirId);
        if (error) return xatoKorsatish(error.message);
        muvaffaqiyatKorsatish("Moslik o'chirildi");
        yuklaMoslik();
      }

      if (asosiyOchirId) {
        const ok = await tasdiqlash("Ushbu asosiy modelga tegishli BARCHA mosliklar o'chiriladi. Tasdiqlaysizmi?");
        if (!ok) return;
        const { error } = await supabaseClient.from("mosliklar").delete().eq("asosiy_tovar_id", asosiyOchirId);
        if (error) return xatoKorsatish(error.message);
        muvaffaqiyatKorsatish("Guruh o'chirildi");
        yuklaMoslik();
      }
    });
  }

  // Yordamchi funksiya (saqlash va qo'shish uchun)
   async function moslikSaqlashMantiqi(tozalashKerakmi) {
    const asosiyKod = document.getElementById("mos-asosiy-kod").value.trim();
    const yangiModel = document.getElementById("mos-tovar-model").value.trim();
    const yangiMarka = document.getElementById("mos-tovar-marka").value.trim();

    if (!asosiyKod) return xatoKorsatish("Asosiy model kodini tanlang yoki yozing");
    if (!yangiModel || !yangiMarka) return xatoKorsatish("Mos modelning nomi va markasini to'liq kiriting");

    try {
      // Asosiy modelni topish
      const asosiyTovar = _tovarlarKesh.find(
        t => t.model_kodi.toUpperCase() === asosiyKod.toUpperCase()
      );
      if (!asosiyTovar) return xatoKorsatish("Asosiy model bazadan topilmadi. Kodni to'g'ri yozing.");

      // Yangi model bazada bor-yo'qligini tekshirish
      let mosTovar = _tovarlarKesh.find(
        t => t.model.toLowerCase() === yangiModel.toLowerCase() && 
            (t.marka || "").toLowerCase() === yangiMarka.toLowerCase()
      );

      let mosTovarId;

      // Agar mos model bazada bo'lsa, uning ID sini olamiz
      if (mosTovar) {
        mosTovarId = mosTovar.id;
      } else {
        // Agar bazada bo'lmasa, unga maxsus kod berib, faqat tovarlar jadvaliga (arxivlangan holda) qo'shamiz
        // Shunda u asosiy omborga chiqmaydi, lekin moslikda ko'rinadi!
        const avtoKod = "MOS-" + Date.now().toString().slice(-6);
        
        const { data: yangiTovar, error: qoshishXato } = await supabaseClient
          .from("tovarlar")
          .insert({
            tur_id: asosiyTovar.tur_id,
            model_kodi: avtoKod,
            model: yangiModel,
            marka: yangiMarka,
            narx: 0,
            soni: 0,
            arxivlangan: true // <--- ASOSIY FARQ: Arxivlangan qilamiz, qidiruvda chiqmasligi uchun
          })
          .select()
          .single();

        if (qoshishXato) throw qoshishXato;
        mosTovarId = yangiTovar.id;
      }

      // Dublikat tekshiruvi
      const { data: mavjud } = await supabaseClient
        .from("mosliklar")
        .select("id")
        .eq("asosiy_tovar_id", asosiyTovar.id)
        .eq("mos_tovar_id", mosTovarId)
        .maybeSingle();
        
      if (mavjud) return xatoKorsatish("Bu moslik allaqachon jadvalda bor!");

      // Bazaga yozish
      await moslikQoshish(asosiyTovar.id, mosTovarId);
      muvaffaqiyatKorsatish("Moslik muvaffaqiyatli saqlandi");
      
      // Formani tozalash
      if (tozalashKerakmi) {
        document.getElementById("mos-asosiy-kod").value = "";
        document.getElementById("mos-asosiy-info").value = "— Model tanlanmagan —";
      }
      document.getElementById("mos-tovar-model").value = "";
      document.getElementById("mos-tovar-marka").value = "";
      
      yuklaMoslik(); 
    } catch (e) {
      xatoKorsatish(e.message);
      console.error(e);
    }
  }
/* --- 09 MIJOZLAR --- */
async function yuklaMijozlar() {
  try {
    const mijozlar = await mijozlarniOlish();

    // Har bir mijoz uchun qarz va olgan tovar
    const natija = await Promise.all(
      mijozlar.map(async (m) => {
        const { data: nasiyalar } = await supabaseClient
          .from("nasiyalar")
          .select("summa, tolov_summasi")
          .eq("mijoz_id", m.id)
          .eq("tolangan", false);

        const qarz = (nasiyalar || []).reduce(
          (s, n) => s + (n.summa - (n.tolov_summasi || 0)),
          0
        );

        // olgan tovar(lar) — sotuvlar orqali
        const { data: sotuvlar } = await supabaseClient
          .from("sotuvlar")
          .select("tovarlar(model)")
          .eq("mijoz_id", m.id);

        const tovarlar = (sotuvlar || [])
          .map((s) => (s.tovarlar ? s.tovarlar.model : null))
          .filter(Boolean);

        return { ...m, qarz, tovarlar };
      })
    );

    const tbody = document.getElementById("mijoz-tbody");
    if (!natija.length) {
      tbody.innerHTML = '<tr class="bosh-qator"><td colspan="5">Mijozlar yo\'q</td></tr>';
      return;
    }

    tbody.innerHTML = natija
      .map(
        (m) =>
          `<tr>
            <td>${m.ism}</td>
            <td>${m.telefon || "—"}</td>
            <td>${formatSum(m.qarz)}</td>
            <td>${m.tovarlar.length ? m.tovarlar.join(", ") : "—"}</td>
            <td>
              <button class="amal-btn" data-mijoz-batafsil="${m.id}" title="Batafsil">📋</button>
            </td>
          </tr>`
      )
      .join("");

    // qidiruv
    const q = document.getElementById("mijoz-qidiruv").value.toLowerCase().trim();
    if (q) {
      const filtrlangan = natija.filter(
        (m) =>
          m.ism.toLowerCase().includes(q) ||
          (m.telefon || "").toLowerCase().includes(q)
      );
      if (!filtrlangan.length) {
        tbody.innerHTML = '<tr class="bosh-qator"><td colspan="5">Mijoz topilmadi</td></tr>';
      } else {
        tbody.innerHTML = filtrlangan
          .map(
            (m) =>
              `<tr>
                <td>${m.ism}</td>
                <td>${m.telefon || "—"}</td>
                <td>${formatSum(m.qarz)}</td>
                <td>${m.tovarlar.length ? m.tovarlar.join(", ") : "—"}</td>
                <td>
                  <button class="amal-btn" data-mijoz-batafsil="${m.id}" title="Batafsil">📋</button>
                </td>
              </tr>`
          )
          .join("");
      }
    }
  } catch (e) {
    xatoKorsatish("Mijozlar yuklashda xato: " + e.message);
  }
}

/* ============ E) NAVIGATSIYA VA EVENTLAR ============ */

function navigatsiyaEventlarniUlash() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigatsiyaYukla(btn.dataset.sahifa));
  });
  document.querySelectorAll(".bnav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigatsiyaYukla(btn.dataset.sahifa));
  });
}

/* ============ F) PWA RO'YXATDAN O'TKAZISH ============ */
function pwaRoyxatdanOtish() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js")
        .then((reg) => console.log("SW ro'yxatdan o'tdi:", reg.scope))
        .catch((err) => console.error("SW xato:", err));
    });
  }
}

/* ============ G) DOMContentLoaded ============ */
document.addEventListener("DOMContentLoaded", () => {
  pwaRoyxatdanOtish();
  navigatsiyaEventlarniUlash();

  /* --- Modal tugmalari --- */
  document.getElementById("modal-bekor").addEventListener("click", () => {
    document.getElementById("modal-overlay").classList.add("yashirin");
    if (_tasdiqResolve) { _tasdiqResolve(false); _tasdiqResolve = null; }
  });
  document.getElementById("modal-tasdiq").addEventListener("click", () => {
    document.getElementById("modal-overlay").classList.add("yashirin");
    if (_tasdiqResolve) { _tasdiqResolve(true); _tasdiqResolve = null; }
  });

  /* --- 03 TOVAR QO'SHISH --- */
  document.getElementById("qoshish-tur").addEventListener("change", (e) => {
    const tanlangan = !!e.target.value;
    ["qoshish-kod", "qoshish-model", "qoshish-marka", "qoshish-narx"].forEach((id) => {
      document.getElementById(id).disabled = !tanlangan;
    });
    document.getElementById("qoshish-saqlash").disabled = !tanlangan;
  });

  document.getElementById("qoshish-saqlash").addEventListener("click", async () => {
    const tur_id = Number(document.getElementById("qoshish-tur").value);
    const model_kodi = document.getElementById("qoshish-kod").value.trim();
    const model = document.getElementById("qoshish-model").value.trim();
    const marka = document.getElementById("qoshish-marka").value.trim();
    const narx = Number(document.getElementById("qoshish-narx").value);

    if (!validatsiyaTekshir([
      { nomi: "Model kodi", qiymat: model_kodi, majburiy: true },
      { nomi: "Model", qiymat: model, majburiy: true },
      { nomi: "Marka", qiymat: marka, majburiy: true },
      { nomi: "Narx", qiymat: narx, majburiy: true },
    ])) return;

    if (narx <= 0) return xatoKorsatish("Narx 0 dan katta bo'lishi kerak");

    try {
      await tovarQoshish({ tur_id, model_kodi, model, marka, narx, soni: 0 });
      muvaffaqiyatKorsatish("Tovar muvaffaqiyatli qo'shildi");
      document.getElementById("qoshish-kod").value = "";
      document.getElementById("qoshish-model").value = "";
      document.getElementById("qoshish-marka").value = "";
      document.getElementById("qoshish-narx").value = "";
      _tovarlarKesh = [];
    } catch (e) {
      xatoKorsatish(e.message);
    }
  });

  /* --- 02 QIDIRUV eventlari --- */
  document.getElementById("qidiruv-tur").addEventListener("change", qidiruvIshla);
  document.getElementById("qidiruv-model").addEventListener("change", qidiruvIshla);
  document.getElementById("qidiruv-matn").addEventListener("input", qidiruvIshla);

  /* --- 04 OMBORGA KIRIM --- */
  document.getElementById("kirim-saqlash").addEventListener("click", async () => {
    const kod = document.getElementById("kirim-kod").value.trim();
    const soni = Number(document.getElementById("kirim-soni").value);
    const izoh = document.getElementById("kirim-izoh").value.trim();

    if (!validatsiyaTekshir([
      { nomi: "Model kodi", qiymat: kod, majburiy: true },
      { nomi: "Soni", qiymat: soni, majburiy: true },
    ])) return;
    if (soni <= 0) return xatoKorsatish("Soni 0 dan katta bo'lishi kerak");

    try {
      const tovar = _tovarlarKesh.find((t) => t.model_kodi === kod);
      if (!tovar) return xatoKorsatish("Bunday model kodi topilmadi");

      await kirimQoshish({ tovar_id: tovar.id, soni, izoh: izoh || null });
      muvaffaqiyatKorsatish("Kirim muvaffaqiyatli qo'shildi");
      document.getElementById("kirim-kod").value = "";
      document.getElementById("kirim-soni").value = "";
      document.getElementById("kirim-izoh").value = "";
      _tovarlarKesh = [];
      yuklaOmborKirim();
    } catch (e) {
      xatoKorsatish(e.message);
    }
  });

  /* --- 05 TAHRIRLASH eventlari --- */
  document.getElementById("tahrir-tur").addEventListener("change", tahrirIshla);
  document.getElementById("tahrir-model").addEventListener("change", tahrirIshla);
  document.getElementById("tahrir-qidiruv").addEventListener("input", tahrirIshla);

  // Jadvaldagi tahrirlash / o'chirish
  document.getElementById("tahrir-tbody").addEventListener("click", async (e) => {
    const tahrirId = e.target.dataset.tahrir;
    const ochirId = e.target.dataset.ochirish;

    if (tahrirId) {
      const t = _tovarlarKesh.find((x) => String(x.id) === tahrirId);
      if (!t) return;
      document.getElementById("tm-kod").value = t.model_kodi;
      document.getElementById("tm-model").value = t.model;
      document.getElementById("tm-marka").value = t.marka || "";
      document.getElementById("tm-narx").value = t.narx;
      document.getElementById("tm-soni").value = t.soni;
      document.getElementById("tahrir-modal-overlay").classList.remove("yashirin");
      document.getElementById("tahrir-modal-overlay").dataset.id = tahrirId;
    }

    if (ochirId) {
      const ok = await tasdiqlash("Bu tovarni o'chirishni tasdiqlaysizmi?");
      if (!ok) return;
      try {
        await tovarOchirish(Number(ochirId));
        muvaffaqiyatKorsatish("Tovar arxivlandi");
        _tovarlarKesh = [];
        yuklaTahrirlash();
      } catch (err) {
        xatoKorsatish(err.message);
      }
    }
  });

  // Tahrirlash modal
  document.getElementById("tm-bekor").addEventListener("click", () => {
    document.getElementById("tahrir-modal-overlay").classList.add("yashirin");
  });
  document.getElementById("tm-saqlash").addEventListener("click", async () => {
    const id = Number(document.getElementById("tahrir-modal-overlay").dataset.id);
    const model_kodi = document.getElementById("tm-kod").value.trim();
    const model = document.getElementById("tm-model").value.trim();
    const marka = document.getElementById("tm-marka").value.trim();
    const narx = Number(document.getElementById("tm-narx").value);
    const soni = Number(document.getElementById("tm-soni").value);

    if (!validatsiyaTekshir([
      { nomi: "Model kodi", qiymat: model_kodi, majburiy: true },
      { nomi: "Model", qiymat: model, majburiy: true },
    ])) return;
    if (narx < 0 || soni < 0) return xatoKorsatish("Narx va soni manfiy bo'lmasin");

    try {
      await tovarTahrirlash(id, { model_kodi, model, marka, narx, soni });
      muvaffaqiyatKorsatish("Tovar yangilandi");
      document.getElementById("tahrir-modal-overlay").classList.add("yashirin");
      _tovarlarKesh = [];
      yuklaTahrirlash();
    } catch (e) {
      xatoKorsatish(e.message);
    }
  });

  /* --- 06 TOVAR SOTUVI eventlari --- */
  document.getElementById("sotuv-kod").addEventListener("input", (e) => {
    const kod = e.target.value.trim();
    const t = _tovarlarKesh.find((x) => x.model_kodi === kod);
    if (t) {
      _sotuvTovar = t;
      document.getElementById("sotuv-mavjud").value = `${t.soni} ta`;
      if (!document.getElementById("sotuv-narx").value) {
        document.getElementById("sotuv-narx").value = t.narx;
      }
    } else {
      _sotuvTovar = null;
      document.getElementById("sotuv-mavjud").value = "—";
    }
  });

  document.querySelectorAll('input[name="sotuv-tolov"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      document
        .getElementById("sotuv-mijoz-guruh")
        .classList.toggle("yashirin", e.target.value !== "nasiya");
    });
  });

  document.getElementById("sotuv-saqlash").addEventListener("click", async () => {
    if (!_sotuvTovar) return xatoKorsatish("Model kodini tanlang");

    const soni = Number(document.getElementById("sotuv-soni").value);
    const sotuv_narxi = Number(document.getElementById("sotuv-narx").value);
    const tolov_turi = document.querySelector('input[name="sotuv-tolov"]:checked').value;
    const mijoz_id = document.getElementById("sotuv-mijoz").value;

    if (soni <= 0) return xatoKorsatish("Soni 0 dan katta bo'lishi kerak");
    if (sotuv_narxi <= 0) return xatoKorsatish("Sotuv narxi 0 dan katta bo'lishi kerak");
    if (soni > _sotuvTovar.soni) return xatoKorsatish("Omborda yetarli tovar yo'q");
    if (tolov_turi === "nasiya" && !mijoz_id) return xatoKorsatish("Nasiya uchun mijoz tanlanishi shart");

    try {
      await sotuvQoshish({
        tovar_id: _sotuvTovar.id,
        soni,
        sotuv_narxi,
        tolov_turi,
        mijoz_id: tolov_turi === "nasiya" ? Number(mijoz_id) : null,
      });
      muvaffaqiyatKorsatish("Sotuv muvaffaqiyatli yakunlandi");
      document.getElementById("sotuv-kod").value = "";
      document.getElementById("sotuv-soni").value = "";
      document.getElementById("sotuv-narx").value = "";
      document.getElementById("sotuv-mavjud").value = "—";
      _sotuvTovar = null;
      _tovarlarKesh = [];
    } catch (e) {
      xatoKorsatish(e.message);
    }
  });

  /* --- 06.1 XIZMAT SOTUVI eventlari --- */
  document.querySelectorAll('input[name="xizmat-tolov"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      document
        .getElementById("xizmat-mijoz-guruh")
        .classList.toggle("yashirin", e.target.value !== "nasiya");
    });
  });

  document.getElementById("xizmat-saqlash").addEventListener("click", async () => {
    const xizmat_nomi = document.getElementById("xizmat-nomi").value.trim();
    const narxi = Number(document.getElementById("xizmat-narx").value);
    const izoh = document.getElementById("xizmat-izoh").value.trim();
    const tolov_turi = document.querySelector('input[name="xizmat-tolov"]:checked').value;
    const mijoz_id = document.getElementById("xizmat-mijoz").value;

    if (!validatsiyaTekshir([
      { nomi: "Xizmat nomi", qiymat: xizmat_nomi, majburiy: true },
      { nomi: "Narxi", qiymat: narxi, majburiy: true },
    ])) return;
    if (narxi <= 0) return xatoKorsatish("Narx 0 dan katta bo'lishi kerak");
    if (tolov_turi === "nasiya" && !mijoz_id) return xatoKorsatish("Nasiya uchun mijoz tanlanishi shart");

    try {
      await xizmatSotuvQoshish({
        xizmat_nomi,
        narxi,
        izoh: izoh || null,
        tolov_turi,
        mijoz_id: tolov_turi === "nasiya" ? Number(mijoz_id) : null,
      });
      muvaffaqiyatKorsatish("Xizmat sotuvi saqlandi");
      document.getElementById("xizmat-nomi").value = "";
      document.getElementById("xizmat-narx").value = "";
      document.getElementById("xizmat-izoh").value = "";
      yuklaXizmatSotuvi();
    } catch (e) {
      xatoKorsatish(e.message);
    }
  });

  /* --- 07 XARAJAT eventlari --- */
  document.getElementById("xarajat-saqlash").addEventListener("click", async () => {
    const nomi = document.getElementById("xarajat-nomi").value.trim();
    const miqdori = Number(document.getElementById("xarajat-miqdor").value);
    const tolov_turi = document.querySelector('input[name="xarajat-tolov"]:checked').value;
    const izoh = document.getElementById("xarajat-izoh").value.trim();

    if (!validatsiyaTekshir([
      { nomi: "Xarajat nomi", qiymat: nomi, majburiy: true },
      { nomi: "Miqdori", qiymat: miqdori, majburiy: true },
    ])) return;
    if (miqdori <= 0) return xatoKorsatish("Miqdor 0 dan katta bo'lishi kerak");

    try {
      await xarajatQoshish({ nomi, miqdori, tolov_turi, izoh: izoh || null });
      muvaffaqiyatKorsatish("Xarajat qo'shildi");
      document.getElementById("xarajat-nomi").value = "";
      document.getElementById("xarajat-miqdor").value = "";
      document.getElementById("xarajat-izoh").value = "";
      yuklaXarajat();
    } catch (e) {
      xatoKorsatish(e.message);
    }
  });

  /* --- 08 MOSLIK eventlari --- */
  document.getElementById("mos-qoshish").addEventListener("click", async () => {
    const tur_id = document.getElementById("mos-tur").value;
    const asosiyModel = document.getElementById("mos-asosiy-model").value.trim();
    const asosiyMarka = document.getElementById("mos-asosiy-marka").value.trim();
    const mosModel = document.getElementById("mos-model").value.trim();
    const mosMarka = document.getElementById("mos-marka").value.trim();

    // 1. Bo'sh maydon
    if (!validatsiyaTekshir([
      { nomi: "Tovar turi", qiymat: tur_id, majburiy: true },
      { nomi: "Asosiy model", qiymat: asosiyModel, majburiy: true },
      { nomi: "Asosiy marka", qiymat: asosiyMarka, majburiy: true },
      { nomi: "Mos model", qiymat: mosModel, majburiy: true },
      { nomi: "Mos marka", qiymat: mosMarka, majburiy: true },
    ])) return;

    // 3. Asosiy bilan bir xil emasmi
    if (asosiyModel.toLowerCase() === mosModel.toLowerCase() &&
        asosiyMarka.toLowerCase() === mosMarka.toLowerCase()) {
      return xatoKorsatish("Mos model asosiy model bilan bir xil bo'lmasin");
    }

    try {
      // Asosiy tovarni topish (model + marka bo'yicha)
      const asosiyTovar = _tovarlarKesh.find(
        (t) =>
          t.model.toLowerCase() === asosiyModel.toLowerCase() &&
          (t.marka || "").toLowerCase() === asosiyMarka.toLowerCase()
      );
      if (!asosiyTovar) return xatoKorsatish("Asosiy model omborda topilmadi. Avval tovar qo'shing");

      // Mos tovarni topish
      let mosTovar = _tovarlarKesh.find(
        (t) =>
          t.model.toLowerCase() === mosModel.toLowerCase() &&
          (t.marka || "").toLowerCase() === mosMarka.toLowerCase()
      );

      // Agar mos tovar topilmasa, yaratamiz
      if (!mosTovar) {
        const kod = "MOS-" + Date.now().toString().slice(-6);
        mosTovar = await tovarQoshish({
          tur_id: Number(tur_id),
          model_kodi: kod,
          model: mosModel,
          marka: mosMarka,
          narx: 0,
          soni: 0,
        });
        _tovarlarKesh = [];
      }

      // Dublikat tekshiruvi
      const { data: mavjud } = await supabaseClient
        .from("mosliklar")
        .select("id")
        .eq("asosiy_tovar_id", asosiyTovar.id)
        .eq("mos_tovar_id", mosTovar.id)
        .maybeSingle();
      if (mavjud) return xatoKorsatish("Bu moslik allaqachon qo'shilgan");

      await moslikQoshish(asosiyTovar.id, mosTovar.id);
      muvaffaqiyatKorsatish("Moslik qo'shildi");
      document.getElementById("mos-model").value = "";
      document.getElementById("mos-marka").value = "";
      yuklaMoslik();
    } catch (e) {
      xatoKorsatish(e.message);
    }
  });

  document.getElementById("mos-tbody").addEventListener("click", async (e) => {
    const ochirId = e.target.dataset.mosOchirish;
    if (ochirId) {
      const ok = await tasdiqlash("Bu moslikni o'chirishni tasdiqlaysizmi?");
      if (!ok) return;
      const { error } = await supabaseClient.from("mosliklar").delete().eq("id", ochirId);
      if (error) return xatoKorsatish(error.message);
      muvaffaqiyatKorsatish("Moslik o'chirildi");
      yuklaMoslik();
    }
  });

  /* --- 09 MIJOZLAR eventlari --- */
  document.getElementById("mijoz-qidiruv").addEventListener("input", yuklaMijozlar);

  document.getElementById("mijoz-yangi").addEventListener("click", () => {
    document.getElementById("mm-ism").value = "";
    document.getElementById("mm-telefon").value = "";
    document.getElementById("mijoz-modal-overlay").classList.remove("yashirin");
  });

  document.getElementById("mm-bekor").addEventListener("click", () => {
    document.getElementById("mijoz-modal-overlay").classList.add("yashirin");
  });

  document.getElementById("mm-saqlash").addEventListener("click", async () => {
    const ism = document.getElementById("mm-ism").value.trim();
    const telefon = document.getElementById("mm-telefon").value.trim();
    if (!validatsiyaTekshir([
      { nomi: "Ism", qiymat: ism, majburiy: true },
      { nomi: "Telefon", qiymat: telefon, majburiy: true },
    ])) return;
    try {
      await mijozQoshish({ ism, telefon });
      muvaffaqiyatKorsatish("Mijoz qo'shildi");
      document.getElementById("mijoz-modal-overlay").classList.add("yashirin");
      yuklaMijozlar();
    } catch (e) {
      xatoKorsatish(e.message);
    }
  });

  // Batafsil
  document.getElementById("mijoz-tbody").addEventListener("click", async (e) => {
    const id = e.target.dataset.mijozBatafsil;
    if (!id) return;
    try {
      const nasiyalar = await nasiyalarniOlish(Number(id));
      const royxat = document.getElementById("batafsil-royxat");
      if (!nasiyalar.length) {
        royxat.innerHTML = '<div class="nasiya-qator"><div class="nasiya-info">Aktiv qarz yo\'q</div></div>';
      } else {
        royxat.innerHTML = nasiyalar
          .map((n) => {
            const qoldiq = n.summa - (n.tolov_summasi || 0);
            return `<div class="nasiya-qator">
              <div class="nasiya-info">
                Summa: <strong>${formatSum(n.summa)}</strong> ·
                To'langan: ${formatSum(n.tolov_summasi || 0)} ·
                Qoldiq: <strong style="color:#dc2626">${formatSum(qoldiq)}</strong>
              </div>
              <div class="nasiya-tolash">
                <input type="number" min="1" placeholder="To'lov summasi" id="tolov-${n.id}">
                <button class="btn btn-asosiy" data-tolash="${n.id}">To'lash</button>
              </div>
            </div>`;
          })
          .join("");
      }
      document.getElementById("batafsil-modal-overlay").classList.remove("yashirin");
    } catch (err) {
      xatoKorsatish(err.message);
    }
  });

  document.getElementById("batafsil-yopish").addEventListener("click", () => {
    document.getElementById("batafsil-modal-overlay").classList.add("yashirin");
  });

  document.getElementById("batafsil-royxat").addEventListener("click", async (e) => {
    const nasiyaId = e.target.dataset.tolash;
    if (!nasiyaId) return;
    const input = document.getElementById(`tolov-${nasiyaId}`);
    const summa = Number(input.value);
    if (!summa || summa <= 0) return xatoKorsatish("To'lov summasini kiriting");
    try {
      await nasiyaTolash(Number(nasiyaId), summa);
      muvaffaqiyatKorsatish("To'lov qabul qilindi");
      // Batafsilni yangilash uchun qayta ochamiz (oddiy usul)
      const mijozBtn = document.querySelector("[data-mijoz-batafsil]");
      // yopamiz, keyin mijozlarni yangilaymiz
      document.getElementById("batafsil-modal-overlay").classList.add("yashirin");
      yuklaMijozlar();
    } catch (err) {
      xatoKorsatish(err.message);
    }
  });

  /* --- Boshlang'ich sahifa --- */
  navigatsiyaYukla("sahifa-01");
});