```vue
<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  defineComponent,
  onMounted,
  nextTick,
  type Ref,
} from "vue";
import * as XLSX from "xlsx";

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
  return m.p * 4 + m.c * 4 + m.f * 9;
}

function useDebouncedSuggestions(r: MealRow, delay = 300) {
  const suggestions = ref<Food[]>([]);
  let timeout: any;

  const updateSuggestions = (newValue: string) => {
    clearTimeout(timeout);
    if (!newValue) {
      suggestions.value = [];
      return;
    }
    timeout = setTimeout(() => {
      suggestions.value = suggestFoods(newValue);
    }, delay);
  };

  watch(() => r.name, updateSuggestions, { immediate: true });

  return suggestions;
}

function calcTotalsNow() {
  return rowsMeal.value.reduce(
    (acc, r) => {
      const m = rowMacro(r);
      acc.p += m.p;
      acc.c += m.c;
      acc.f += m.f;
      acc.kcal += m.p * 4 + m.c * 4 + m.f * 9;
      return acc;
    },
    { p: 0, c: 0, f: 0, kcal: 0 }
  );
}

const gender = ref<"male" | "female">("male");
const age = ref(0);
const heightM = ref(0);
const heightCM = ref(0);
const weight = ref(0);
const activity = ref(1.2);

const activities = [
  { label: "Sedentary", value: 1.2 },
  { label: "Light (1-3 buổi/tuần)", value: 1.375 },
  { label: "Moderate (3-5 buổi/tuần)", value: 1.55 },
  { label: "Active (6-7 buổi/tuần)", value: 1.725 },
  { label: "Very Active", value: 1.9 },
];

const preset = ref<"maintenance" | "bulking" | "cutting" | "custom">(
  "maintenance"
);
const macros = ref({ p: 35, c: 30, f: 35 });
const proteinPerKg = ref(1.8);

function toNum(v: unknown, fallback = 0) {
  if (typeof v === "string") v = v.replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeMealRows(raw: any): { name: string; grams: number }[] {
  if (!Array.isArray(raw)) return [{ name: "", grams: 0 }];
  const rows = raw
    .map((r) => ({
      name: typeof r?.name === "string" ? r.name : "",
      grams: Number.isFinite(Number(r?.grams)) ? Number(r.grams) : 0,
    }))
    .filter((r) => r.name.trim() !== "" || r.grams > 0);

  return rows.length ? rows : [{ name: "", grams: 0 }];
}

watch(heightM, (v) => {
  heightCM.value = Math.round(toNum(v) * 100) || 0;
});
watch(heightCM, (v) => {
  heightM.value = toNum(v) / 100;
});

const bmi = computed(() =>
  heightM.value ? toNum(weight.value) / heightM.value ** 2 : 0
);

const bmiInfo = computed(() => {
  const h = toNum(heightM.value);
  const w = toNum(weight.value);
  const b = h ? w / (h * h) : 0;

  let status = "Underweight",
    bad = true,
    tone: "ok" | "warn" | "bad" = "bad";
  if (b >= 30) {
    status = "Obese";
    bad = true;
    tone = "bad";
  } else if (b >= 25) {
    status = "Overweight";
    bad = true;
    tone = "warn";
  } else if (b >= 18.5) {
    status = "Normal";
    bad = false;
    tone = "ok";
  }

  const normalMin = h ? 18.5 * h * h : 0;
  const normalMax = h ? 24.9 * h * h : 0;

  const targetW = h ? 22 * h * h : 0;
  const delta = targetW ? w - targetW : 0;

  const rangeText =
    normalMin && normalMax
      ? `Khoảng cân nặng tiêu chuẩn: ${normalMin.toFixed(
          1
        )}–${normalMax.toFixed(1)} kg`
      : "";
  const deltaText = targetW
    ? Math.abs(delta) < 0.1
      ? "Bạn đang rất gần BMI 22."
      : delta > 0
      ? `Nên giảm ~${Math.abs(delta).toFixed(1)} kg để về BMI 22.`
      : `Nên tăng ~${Math.abs(delta).toFixed(1)} kg để về BMI 22.`
    : "";

  return {
    status,
    bad,
    tone,
    rangeText,
    deltaText,
  };
});

const ibw = computed(() => 22 * heightM.value ** 2);

const bmr = computed(() => {
  const kg = toNum(weight.value);
  const cm = toNum(heightCM.value);
  const a = toNum(age.value);
  if (!kg || !cm || !a) return 0;
  return gender.value === "male"
    ? 10 * kg + 6.25 * cm - 5 * a + 5
    : 10 * kg + 6.25 * cm - 5 * a - 161;
});

const tdee = computed(() => {
  const base = toNum(bmr.value, 0);
  const act = toNum(activity.value, 1);
  return base * (act || 1);
});

const macrosEffective = computed(() => macros.value);
const sumPctEff = computed(
  () =>
    macrosEffective.value.p + macrosEffective.value.c + macrosEffective.value.f
);

const proteinG = computed(
  () => (tdee.value * (macrosEffective.value.p / 100)) / 4
);
const carbG = computed(
  () => (tdee.value * (macrosEffective.value.c / 100)) / 4
);
const fatG = computed(() => (tdee.value * (macrosEffective.value.f / 100)) / 9);

function applyPreset() {
  if (preset.value === "bulking") macros.value = { p: 35, c: 40, f: 25 };
  else if (preset.value === "maintenance")
    macros.value = { p: 35, c: 30, f: 35 };
  else if (preset.value === "cutting") macros.value = { p: 40, c: 30, f: 30 };
}

type Food = {
  id?: number;
  name: string;
  protein: number;
  carb: number;
  fat: number;
};

function mkKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function makeAliases(name: string): string[] {
  const raw = name.trim();
  const m = raw.match(/\(([^)]+)\)/);
  const vi = raw.replace(/\s*\([^)]*\)\s*/g, "").trim();
  const en = m?.[1]?.trim();

  const arr = [raw];
  if (vi && vi !== raw) arr.push(vi);
  if (en) arr.push(en);
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

  function scoreConfig(
    table: string[][],
    cfg: { name: number; type: number; value: number; unit?: number }
  ) {
    let ok = 0,
      total = 0;
    for (let i = 1; i < table.length; i++) {
      const row = table[i];
      if (!row) continue;
      const name = String(row[cfg.name] ?? "").trim();
      const type = String(row[cfg.type] ?? "").toLowerCase();
      const value = toNumLoose(row[cfg.value]);
      if (!name || !value) continue;
      if (!/(protein|carb|fat|lipid|glucid|đạm|béo|tinh bột)/i.test(type))
        continue;
      ok++;
      total++;
    }
    return { ok, total };
  }

  const map = new Map<string, Food>();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const table = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: "",
    }) as string[][];
    if (!Array.isArray(table) || table.length === 0) continue;

    const headerRowIdx = table.findIndex((row) => {
      const h = (row ?? []).map((x) =>
        String(x)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim()
      );
      return h.includes("name") && h.includes("type") && h.includes("value");
    });

    let idxName = -1,
      idxType = -1,
      idxValue = -1,
      idxUnit = -1;
    let startRow = 1;

    if (headerRowIdx >= 0) {
      const headers = table[headerRowIdx] ?? [];
      const norm = headers.map((h) => String(h).toLowerCase().trim());
      idxName = norm.findIndex((h) => h.includes("name"));
      idxType = norm.findIndex((h) => h.includes("type"));
      idxValue = norm.findIndex((h) => h.includes("value"));
      idxUnit = norm.findIndex((h) => h.includes("unit"));
      startRow = headerRowIdx + 1;
    } else {
      const candidates: {
        name: number;
        type: number;
        value: number;
        unit: number;
      }[] = [
        { name: 2, type: 3, value: 4, unit: 5 },
        { name: 1, type: 2, value: 3, unit: 4 },
        { name: 2, type: 4, value: 5, unit: 3 },
      ];
      let best:
          | { name: number; type: number; value: number; unit: number }
          | undefined = candidates[0],
        bestScore = -1;
      for (const c of candidates) {
        const { ok } = scoreConfig(table, c);
        if (ok > bestScore) {
          bestScore = ok;
          best = c;
        }
      }

      if (!best) {
        throw new Error(
          `[${sheetName}] Không suy luận được cấu hình cột phù hợp`
        );
      }
      idxName = best.name;
      idxType = best.type;
      idxValue = best.value;
      idxUnit = best.unit ?? -1;
      startRow = 1;
      console.log(`[${sheetName}] picked columns:`, {
        idxName,
        idxType,
        idxValue,
        idxUnit,
        score: bestScore,
      });
    }

    for (let i = startRow; i < table.length; i++) {
      const row = table[i];
      if (!row) continue;
      const name = String(row[idxName] ?? "").trim();
      const type = String(row[idxType] ?? "").toLowerCase();
      const value = toNumLoose(row[idxValue]);

      if (!name || !value) continue;

      if (!map.has(name))
        map.set(name, { id: map.size + 1, name, protein: 0, carb: 0, fat: 0 });
      const rec = map.get(name)!;
      if (/(protein|đạm)/i.test(type)) rec.protein += value;
      else if (/(carb|glucid|tinh bột|carbohydrate)/i.test(type))
        rec.carb += value;
      else if (/(fat|lipid|béo)/i.test(type)) rec.fat += value;
    }
  }

  const arr = [...map.values()];
  console.log("foods loaded (robust):", arr.length, arr.slice(0, 5));

  const idx: Array<{ id: number; key: string; name: string }> = [];
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
    loadFromLocal();
  } catch (e) {
    console.error(e);
  }
});

type MealRow = { name: string; grams: number };
const rowsMeal = ref<MealRow[]>([{ name: "", grams: 0 }]);

const debouncedSuggestions = ref<Array<Ref<Food[]>>>([]);
const showSuggestions = ref<boolean[]>([]);

watch(
  rowsMeal,
  (newRows) => {
    debouncedSuggestions.value = newRows.map((r) => useDebouncedSuggestions(r));
    showSuggestions.value = new Array(newRows.length).fill(false);
  },
  { deep: true, immediate: true }
);

const addRow = () => {
  rowsMeal.value.push({ name: "", grams: 0 });
  showSuggestions.value.push(false);
};

const removeRow = (i: number) => {
  rowsMeal.value.splice(i, 1);
  debouncedSuggestions.value.splice(i, 1);
  showSuggestions.value.splice(i, 1);
};

function resetSuggestions() {
  showSuggestions.value = showSuggestions.value.map(() => false);
}

function findFood(q: string): Food | undefined {
  const key = mkKey(q);
  if (!key) return;

  const idx: Array<{ id: number; key: string; name: string }> =
    (window as any).__foodsIndex || [];

  const exact = idx.find((e) => e.key === key);
  if (exact) return foodsDB.value.find((f) => f.id === exact.id);

  const starts = idx.find((e) => e.key.startsWith(key));
  if (starts) return foodsDB.value.find((f) => f.id === starts.id);

  const any = idx.find((e) => e.key.includes(key));
  if (any) return foodsDB.value.find((f) => f.id === any.id);
}

function suggestFoods(q: string, limit = 6): Food[] {
  const key = mkKey(q);
  if (!key) return [];
  const idx: Array<{ id: number; key: string; name: string }> =
    (window as any).__foodsIndex || [];

  const scored = idx
    .map((e) => {
      let score = 0;
      if (e.key === key) score = 100;
      else if (e.key.startsWith(key)) score = 50;
      else if (e.key.includes(key)) score = 10;
      return { ...e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.name.length - b.name.length);

  const seen = new Set<number>();
  const out: Food[] = [];
  for (const s of scored) {
    if (seen.has(s.id)) continue;
    const f = foodsDB.value.find((x) => x.id === s.id);
    if (f) {
      out.push(f);
      seen.add(s.id);
    }
    if (out.length >= limit) break;
  }

  return out;
}

function rowMacro(r: MealRow) {
  const f = findFood(r.name);
  if (!f || !r.grams) return { p: 0, c: 0, f: 0, found: false };
  const factor = r.grams / 100;
  return {
    p: f.protein * factor,
    c: f.carb * factor,
    f: f.fat * factor,
    found: true,
  };
}

const totalsMeal = computed(() =>
  rowsMeal.value.reduce(
    (acc, r) => {
      const m = rowMacro(r);
      acc.p += m.p;
      acc.c += m.c;
      acc.f += m.f;
      acc.kcal += m.p * 4 + m.c * 4 + m.f * 9;
      return acc;
    },
    { p: 0, c: 0, f: 0, kcal: 0 }
  )
);

const kcalNotice = computed(() => {
  const t = Number(tdee.value) || 0;
  const k = Number(totalsMeal.value.kcal) || 0;
  if (!t) return null;

  const diff = k - t;
  const pct = (diff / t) * 100;

  let tone: "ok" | "warn" | "bad" = "ok";
  if (Math.abs(pct) >= 20) tone = "bad";
  else if (Math.abs(pct) >= 10) tone = "warn";

  const text =
    diff === 0
      ? "Bằng TDEE."
      : diff > 0
      ? `Vượt TDEE ~${diff.toFixed(0)} kcal (${pct.toFixed(1)}%)`
      : `Thấp hơn TDEE ~${Math.abs(diff).toFixed(0)} kcal (${Math.abs(
          pct
        ).toFixed(1)}%)`;

  return { kcal: k, diff, pct, tone, text };
});

const KEY = "meal-planner-v1";
async function saveToLocal() {
  await nextTick();
  const foodsReady = foodsDB.value.length > 0;
  const totalsNow = calcTotalsNow();
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
  resetSuggestions();
}

const savedTotals = ref<{
  protein: number;
  carb: number;
  fat: number;
  kcal: number;
} | null>(null);

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw);

    gender.value = d.gender ?? gender.value;
    age.value = toNum(d.age, age.value);
    heightM.value = toNum(d.heightM, heightM.value);
    heightCM.value = toNum(d.heightCM, heightCM.value);
    weight.value = toNum(d.weight, weight.value);
    activity.value = toNum(d.activity, activity.value);
    preset.value = d.preset ?? preset.value;
    macros.value = d.macros ?? macros.value;
    proteinPerKg.value = toNum(d.proteinPerKg, proteinPerKg.value);

    if (d.rowsMeal) {
      rowsMeal.value = sanitizeMealRows(d.rowsMeal);
    }
    if (d.totals) {
      savedTotals.value = {
        protein: Number(d.totals.protein) || 0,
        carb: Number(d.totals.carb) || 0,
        fat: Number(d.totals.fat) || 0,
        kcal: Number(d.totals.kcal) || 0,
      };
    }
  } catch (e) {
    console.error("loadFromLocal error:", e);
  }
}

function resetAll() {
  if (!confirm("Đặt lại về mặc định?")) return;
  gender.value = "male";
  age.value = 0;
  heightM.value = 0;
  heightCM.value = 0;
  weight.value = 0;
  activity.value = 1.2;
  preset.value = "maintenance";
  macros.value = { p: 35, c: 30, f: 35 };
  proteinPerKg.value = 1.8;
  rowsMeal.value = [{ name: "", grams: 0 }];
  resetSuggestions();
}

loadFromLocal();
</script>

<template>
  <div class="min-h-screen bg-gray-100 font-sans">
    <!-- Header -->
    <header
  class="sticky top-0 z-20 bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg"
>
  <div class="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3">
    <!-- Hàng 1: Tiêu đề và Lịch tập -->
    <div class="flex justify-between items-center w-full">
      <h1 class="font-bold text-xl">Chế độ dinh dưỡng</h1>
      <router-link
        to="/schedule"
        class="bg-white text-teal-700 px-4 py-2 rounded-full text-sm font-semibold shadow-md hover:bg-teal-50 transition-all duration-300"
        @click="resetSuggestions"
      >
        Lịch tập
      </router-link>
    </div>

    <!-- Hàng 2: Đặt lại & Lưu -->
   <div class="flex gap-4 w-full">
  <button
    @click="resetAll"
    class="btn btn-ghost flex-1 text-sm px-4 py-3"
  >
    Đặt lại
  </button>
  <button
    @click="saveToLocal"
    class="btn btn-primary flex-1 text-sm px-4 py-3"
  >
    Lưu
  </button>
</div>

  </div>
</header>


    <!-- Main -->
    <main class="max-w-5xl mx-auto px-2 py-4 space-y-8">
      <!-- Meal ratio -->
      <section class="card overflow-hidden">
        <div class="section-title">Điều chỉnh tỉ lệ</div>
        <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="space-y-3">
            <label class="label">Chọn mục tiêu (preset)</label>
            <select v-model="preset" @change="applyPreset" class="input h-11">
              <option value="maintenance">Duy trì</option>
              <option value="bulking">Bulking</option>
              <option value="cutting">Cutting</option>
              <!-- <option value="custom">Custom</option> -->
            </select>
            <p class="note">Bạn có thể chỉnh % thủ công dù chọn preset.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label class="label">Protein (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                v-model.number="macros.p"
                class="input h-11"
              />
            </div>
            <div>
              <label class="label">Carb (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                v-model.number="macros.c"
                class="input h-11"
              />
            </div>
            <div>
              <label class="label">Fat (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                v-model.number="macros.f"
                class="input h-11"
              />
            </div>
            <div class="sm:col-span-3 text-sm">
              Tổng:
              <span
                :class="
                  sumPctEff === 100
                    ? 'text-teal-600 font-semibold'
                    : 'text-rose-600 font-semibold'
                "
              >
                {{ sumPctEff.toFixed(1) }}%
              </span>
              <span v-if="sumPctEff !== 100" class="ml-2 text-rose-600"
                >(Cần = 100%)</span
              >
            </div>
          </div>
        </div>
      </section>

      <!-- Body Condition -->
      <section class="card overflow-hidden">
        <div class="section-title">Tình trạng hoặc mục tiêu cơ thể</div>
        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="label">Giới tính</label>
            <select v-model="gender" class="input h-11">
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>
          <div>
            <label class="label">Tuổi</label>
            <input
              type="number"
              min="10"
              max="100"
              v-model.number="age"
              class="input h-11"
            />
          </div>
          <div>
            <label class="label">Chiều cao (m)</label>
            <input
              type="number"
              step="0.01"
              min="1"
              max="2.5"
              v-model.number="heightM"
              class="input h-11"
            />
          </div>
          <div>
            <label class="label">Chiều cao (cm)</label>
            <input
              type="number"
              step="1"
              min="100"
              max="250"
              v-model.number="heightCM"
              class="input h-11"
            />
          </div>
          <div>
            <label class="label">Cân nặng (kg)</label>
            <input
              type="number"
              step="0.1"
              min="20"
              max="250"
              v-model.number="weight"
              class="input h-11"
            />
          </div>
          <div>
            <label class="label">Mức độ hoạt động</label>
            <select v-model.number="activity" class="input h-11">
              <option v-for="a in activities" :key="a.value" :value="a.value">
                {{ a.label }} ({{ a.value }})
              </option>
            </select>
          </div>

          <div
            class="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-2"
          >
            <Stat label="IBW (kg)" :value="ibw.toFixed(2)" />
            <Stat
              label="BMI"
              :value="bmi.toFixed(2)"
              :note="bmiInfo.status"
              :bad="bmiInfo.bad"
            />
            <Stat label="BMR" :value="bmr.toFixed(1)" />
            <Stat label="TDEE" :value="tdee.toFixed(2)" />
          </div>
          <div class="lg:col-span-3">
            <div
              :class="[
                'mt-1 p-3 rounded-xl border text-sm',
                bmiInfo.tone === 'bad'
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : '',
                bmiInfo.tone === 'warn'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : '',
                bmiInfo.tone === 'ok'
                  ? 'bg-teal-50 border-teal-200 text-teal-700'
                  : '',
              ]"
            >
              <div class="font-medium">
                BMI: {{ bmi.toFixed(2) }}, Tình trạng: {{ bmiInfo.status }}
              </div>
              <div v-if="bmiInfo.rangeText">{{ bmiInfo.rangeText }}</div>
              <div v-if="bmiInfo.deltaText">{{ bmiInfo.deltaText }}</div>
            </div>
          </div>

          <p class="note sm:col-span-2 lg:col-span-3">
            IBW (Ideal body weight): Cân nặng tiêu chuẩn không bao gồm mỡ
            (BMI mục tiêu ≈ 22).
          </p>
        </div>
      </section>

      <!-- Meal Plan -->
      <section class="card overflow-hidden">
        <div class="section-title">Kế hoạch dinh dưỡng</div>
        <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-3">
            <div
              class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5"
            >
              <label class="label">Calo mục tiêu (theo TDEE)</label>
              <div class="text-sm font-medium text-slate-700">
                {{ tdee.toFixed(0) }} kcal
              </div>
            </div>

            <p class="note">
              Lượng gram sẽ tính theo công thức: Protein = (TDEE × %)/4, Carb =
              (TDEE × %)/4, Fat = (TDEE × %)/9.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="card p-3">
                <div class="mini">Protein</div>
                <div class="kpi">
                  {{ proteinG.toFixed(2) }}<span class="unit">g</span>
                </div>
                <div class="mini">{{ macrosEffective.p.toFixed(1) }}%</div>
              </div>
              <div class="card p-3">
                <div class="mini">Carb</div>
                <div class="kpi">
                  {{ carbG.toFixed(2) }}<span class="unit">g</span>
                </div>
                <div class="mini">{{ macrosEffective.c.toFixed(1) }}%</div>
              </div>
              <div class="card p-3">
                <div class="mini">Fat</div>
                <div class="kpi">
                  {{ fatG.toFixed(2) }}<span class="unit">g</span>
                </div>
                <div class="mini">{{ macrosEffective.f.toFixed(1) }}%</div>
              </div>
            </div>

            <p class="mt-2 text-sm italic text-slate-500">
              Vui lòng tự chịu trách nhiệm cho các quyết định liên quan đến sức
              khỏe của bạn.
            </p>
          </div>

          <div class="space-y-3">
            <table
              class="w-full text-left text-sm border-separate border-spacing-y-2"
            >
              <tbody>
                <tr class="row">
                  <td class="cell muted">Protein (%)</td>
                  <td class="cell strong">
                    {{ macrosEffective.p.toFixed(1) }}%
                  </td>
                </tr>
                <tr class="row">
                  <td class="cell muted">Carb (%)</td>
                  <td class="cell strong">
                    {{ macrosEffective.c.toFixed(1) }}%
                  </td>
                </tr>
                <tr class="row">
                  <td class="cell muted">Fat (%)</td>
                  <td class="cell strong">
                    {{ macrosEffective.f.toFixed(1) }}%
                  </td>
                </tr>
                <tr class="row">
                  <td class="cell muted">Protein (gram)</td>
                  <td class="cell strong">{{ proteinG.toFixed(2) }}</td>
                </tr>
                <tr class="row">
                  <td class="cell muted">Carb (gram)</td>
                  <td class="cell strong">{{ carbG.toFixed(2) }}</td>
                </tr>
                <tr class="row">
                  <td class="cell muted">Fat (gram)</td>
                  <td class="cell strong">{{ fatG.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Nutrition -->
      <section class="card overflow-hidden">
        <div class="section-title">
          <div>Giá trị dinh dưỡng (USDA, FAO, FatSecret)</div>
        </div>

        <div class="p-4">
          <div class="table-shell">
            <table class="modern-table w-full table-fixed">
              <thead>
                <tr>
                  <th class="text-left">Tên món ăn</th>
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
                  <td class="cell-name" data-label="Food name">
                    <div class="space-y-1.5">
                      <input
                        v-model="r.name"
                        placeholder="Ví dụ: Ức gà, Cơm trắng…"
                        class="tbl-input w-full"
                        @input="showSuggestions[i] = true"
                        @focus="showSuggestions[i] = true"
                        @blur="showSuggestions[i] = false"
                      />
                      <div
                        v-if="
                          showSuggestions[i] &&
                          debouncedSuggestions[i]?.value?.length
                        "
                        class="flex flex-wrap gap-1.5"
                      >
                        <button
                          v-for="s in debouncedSuggestions[i].value"
                          :key="s.id ?? s.name"
                          @mousedown.prevent="
                            r.name = s.name;
                            showSuggestions[i] = false;
                          "
                          class="chip text-black"
                        >
                          {{ s.name }}
                        </button>
                      </div>
                      <div v-else-if="r.name && !findFood(r.name)" class="warn">
                        Không tìm thấy — thử gõ tên khác hoặc chọn gợi ý.
                      </div>
                    </div>
                  </td>
                  <td data-label="Gram">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      v-model.number="r.grams"
                      class="tbl-input text-center"
                      placeholder="0"
                    />
                  </td>
                  <td class="num text-slate-800" :data-label="'Protein (g)'">
                    {{ rowMacro(r).p.toFixed(1) }}
                  </td>
                  <td class="num text-slate-800" :data-label="'Carb (g)'">
                    {{ rowMacro(r).c.toFixed(1) }}
                  </td>
                  <td class="num text-slate-800" :data-label="'Fat (g)'">
                    {{ rowMacro(r).f.toFixed(1) }}
                  </td>
                  <td class="num text-slate-800" :data-label="'Kcal'">
                    {{ rowKcal(r).toFixed(1) }}
                  </td>
                  <td class="text-right text-slate-800" data-label="">
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
            </table>
            <div class="mt-3">
              <button @click="addRow" class="btn-elevate w-full sm:w-auto">
                + Thêm
              </button>
            </div>
            <div class="card mt-4 p-4 w-full">
              <div class="flex justify-between text-sm text-slate-500 mb-1">
                <span>Protein (g)</span>
                <span class="font-semibold text-slate-800">{{
                  totalsMeal.p.toFixed(1)
                }}</span>
              </div>
              <div class="flex justify-between text-sm text-slate-500 mb-1">
                <span>Carb (g)</span>
                <span class="font-semibold text-slate-800">{{
                  totalsMeal.c.toFixed(1)
                }}</span>
              </div>
              <div class="flex justify-between text-sm text-slate-500 mb-1">
                <span>Fat (g)</span>
                <span class="font-semibold text-slate-800">{{
                  totalsMeal.f.toFixed(1)
                }}</span>
              </div>
              <div
                class="flex justify-between text-sm text-slate-600 font-bold"
              >
                <span>Kcal</span>
                <span>{{ totalsMeal.kcal.toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <div
            v-if="kcalNotice"
            :class="[
              'mt-3 rounded-xl border p-3 text-sm',
              kcalNotice.tone === 'bad'
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : '',
              kcalNotice.tone === 'warn'
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : '',
              kcalNotice.tone === 'ok'
                ? 'bg-teal-50 border-teal-200 text-teal-700'
                : '',
            ]"
          >
            <div class="font-medium">
              Tổng năng lượng: {{ totalsMeal.kcal.toFixed(0) }} kcal
            </div>
            <div>
              So với TDEE ({{ tdee.toFixed(0) }} kcal): {{ kcalNotice.text }}
            </div>
          </div>

          <p
            class="mt-3 text-sm text-slate-500 italic leading-relaxed border-t border-slate-200 pt-3"
          >
            <strong>Lưu ý:</strong>
            Thông tin dinh dưỡng chỉ mang tính chất tham khảo, không thay thế tư
            vấn y tế hoặc chế độ ăn do chuyên gia khuyến nghị. Tất cả thực phẩm
            thực tế đều chứa cả protein, carb và fat ở mức độ khác nhau. Công
            thức tính: (gram / 100) × giá trị trên 100 g; Kcal = protein/carb(g)
            × 4 + fat(g) × 9.
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
.card {
  @apply bg-white/80 backdrop-blur border border-gray-200 shadow-sm rounded-2xl p-1;
}
.section-title {
  @apply px-4 py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white font-semibold tracking-wide rounded-xl;
}
.label {
  @apply block text-[13px] font-medium text-slate-700;
}
.note {
  @apply text-[12px] text-slate-500;
}

.input {
  @apply mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2
         text-[14px] text-slate-800 shadow-sm outline-none
         focus:border-teal-400 focus:ring-2 focus:ring-teal-300 transition;
}
.btn {
  @apply inline-flex items-center justify-center rounded-full px-3.5 py-2.5 text-[14px]
         font-semibold transition shadow-sm;
}
.btn-primary {
  @apply bg-white text-teal-700 hover:bg-teal-50 active:scale-95;
}
.btn-ghost {
  @apply bg-white/10 text-white hover:bg-white/15 ring-1 ring-white/20;
}

.mini {
  @apply text-[12px] text-slate-500;
}
.kpi {
  @apply mt-1 text-2xl font-semibold text-slate-800;
}
.unit {
  @apply text-[12px] ml-1 text-slate-500;
}

.row {
  @apply rounded-xl bg-gray-50/80 border border-gray-200;
}
.cell {
  @apply p-2;
}
.cell.muted {
  @apply text-slate-500;
}
.cell.strong {
  @apply font-semibold text-slate-800;
}
.table-shell {
  overflow: visible !important;
}
.modern-table {
  min-width: 0 !important;
  table-layout: fixed;
  border-collapse: collapse;
  border: 1px solid #e2e8f0;
  width: 100%;
}

.modern-table th,
.modern-table td {
  border: 1px solid #e2e8f0;
  padding: 0.35rem 0.5rem;
}
.modern-table td,
.modern-table th {
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.force-light {
  color-scheme: light;
}
.tbl-input {
  background-color: #fff !important;
  color: #0f172a !important;
  border-color: #e2e8f0 !important;
  caret-color: #0f172a;
}
.tbl-input::placeholder {
  color: #94a3b8;
}

.cell-gram {
  vertical-align: top;
}

.gram-wrap {
  display: grid;
  gap: 0.4rem;
}

.gram-input {
  display: grid;
  grid-template-columns: 56px 56px 1fr 56px 56px;
  align-items: center;
  gap: 0.35rem;
}

.gram-field {
  height: 2.5rem;
  padding: 0 0.6rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.gram-field::-webkit-outer-spin-button,
.gram-field::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.stepper {
  min-width: 56px;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  text-wrap: nowrap;
  @apply rounded-lg border border-gray-200 bg-white text-slate-700
         hover:bg-gray-50 active:scale-95 transition;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.1px;
  line-height: 1;
}

.gram-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.gram-chips .chip {
  @apply border border-gray-200 bg-gray-50;
  padding: 0.25rem 0.5rem;
  font-size: 12px;
  line-height: 1.2;
}

.modern-table thead th {
  @apply bg-teal-600 text-white font-semibold;
  background-color: #0d9488;
  text-align: center;
}

.modern-table tbody tr:hover td {
  @apply bg-teal-50;
}

.modern-table tfoot td {
  @apply font-medium bg-gray-50;
}

.tbl-input {
  font-size: 13px;
}

.badge {
  padding: 0 6px;
  line-height: 1.4;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.btn-elevate {
  @apply inline-flex items-center gap-1 rounded-full bg-teal-600 text-white
         px-3.5 h-9 text-[14px] font-semibold shadow-md
         hover:bg-teal-700 active:scale-95 transition;
}

.icon-btn {
  @apply inline-flex items-center justify-center
         h-8 w-8 rounded-lg border border-gray-200 bg-white
         text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200
         active:scale-95 transition;
}

.chip {
  @apply px-2 py-1 rounded-lg border border-gray-200 bg-gray-50
         text-[12px] hover:bg-teal-100 active:scale-95 transition;
}

.warn {
  @apply text-[12px] text-amber-700 bg-amber-50 border border-amber-200
         px-2 py-1 rounded-lg;
}

@media (min-width: 641px) {
  .modern-table thead th:nth-child(1) {
    width: 34%;
    text-align: left;
  }
  .modern-table thead th:nth-child(2) {
    width: 100px;
    text-align: center;
  }
  .modern-table thead th:nth-child(3),
  .modern-table thead th:nth-child(4),
  .modern-table thead th:nth-child(5),
  .modern-table thead th:nth-child(6) {
    width: 13%;
    text-align: right;
  }
  .modern-table thead th:last-child {
    width: 48px;
  }

  .modern-table td:nth-child(2) {
    text-align: center;
  }
  .modern-table td:nth-child(3),
  .modern-table td:nth-child(4),
  .modern-table td:nth-child(5),
  .modern-table td:nth-child(6) {
    text-align: right;
  }
}

.badge-warn {
  @apply bg-amber-50 text-amber-800 border-amber-200;
}
.badge-bad {
  @apply bg-rose-50 text-rose-700 border-rose-200;
}

@media (max-width: 640px) {
  .modern-table {
    border: 0;
  }
  .modern-table tfoot tr {
    display: block;
    width: 100%;
  }
  .modern-table tfoot td {
    display: block;
    width: 100%;
  }
  .modern-table thead {
    display: none;
  }

  .modern-table,
  .modern-table tbody,
  .modern-table tr,
  .modern-table td {
    display: block;
    width: 100%;
  }

  .modern-table tr {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    padding: 2px;
    margin-bottom: 10px;
  }

  .modern-table td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border: 0;
    background: transparent;
    padding: 6px 4px;
  }

  .modern-table td::before {
    content: attr(data-label);
    font-size: 12px;
    color: #64748b;
  }

  .modern-table td.cell-name {
    display: block;
    padding: 4px 4px 8px;
  }
  .modern-table td.cell-name::before {
    content: none;
  }

  .modern-table td.num {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    text-align: right;
  }

  .modern-table td[data-label="Kcal"] {
    font-weight: 700;
    font-size: 18px;
  }

  .modern-table td:last-child {
    padding-top: 6px;
    display: flex;
    justify-content: flex-end;
  }

  .modern-table tbody tr:hover td {
    background: transparent;
  }

  .modern-table tfoot tr {
    display: block;
    padding: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    background: #f8fafc;
    margin-top: 0.75rem;
  }

  .modern-table tfoot td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0.35rem;
    border: 0;
  }

  .modern-table tfoot td::before {
    content: attr(data-label);
    font-size: 13px;
    font-weight: 500;
    color: #475569;
  }

  .modern-table tfoot td.num {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    font-size: 14px;
    color: #0f172a;
  }

  .modern-table tfoot td[data-label="Kcal"] {
    font-weight: 700;
    font-size: 16px;
    color: #111827;
  }
}
</style>
```
