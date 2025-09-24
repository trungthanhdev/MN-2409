<script setup lang="ts">
import { ref, computed, watch, defineComponent, onMounted, nextTick, type Ref } from "vue";
import * as XLSX from "xlsx"; 
// type Food = { id?: number; name: string; protein: number; carb: number; fat: number };
// --- Stat card ---
const Stat = defineComponent({
  name: "Stat",
  props: { label: String, value: String, note: String, bad: Boolean },
  template: `
    <div class="card p-4">
      <div class="text-[13px] text-slate-500">{{ label }}</div>
      <div :class="['mt-1 text-2xl font-semibold tracking-tight', bad?'text-rose-600':'text-slate-800']">{{ value }}</div>
      <div v-if="note" class="mt-1 text-[12px] text-slate-500">{{ note }}</div>
    </div>
  `,
});

function rowKcal(r: MealRow) {
  const m = rowMacro(r);
  // công thức kcal = protein*4 + carb*4 + fat*9
  return m.p * 4 + m.c * 4 + m.f * 9;
}
// function useSuggestions(r: MealRow) {
//   return computed(() => suggestFoods(r.name));
// }
// const rowSuggestions = computed(() =>
//   rowsMeal.value.map(r => suggestFoods(r.name))
// );
function useDebouncedSuggestions(r: MealRow, delay = 300) {
  const suggestions = ref<Food[]>([]);
  let timeout: any;

  watch(() => r.name, (newValue) => {
    clearTimeout(timeout);
    if (!newValue) {
      suggestions.value = [];
      return;
    }

    timeout = setTimeout(() => {
      suggestions.value = suggestFoods(newValue);  // Gọi hàm suggestFoods để tìm kiếm
    }, delay);
  });

  return suggestions;
}

function calcTotalsNow() {
  return rowsMeal.value.reduce(
    (acc, r) => {
      const m = rowMacro(r); // dùng đúng hàm bạn đang có
      acc.p    += m.p;
      acc.c    += m.c;
      acc.f    += m.f;
      acc.kcal += m.p * 4 + m.c * 4 + m.f * 9;
      return acc;
    },
    { p: 0, c: 0, f: 0, kcal: 0 }
  );
}
// ---- State ----
const gender   = ref<"male" | "female">("male");
const age      = ref(0);
const heightM  = ref(0);
const heightCM = ref(0);
const weight   = ref(0);
const activity = ref(1.2);

const activities = [
  { label: "Sedentary", value: 1.2 },
  { label: "Light (1-3 buổi/tuần)", value: 1.375 },
  { label: "Moderate (3-5 buổi/tuần)", value: 1.55 },
  { label: "Active (6-7 buổi/tuần)", value: 1.725 },
  { label: "Very Active", value: 1.9 },
];

const preset  = ref<"maintenance" | "bulking" | "cutting" | "custom">("maintenance");
const macros  = ref({ p: 35, c: 30, f: 35 });   // %
const proteinPerKg = ref(1.8);                 // chỉ để hiển thị tham khảo

function toNum(v: unknown, fallback = 0) {
  if (typeof v === 'string') v = v.replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function sanitizeMealRows(raw: any): { name: string; grams: number }[] {
  if (!Array.isArray(raw)) return [{ name: "", grams: 0 }];
  const rows = raw
    .map(r => ({
      name: typeof r?.name === "string" ? r.name : "",
      grams: Number.isFinite(Number(r?.grams)) ? Number(r.grams) : 0
    }))
    // bỏ dòng trống hoàn toàn
    .filter(r => r.name.trim() !== "" || r.grams > 0);

  return rows.length ? rows : [{ name: "", grams: 0 }];
}

// sync m <-> cm
watch(heightM,  v => { heightCM.value = Math.round(toNum(v) * 100) || 0; });
watch(heightCM, v => { heightM.value  = toNum(v) / 100; });

// --- Body metrics ---
const bmi = computed(() =>
  heightM.value ? toNum(weight.value) / (heightM.value ** 2) : 0
);

// --- BMI status & target ---
const bmiInfo = computed(() => {
  const h = toNum(heightM.value);
  const w = toNum(weight.value);
  const b = h ? w / (h * h) : 0;

  // WHO (chuẩn chung)
  let status = "Underweight", bad = true, tone: "ok" | "warn" | "bad" = "bad";
  if (b >= 30) { status = "Obese";       bad = true;  tone = "bad"; }
  else if (b >= 25) { status = "Overweight"; bad = true;  tone = "warn"; }
  else if (b >= 18.5) { status = "Normal";   bad = false; tone = "ok"; }

  // Khoảng cân nặng "bình thường" theo BMI 18.5–24.9
  const normalMin = h ? 18.5 * h * h : 0;
  const normalMax = h ? 24.9 * h * h : 0;

  // Mục tiêu BMI 22 (thường dùng làm IBW)
  const targetW = h ? 22 * h * h : 0;
  const delta = targetW ? (w - targetW) : 0; // dư (+) hoặc thiếu (-)

  // Text tiếng Việt ngắn gọn
  const rangeText = (normalMin && normalMax)
    ? `Khoảng cân nặng tiêu chuẩn: ${normalMin.toFixed(1)}–${normalMax.toFixed(1)} kg`
    : "";
  const deltaText = targetW
    ? (Math.abs(delta) < 0.1
        ? "Bạn đang rất gần BMI 22."
        : delta > 0
          ? `Nên giảm ~${Math.abs(delta).toFixed(1)} kg để về BMI 22.`
          : `Nên tăng ~${Math.abs(delta).toFixed(1)} kg để về BMI 22.`)
    : "";

  return {
    status, bad, tone,
    rangeText,
    deltaText
  };
});


const ibw = computed(() => 22 * (heightM.value ** 2));

const bmr = computed(() => {
  const kg = toNum(weight.value);
  const cm = toNum(heightCM.value);
  const a  = toNum(age.value);
  if (!kg || !cm || !a) return 0;
  return gender.value === "male"
    ? (10 * kg + 6.25 * cm - 5 * a + 5)
    : (10 * kg + 6.25 * cm - 5 * a - 161);
});
const tdee = computed(() => {
  const base = toNum(bmr.value, 0);
  const act  = toNum(activity.value, 1);
  return base * (act || 1);
});

// --- Macros (dùng trực tiếp % user nhập) ---
const macrosEffective = computed(() => macros.value);
const sumPctEff = computed(() =>
  macrosEffective.value.p + macrosEffective.value.c + macrosEffective.value.f
);

// --- Gram từ % ---
const proteinG = computed(() =>
  (tdee.value * (macrosEffective.value.p / 100)) / 4
);
const carbG = computed(() =>
  (tdee.value * (macrosEffective.value.c / 100)) / 4
);
const fatG = computed(() =>
  (tdee.value * (macrosEffective.value.f / 100)) / 9
);

// --- Preset ---
function applyPreset() {
  if (preset.value === "bulking")      macros.value = { p: 35, c: 40, f: 25 };
  else if (preset.value === "maintenance") macros.value = { p: 35, c: 30, f: 35 };
  else if (preset.value === "cutting") macros.value = { p: 40, c: 30, f: 30 };
}

type Food = { id?: number; name: string; protein: number; carb: number; fat: number };

function mkKey(s: string) {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g,"d").replace(/Đ/g,"D")
    .toLowerCase()
    .replace(/\s+/g," ")
    .trim();
}
function makeAliases(name: string): string[] {
  const raw = name.trim();
  const m = raw.match(/\(([^)]+)\)/);              // lấy phần trong ngoặc
  const vi = raw.replace(/\s*\([^)]*\)\s*/g, "").trim(); // tên bỏ ngoặc
  const en = m?.[1]?.trim();

  const arr = [raw];
  if (vi && vi !== raw) arr.push(vi);
  if (en) arr.push(en);
  // có thể tách theo "/" hoặc "," nếu bạn dùng
  return Array.from(new Set(arr));
}

function toNumLoose(v: any): number {
  if (v == null) return 0;
  return Number(String(v).replace(",", ".").trim()) || 0;
}
async function loadFoods(): Promise<Food[]> {
  const url = `${import.meta.env.BASE_URL}foods.xlsx?v=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Không tải được foods.xlsx (${res.status})`);

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  // helper: chấm điểm một cấu hình cột
  function scoreConfig(table: string[][], cfg: {name:number; type:number; value:number; unit?:number}) {
    let ok = 0, total = 0;
    for (let i = 1; i < table.length; i++) {
      const row = table[i]; if (!row) continue;
      const name  = String(row[cfg.name]  ?? "").trim();
      const type  = String(row[cfg.type]  ?? "").toLowerCase();
      const value = toNumLoose(row[cfg.value]);
      if (!name || !value) continue;
      if (!/(protein|carb|fat|lipid|glucid|đạm|béo|tinh bột)/i.test(type)) continue;
      ok++; total++;
    }
    return { ok, total };
  }

  // gom kết quả ở tất cả sheet
  const map = new Map<string, Food>();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]; if (!ws) continue;
    const table = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
    if (!Array.isArray(table) || table.length === 0) continue;

    // 1) thử tìm header Name/Type/Value
    const headerRowIdx = table.findIndex(row => {
      const h = (row ?? []).map(x => String(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim());
      return h.includes("name") && h.includes("type") && h.includes("value");
    });

    let idxName = -1, idxType = -1, idxValue = -1, idxUnit = -1;
    let startRow = 1;

    if (headerRowIdx >= 0) {
      const headers = table[headerRowIdx] ?? [];
      const norm = headers.map(h => String(h).toLowerCase().trim());
      idxName  = norm.findIndex(h => h.includes("name"));
      idxType  = norm.findIndex(h => h.includes("type"));
      idxValue = norm.findIndex(h => h.includes("value"));
      idxUnit  = norm.findIndex(h => h.includes("unit"));
      startRow = headerRowIdx + 1;
    } else {
     
      const candidates: { name: number; type: number; value: number; unit: number }[] = [
  { name: 2, type: 3, value: 4, unit: 5 }, // C,D,E,F
  { name: 1, type: 2, value: 3, unit: 4 }, // B,C,D,E
  { name: 2, type: 4, value: 5, unit: 3 }, // C,E,F,D (nếu thứ tự khác)
];
      let best : { name: number; type: number; value: number; unit: number } | undefined = candidates[0], bestScore = -1;
      for (const c of candidates) {
  const { ok } = scoreConfig(table, c);
  if (ok > bestScore) { bestScore = ok; best = c; }
}

if (!best) {
  throw new Error(`[${sheetName}] Không suy luận được cấu hình cột phù hợp`);
}
      idxName = best.name; idxType = best.type; idxValue = best.value; idxUnit = best.unit ?? -1;
      startRow = 1;
      // log debug để chắc ăn
      console.log(`[${sheetName}] picked columns:`, { idxName, idxType, idxValue, idxUnit, score: bestScore });
    }

    // 3) đọc dữ liệu theo cột đã chọn
    for (let i = startRow; i < table.length; i++) {
      const row = table[i]; if (!row) continue;
      const name  = String(row[idxName]  ?? "").trim();
      const type  = String(row[idxType]  ?? "").toLowerCase();
      const value = toNumLoose(row[idxValue]);
      // const unit  = idxUnit >= 0 ? String(row[idxUnit] ?? "").toLowerCase() : "";

      if (!name || !value) continue;
      // nếu bạn chỉ muốn lấy per100g thì mở dòng dưới:
      // if (unit && !unit.includes("per100")) continue;

      if (!map.has(name)) map.set(name, { id: map.size + 1, name, protein: 0, carb: 0, fat: 0 });
      const rec = map.get(name)!;
      if (/(protein|đạm)/i.test(type)) rec.protein += value;
      else if (/(carb|glucid|tinh bột|carbohydrate)/i.test(type)) rec.carb += value;
      else if (/(fat|lipid|béo)/i.test(type)) rec.fat += value;
    }
  }

  const arr = [...map.values()];
  console.log("foods loaded (robust):", arr.length, arr.slice(0, 5));

  // build index alias cho tìm kiếm (giữ nguyên cách bạn đang dùng)
  const idx: Array<{ id:number; key:string; name:string }> = [];
  for (const f of arr) {
    for (const alias of makeAliases(f.name)) {
      idx.push({ id: f.id!, key: mkKey(alias), name: f.name });
    }
  }
  (window as any).__foodsIndex = idx;

  return arr;
}



const foodsDB = ref<Food[]>([]);
onMounted(async () => {
  try {
    foodsDB.value = await loadFoods();
  } catch (e) {
    console.error(e);
  }
});

type MealRow = { name: string; grams: number };
const rowsMeal = ref<MealRow[]>([{ name: "", grams: 0 }]);
// const rowsMeal = ref<MealRow[]>([{ name: "", grams: 0 }]);

// ✅ Tạo suggestions cho từng row (debounce riêng)
const debouncedSuggestions = ref<Array<Ref<Food[]>>>([]);

watch(rowsMeal, (newRows) => {
  debouncedSuggestions.value = newRows.map(r => useDebouncedSuggestions(r));
}, { immediate: true});

const addRow = () => rowsMeal.value.push({ name: "", grams: 0 });
const removeRow = (i: number) => rowsMeal.value.splice(i, 1);

//Find, Suggest food
function findFood(q: string): Food | undefined {
  const key = mkKey(q);
  if (!key) return;

  // lấy index (từ window hoặc ref bạn lưu)
  const idx: Array<{id:number; key:string; name:string}> = (window as any).__foodsIndex || [];

  // exact trước
  const exact = idx.find(e => e.key === key);
  if (exact) return foodsDB.value.find(f => f.id === exact.id);

  // startsWith rồi includes
  const starts = idx.find(e => e.key.startsWith(key));
  if (starts) return foodsDB.value.find(f => f.id === starts.id);

  const any = idx.find(e => e.key.includes(key));
  if (any) return foodsDB.value.find(f => f.id === any.id);
}

function suggestFoods(q: string, limit = 6): Food[] {
  const key = mkKey(q);
  if (!key) return [];
  const idx: Array<{ id: number; key: string; name: string }> = (window as any).__foodsIndex || [];

  const scored = idx
    .map(e => {
      let score = 0;
      if (e.key === key) score = 100;
      else if (e.key.startsWith(key)) score = 50;
      else if (e.key.includes(key)) score = 10;
      return { ...e, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.name.length - b.name.length);

  // Trả về Food unique theo id
  const seen = new Set<number>();
  const out: Food[] = [];
  for (const s of scored) {
    if (seen.has(s.id)) continue;
    const f = foodsDB.value.find(x => x.id === s.id);
    if (f) {
      out.push(f);
      seen.add(s.id);
    }
    if (out.length >= limit) break;
  }

  return out;
}

// 
function rowMacro(r: MealRow) {
  const f = findFood(r.name);
  if (!f || !r.grams) return { p: 0, c: 0, f: 0, found: false };
  const factor = r.grams / 100; // vì dữ liệu là per 100g
  return { p: f.protein * factor, c: f.carb * factor, f: f.fat * factor, found: true };
}

const totalsMeal = computed(() =>
  rowsMeal.value.reduce(
    (acc, r) => {
      const m = rowMacro(r);
      acc.p    += m.p;
      acc.c    += m.c;
      acc.f    += m.f;
      acc.kcal += m.p * 4 + m.c * 4 + m.f * 9; // 🆕
      return acc;
    },
    { p: 0, c: 0, f: 0, kcal: 0 }
  )
);

const kcalNotice = computed(() => {
  const t = Number(tdee.value) || 0;
  const k = Number(totalsMeal.value.kcal) || 0;
  if (!t) return null;

  const diff = k - t;                 // >0: vượt TDEE, <0: thấp hơn
  const pct  = (diff / t) * 100;

  // mức độ: ±10% = warn, ±20% = bad
  let tone: "ok" | "warn" | "bad" = "ok";
  if (Math.abs(pct) >= 20) tone = "bad";
  else if (Math.abs(pct) >= 10) tone = "warn";

  const text =
    diff === 0
      ? "Bằng TDEE."
      : diff > 0
        ? `Vượt TDEE ~${diff.toFixed(0)} kcal (${pct.toFixed(1)}%)`
        : `Thấp hơn TDEE ~${Math.abs(diff).toFixed(0)} kcal (${Math.abs(pct).toFixed(1)}%)`;

  return { kcal: k, diff, pct, tone, text };
});



// --- Persistence ---
const KEY = "meal-planner-v1";
async function saveToLocal() {
  await nextTick();

  // nếu foods chưa load kịp thì totals sẽ = 0 — có thể cảnh báo nhẹ
  const foodsReady = foodsDB.value.length > 0;

  const totalsNow = calcTotalsNow(); // ✅ tổng “thời điểm lưu”
  const data = {
    gender: gender.value,
    age: age.value,
    heightM: heightM.value,
    heightCM: heightCM.value,
    weight: weight.value,
    activity: activity.value,
    preset: preset.value,
    macros: macros.value,
    proteinPerKg: proteinPerKg.value,
    // 🆕 lưu cả bữa ăn đang nhập
    rowsMeal: rowsMeal.value,
    totals: {
      protein: totalsNow.p,
      carb: totalsNow.c,
      fat: totalsNow.f,
      kcal: totalsNow.kcal,
    },
    foodsReady,  
  };
  localStorage.setItem(KEY, JSON.stringify(data));
  alert("Đã lưu cấu hình & bữa ăn vào trình duyệt.");
}
const savedTotals = ref<{ protein: number; carb: number; fat: number; kcal: number } | null>(null);
function loadFromLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw);

    gender.value   = d.gender   ?? gender.value;
    age.value      = toNum(d.age, age.value);
    heightM.value  = toNum(d.heightM, heightM.value);
    heightCM.value = toNum(d.heightCM, heightCM.value);
    weight.value   = toNum(d.weight, weight.value);
    activity.value = toNum(d.activity, activity.value);
    preset.value   = d.preset   ?? preset.value;
    macros.value   = d.macros   ?? macros.value;
    proteinPerKg.value = toNum(d.proteinPerKg, proteinPerKg.value);

    // 🆕 khôi phục danh sách món
    if (d.rowsMeal) {
      rowsMeal.value = sanitizeMealRows(d.rowsMeal);
    }
   if (d.totals) {
      savedTotals.value = {
    protein: Number(d.totals.protein) || 0,
    carb:    Number(d.totals.carb)    || 0,
    fat:     Number(d.totals.fat)     || 0,
    kcal:    Number(d.totals.kcal)    || 0,
  };
    }
  } catch (e) {
    console.error("loadFromLocal error:", e);
  }
}

function resetAll() {
  if (!confirm("Đặt lại về mặc định?")) return;
  gender.value = "male"; age.value = 0; heightM.value = 0; heightCM.value = 0;
  weight.value = 0; activity.value = 1.2;
  preset.value = "maintenance"; macros.value = { p: 35, c: 30, f: 35 }; proteinPerKg.value = 1.8;
}
loadFromLocal();
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
    <!-- Header -->
    <!-- Header -->
<header class="sticky top-0 z-20 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-md">
  <div class="max-w-none px-3 py-2 flex flex-wrap items-center justify-between gap-2">
    <div class="flex items-center gap-2 min-w-0">
      <div class="h-7 w-7 rounded-lg bg-white/15 grid place-items-center ring-1 ring-white/20 shrink-0">🍽️</div>
      <h1 class="text-[clamp(16px,2vw,18px)] font-semibold tracking-tight truncate">
        Macro and Nutrition
      </h1>
    </div>
    <!-- Giảm size nút & tăng khoảng cách -->
    <div class="flex items-center gap-4 w-full sm:w-auto">
      <button
        @click="resetAll"
        class="btn btn-ghost flex-1 sm:flex-none text-xs px-2 py-1"
      >
        Đặt lại
      </button>
      <button
        @click="saveToLocal"
        class="btn btn-primary flex-1 sm:flex-none text-xs px-2 py-1"
      >
        Lưu
      </button>
    </div>
  </div>
</header>



    <!-- Main -->
    <main class="max-w-none px-4 py-6 space-y-6">
      <!-- Meal ratio -->
      <section class="card overflow-hidden">
        <div class="section-title">Meal ratio</div>
        <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="space-y-3">
            <label class="label">Chọn mục tiêu (preset)</label>
            <select v-model="preset" @change="applyPreset" class="input h-11">
              <option value="maintenance">Maintenance</option>
              <option value="bulking">Bulking</option>
              <option value="cutting">Cutting</option>
              <option value="custom">Custom</option>
            </select>
            <p class="note">Bạn có thể chỉnh % thủ công dù chọn preset.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label class="label">Protein (%)</label>
              <input type="number" min="0" max="100" step="0.1" v-model.number="macros.p" class="input h-11">
            </div>
            <div>
              <label class="label">Carb (%)</label>
              <input type="number" min="0" max="100" step="0.1" v-model.number="macros.c" class="input h-11">
            </div>
            <div>
              <label class="label">Fat (%)</label>
              <input type="number" min="0" max="100" step="0.1" v-model.number="macros.f" class="input h-11">
            </div>
            <div class="sm:col-span-3 text-sm">
              Tổng:
              <span :class="sumPctEff===100 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'">
                {{ sumPctEff.toFixed(1) }}%
              </span>
              <span v-if="sumPctEff!==100" class="ml-2 text-rose-600">(Cần = 100%)</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Body Condition -->
      <section class="card overflow-hidden">
        <div class="section-title">Body Condition or Taget</div>
        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="label">Gender</label>
            <select v-model="gender" class="input h-11">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label class="label">Age</label>
            <input type="number" min="10" max="100" v-model.number="age" class="input h-11">
          </div>
          <div>
            <label class="label">Height (m)</label>
            <input type="number" step="0.01" min="1" max="2.5" v-model.number="heightM" class="input h-11">
          </div>
          <div>
            <label class="label">Height (cm)</label>
            <input type="number" step="1" min="100" max="250" v-model.number="heightCM" class="input h-11">
          </div>
          <div>
            <label class="label">Weight (kg)</label>
            <input type="number" step="0.1" min="20" max="250" v-model.number="weight" class="input h-11">
          </div>
          <div>
            <label class="label">Activity Level</label>
            <select v-model.number="activity" class="input h-11">
              <option v-for="a in activities" :key="a.value" :value="a.value">{{ a.label }} ({{ a.value }})</option>
            </select>
          </div>

          <div class="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-2">
            <Stat label="IBW (kg)" :value="ibw.toFixed(2)" />
            <!-- <Stat label="BMI" :value="bmi.toFixed(2)" :note="bmiLabel" :bad="bmi>=25 || bmi<18.5" />
               -->
              <Stat label="BMI"
                    :value="bmi.toFixed(2)"
                    :note="bmiInfo.status"
                    :bad="bmiInfo.bad" />
            <Stat label="BMR" :value="bmr.toFixed(1)" />
            <Stat label="TDEE" :value="tdee.toFixed(2)" />
          </div>
<div class="lg:col-span-3">
  <div
    :class="[
      'mt-1 p-3 rounded-xl border text-sm',
      bmiInfo.tone==='bad'  ? 'bg-rose-50  border-rose-200  text-rose-700'  : '',
      bmiInfo.tone==='warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : '',
      bmiInfo.tone==='ok'   ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''
    ]"
  >
    <div class="font-medium">BMI: {{ bmi.toFixed(2) }}, Tình trạng: {{ bmiInfo.status }} </div>
    <div v-if="bmiInfo.rangeText">{{ bmiInfo.rangeText }}</div>
    <div v-if="bmiInfo.deltaText">{{ bmiInfo.deltaText }}</div>
  </div>
</div>

          <p class="note sm:col-span-2 lg:col-span-3">
            IBW (Ideal body weight):  Cân nặng tiêu chuẩn không gồm bao gồm mỡ (BMI mục tiêu ≈ 22).
          </p>
        </div>
      </section>

      <!-- Meal Plan -->
      <section class="card overflow-hidden">
        <div class="section-title">Meal plan</div>
        <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <label class="label">Calo mục tiêu (theo TDEE)</label>
              <div class="text-sm font-medium text-slate-700">{{ tdee.toFixed(0) }} kcal</div>
            </div>

            <p class="note">
              Lượng gram sẽ tính theo công thức:
              Protein = (TDEE × %)/4, Carb = (TDEE × %)/4, Fat = (TDEE × %)/9.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="card p-3">
                <div class="mini">Protein</div>
                <div class="kpi">{{ proteinG.toFixed(2) }}<span class="unit">g</span></div>
                <div class="mini">{{ macrosEffective.p.toFixed(1) }}%</div>  
              </div>
              <div class="card p-3">
                <div class="mini">Carb</div>
                <div class="kpi">{{ carbG.toFixed(2) }}<span class="unit">g</span></div>
                <div class="mini">{{ macrosEffective.c.toFixed(1) }}%</div>
              </div>
              <div class="card p-3">
                <div class="mini">Fat</div>
                <div class="kpi">{{ fatG.toFixed(2) }}<span class="unit">g</span></div>
                <div class="mini">{{ macrosEffective.f.toFixed(1) }}%</div>
              </div>
            
            </div>
      
<p class="mt-2 text-sm italic text-slate-500">
  
  Vui lòng tự chịu trách nhiệm cho các quyết định liên quan đến sức khỏe của bạn.
</p>
          </div>

          <div class="space-y-3">
            <table class="w-full text-left text-sm border-separate border-spacing-y-2">
              <tbody>
                <tr class="row"><td class="cell muted">Protein (%)</td><td class="cell strong">{{ macrosEffective.p.toFixed(1) }}%</td></tr>
                <tr class="row"><td class="cell muted">Carb (%)</td><td class="cell strong">{{ macrosEffective.c.toFixed(1) }}%</td></tr>
                <tr class="row"><td class="cell muted">Fat (%)</td><td class="cell strong">{{ macrosEffective.f.toFixed(1) }}%</td></tr>
                <tr class="row"><td class="cell muted">Protein (gram)</td><td class="cell strong">{{ proteinG.toFixed(2) }}</td></tr>
                <tr class="row"><td class="cell muted">Carb (gram)</td><td class="cell strong">{{ carbG.toFixed(2) }}</td></tr>
                <tr class="row"><td class="cell muted">Fat (gram)</td><td class="cell strong">{{ fatG.toFixed(2) }}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>


<!-- Nutrition  -->
<section class="card overflow-hidden">
  <div class="section-title flex items-center justify-between">
    <div>Food Nutrition (USDA, FAO, FatSecret)</div>
  </div>

  <!-- datalist -->
  <!-- <datalist id="foods-list">
    <option v-for="f in foodsDB" :key="f.id ?? f.name" :value="f.name"></option>
  </datalist> -->

  <div class="p-4">
    <!-- overflow-x cho fallback, min-w giữ layout bảng trên màn hẹp nếu muốn kéo ngang -->
    <div class="table-shell">
      <table class="modern-table w-full table-fixed">
        <!-- <thead>
          <tr>
            <th class="w-[34%]">Food name</th>
            <th class="w-[90px] text-center">Gram</th>
            <th class="w-[13%] text-center">Protein (g)</th>
            <th class="w-[13%] text-center">Carb (g)</th>
            <th class="w-[13%] text-center">Fat (g)</th>
            <th class="w-[13%] text-center">Kcal</th>
            <th class="w-[48px]"></th>
          </tr>
        </thead> -->
        <thead>
  <tr>
    <th class="text-left">Food name</th>
    <th class="text-center">Gram</th>
    <th class="text-right">Protein (g)</th>
    <th class="text-right">Carb (g)</th>
    <th class="text-right">Fat (g)</th>
    <th class="text-right">Kcal</th>
    <th aria-label="Actions"></th>
  </tr>
</thead>

        <tbody>
          <tr v-for="(r, i) in rowsMeal" :key="i" class="group">
            <!-- Food name + suggestions -->
            <td class="cell-name" data-label="Food name">
              <div class="space-y-1.5">
                <input
  v-model="r.name"
  placeholder="Ví dụ: Ức gà, Cơm trắng…"
  class="tbl-input w-full"
/>

                <!-- Chips gợi ý -->
          <div v-if="debouncedSuggestions[i]?.value?.length" class="flex flex-wrap gap-1.5">
  <button
    v-for="s in debouncedSuggestions[i].value"
    :key="s.id ?? s.name"
    @click="r.name = s.name"
    class="chip"
  >
    {{ s.name }}
  </button>
</div>

                <!-- Cảnh báo -->
                <div
                  v-else-if="r.name && !findFood(r.name)"
                  class="warn"
                >
                  Không tìm thấy trong DB — thử gõ tên khác hoặc chọn gợi ý.
                </div>
              </div>
            </td>

            <!-- Gram -->
            <td data-label="Gram">
              <input
                type="number"
                min="0"
                step="1"
                v-model.number="r.grams"
                class="tbl-input text-right"
                placeholder="0"
              />
            </td>
           

            <!-- Macros -->
            <td class="num" :data-label="'Protein (g)'">{{ rowMacro(r).p.toFixed(1) }}</td>
            <td class="num" :data-label="'Carb (g)'">{{ rowMacro(r).c.toFixed(1) }}</td>
            <td class="num" :data-label="'Fat (g)'">{{ rowMacro(r).f.toFixed(1) }}</td>
            <td class="num" :data-label="'Kcal'">{{ rowKcal(r).toFixed(1) }}</td>

            <!-- Remove -->
            <td class="text-right" data-label="">
              <button
                @click="removeRow(i)"
                class="icon-btn"
                aria-label="Remove row"
                title="Xoá dòng"
              >
                ✕
              </button>
            </td>
          </tr>
        </tbody>


<!-- Nutrition table -->
<table class="modern-table w-full table-fixed">
  
</table>
<!-- Add button -->
<div class="mt-3">
  <button @click="addRow" class="btn-elevate w-full sm:w-auto">+ Thêm</button>
</div>

<!-- Totals card -->
<div class="card mt-4 p-4 w-full">
  <div class="flex justify-between text-sm text-slate-500 mb-1">
    <span>Protein (g)</span>
    <span class="font-semibold text-slate-800">{{ totalsMeal.p.toFixed(1) }}</span>
  </div>
  <div class="flex justify-between text-sm text-slate-500 mb-1">
    <span>Carb (g)</span>
    <span class="font-semibold text-slate-800">{{ totalsMeal.c.toFixed(1) }}</span>
  </div>
  <div class="flex justify-between text-sm text-slate-500 mb-1">
    <span>Fat (g)</span>
    <span class="font-semibold text-slate-800">{{ totalsMeal.f.toFixed(1) }}</span>
  </div>
  <div class="flex justify-between text-sm text-slate-600 font-bold">
    <span>Kcal</span>
    <span>{{ totalsMeal.kcal.toFixed(1) }}</span>
  </div>
</div>


      </table>
    </div>

    <div
      v-if="kcalNotice"
      :class="[
        'mt-3 rounded-xl border p-3 text-sm',
        kcalNotice.tone==='bad'  ? 'bg-rose-50  border-rose-200  text-rose-700'  : '',
        kcalNotice.tone==='warn' ? 'bg-amber-50 border-amber-200 text-amber-800' : '',
        kcalNotice.tone==='ok'   ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''
      ]"
    >
      <div class="font-medium">
        Tổng năng lượng: {{ totalsMeal.kcal.toFixed(0) }} kcal
      </div>
      <div>
        So với TDEE ({{ tdee.toFixed(0) }} kcal): {{ kcalNotice.text }}
      </div>
    </div>

    <p class="mt-3 text-sm text-slate-500 italic leading-relaxed border-t border-slate-200 pt-3">
      <strong>Lưu ý:</strong>  
      Thông tin dinh dưỡng chỉ mang tính chất tham khảo, không thay thế tư vấn y tế hoặc chế độ ăn do chuyên gia khuyến nghị.
      Tất cả thực phẩm thực tế đều chứa cả protein, carb và fat ở mức độ khác nhau.
      Công thức tính: (gram / 100) × giá trị trên 100 g; Kcal = protein/carb(g) × 4 + fat(g) × 9.
    </p>
  </div>
</section>



      <div class="text-center text-[12px] text-slate-500">
        Copyrights © 2025 by @trungthanhdev. 
      </div>
    </main>
  </div>
</template>

<style scoped>
.card { @apply bg-white/80 backdrop-blur border border-slate-200 shadow-sm rounded-2xl; }
.section-title { @apply px-4 py-3 bg-emerald-600/95 text-white font-semibold tracking-wide; }
.label { @apply block text-[13px] font-medium text-slate-700; }
.note  { @apply text-[12px] text-slate-500; }

.input {
  @apply mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2
         text-[14px] text-slate-800 shadow-sm outline-none
         focus:border-emerald-400 focus:ring-4 focus:ring-emerald-200/60 transition;
}
.btn {
  @apply inline-flex items-center justify-center rounded-xl px-3.5 py-2.5 text-[14px]
         font-semibold transition shadow-sm;
}
.btn-primary { @apply bg-white text-emerald-700 hover:bg-emerald-50 active:scale-[0.98]; }
.btn-ghost   { @apply bg-white/10 text-white hover:bg-white/15 ring-1 ring-white/20; }

.mini { @apply text-[12px] text-slate-500; }
.kpi  { @apply mt-1 text-2xl font-semibold text-slate-800; }
.unit { @apply text-[12px] ml-1 text-slate-500; }

.row  { @apply rounded-xl bg-slate-50/80 border border-slate-200; }
.cell { @apply p-2; }
.cell.muted  { @apply text-slate-500; }
.cell.strong { @apply font-semibold text-slate-800; }
.table-shell { overflow: visible !important; }
.modern-table { min-width: 0 !important; table-layout: fixed;   border-collapse: collapse;      /* gộp viền */
  border: 1px solid #cbd5e1;      /* slate-300 */
  width: 100%;}

/* Áp dụng chung cho bảng */
.modern-table th,
.modern-table td {
   border: 1px solid #cbd5e1; 
  padding: 0.35rem 0.5rem; /* nhỏ hơn */
}
.modern-table td,
.modern-table th {
  white-space: normal;
  word-break: break-word;     /* cắt từ dài */
  overflow-wrap: anywhere;    /* xuống hàng mọi nơi nếu cần */
}
.force-light { color-scheme: light; }
/* input luôn nền trắng, chữ đậm, placeholder dễ nhìn */
.tbl-input{
  background-color:#fff !important;
  color:#0f172a !important;            /* slate-900 */
  border-color:#e2e8f0 !important;     /* slate-200 */
  caret-color:#0f172a;
}
.tbl-input::placeholder{ color:#94a3b8; } /* slate-400 */

/* chống màu vàng/xanh của autofill iOS/Chrome */
/* input.tbl-input:-webkit-autofill,
input.tbl-input:-webkit-autofill:hover,
input.tbl-input:-webkit-autofill:focus{
  -webkit-box-shadow: 0 0 0px 1000px #fff inset !important;
  -webkit-text-fill-color:#0f172a !important;
} */

/* gram css */
.cell-gram { vertical-align: top; }

.gram-wrap { display: grid; gap: .4rem; }

.gram-input{
  display: grid;
  /* −10  −5  [input]  +5  +10  (chiều rộng nút cố định) */
  grid-template-columns: 56px 56px 1fr 56px 56px;
  align-items: center;
  gap: .35rem;
}

.gram-field{
  height: 2.5rem;
  padding: 0 .6rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  /* Ẩn spinner của input number cho gọn */
  /* -moz-appearance: textfield; */
}
.gram-field::-webkit-outer-spin-button,
.gram-field::-webkit-inner-spin-button{ -webkit-appearance: none; margin: 0; }

.stepper{
  /* kích thước & căn giữa text */
  min-width: 56px;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  /* không cho xuống dòng “-10” thành 2 hàng */
  white-space: nowrap;
  text-wrap: nowrap;

  /* style */
  @apply rounded-lg border border-slate-200 bg-white text-slate-700
         hover:bg-slate-50 active:scale-95 transition;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .1px;
  line-height: 1; /* giữ chữ không bị dãn theo height */
}

.gram-chips{ display:flex; flex-wrap:wrap; gap:.4rem; }
.gram-chips .chip{
  @apply border border-slate-200 bg-slate-50;
  padding: .25rem .5rem;          /* nhỏ gọn hơn */
  font-size: 12px;
  line-height: 1.2;
}
/* @media (max-width: 640px) {
    .gram-input{
    grid-template-columns: 52px 52px 1fr 52px 52px;
    gap: .3rem;
  }
  .stepper{ min-width: 52px; height: 2.25rem; font-size: 12px; }
  .gram-field{ height: 2.25rem; }
} */

/* Header nổi bật */
.modern-table thead th {
  @apply bg-emerald-600 text-white font-semibold;
   background-color: #059669; 
   text-align: center;   
}

/* Hover hàng */
.modern-table tbody tr:hover td {
  @apply bg-emerald-50;
}

/* Footer totals */
.modern-table tfoot td {
  @apply font-medium bg-slate-50;
}


/* Ô nhập gọn hơn */
.tbl-input { font-size: 13px; }

/* Badge cảnh báo gọn lại */
.badge { padding: 0 6px; line-height: 1.4; }

/* Gộp các cột số cho dễ nhìn hơn trên mobile */
.num { text-align: right; font-variant-numeric: tabular-nums; }

/* Nút + Thêm dòng: nổi nhẹ */
.btn-elevate {
  @apply inline-flex items-center gap-1 rounded-xl bg-emerald-600 text-white
         px-3.5 h-9 text-[14px] font-semibold shadow-sm
         hover:bg-emerald-700 active:scale-[0.98] transition;
}

/* Nút icon xoá */
.icon-btn {
  @apply inline-flex items-center justify-center
         h-8 w-8 rounded-lg border border-slate-200 bg-white
         text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200
         active:scale-95 transition;
}

/* Chip gợi ý */
.chip {
  @apply px-2 py-1 rounded-lg border border-slate-200 bg-slate-50
         text-[12px] hover:bg-slate-100 active:scale-95 transition;
}

/* Cảnh báo */
.warn {
  @apply text-[12px] text-amber-700 bg-amber-50 border border-amber-200
         px-2 py-1 rounded-lg;
}
@media (min-width: 641px){
  .modern-table thead th:nth-child(1){ width:34%; text-align:left; }
  .modern-table thead th:nth-child(2){ width:100px; text-align:center; }
  .modern-table thead th:nth-child(3),
  .modern-table thead th:nth-child(4),
  .modern-table thead th:nth-child(5),
  .modern-table thead th:nth-child(6){ width:13%; text-align:right; }
  .modern-table thead th:last-child{ width:48px; }

  .modern-table td:nth-child(2){ text-align:center; } /* Gram */
  .modern-table td:nth-child(3),
  .modern-table td:nth-child(4),
  .modern-table td:nth-child(5),
  .modern-table td:nth-child(6){ text-align:right; }   /* số đẹp & hàng thẳng */
}
.badge-warn { @apply bg-amber-50 text-amber-800 border-amber-200; }
.badge-bad  { @apply bg-rose-50  text-rose-700  border-rose-200; }
/* --- Mobile stack: < 640px --- */
/* Mobile: chuyển bảng -> card dưới 640px */
/* Mobile: bảng -> card dưới 640px, padding nhỏ và tự xuống hàng */
/* Mobile (<=640px): table -> card, nhãn trái / giá trị phải */
@media (max-width: 640px) {
  .modern-table{ border:0; }
 .modern-table tfoot tr {
    display: block;
    width: 100%;
  }
  .modern-table tfoot td {
    display: block;
    width: 100%;
  }
  .modern-table thead{ display:none; }

  .modern-table,
  .modern-table tbody,
  .modern-table tr,
  .modern-table td { display:block; width:100%; }

  .modern-table tr{
    background:#fff;
    border:1px solid #cbd5e1;
    border-radius:14px;
    box-shadow:0 1px 2px rgba(0,0,0,.03);
    padding:10px;
    margin-bottom:10px;
  }

  .modern-table td{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:8px;
    border:0;
    background:transparent;
    padding:6px 4px;
  }

  /* Nhãn cột lấy từ data-label */
  .modern-table td::before{
    content:attr(data-label);
    font-size:12px;
    color:#64748b; /* slate-500 */
  }

  /* Ô tên món full width, không nhãn */
  .modern-table td.cell-name{
    display:block;
    padding:4px 4px 8px;
  }
  .modern-table td.cell-name::before{ content:none; }

  /* Số đẹp, thẳng cột */
  .modern-table td.num{
    font-variant-numeric:tabular-nums;
    font-weight:600;
    text-align:right;
  }

  /* Nhấn mạnh Kcal */
  .modern-table td[data-label="Kcal"]{
    font-weight:700;
    font-size:18px;
  }

  /* Nút xoá nằm cuối, canh phải */
  .modern-table td:last-child{
    padding-top:6px;
    display:flex;
    justify-content:flex-end;
  }

  /* Loại hover xanh trên mobile (bị “sticky hover” ở iOS) */
  .modern-table tbody tr:hover td{ background:transparent; }

  .modern-table tfoot tr{
    display:block;
    padding:0.5rem;
    border:1px solid #e2e8f0;
    border-radius:0.75rem;
    background:#f8fafc;
    margin-top:0.75rem;
  }

  .modern-table tfoot td{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:0.25rem 0.35rem;
    border:0;
  }

  .modern-table tfoot td::before{
    content:attr(data-label);
    font-size:13px;
    font-weight:500;
    color:#475569; /* slate-600 */
  }

  .modern-table tfoot td.num{
    font-weight:600;
    font-variant-numeric:tabular-nums;
    font-size:14px;
    color:#0f172a;
  }

  /* Kcal nổi bật hơn */
  .modern-table tfoot td[data-label="Kcal"]{
    font-weight:700;
    font-size:16px;
    color:#111827;}
}

</style>


