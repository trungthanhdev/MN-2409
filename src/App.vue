<script setup lang="ts">
import { ref, computed, watch, defineComponent } from "vue";

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

// sync m <-> cm
watch(heightM,  v => { heightCM.value = Math.round(toNum(v) * 100) || 0; });
watch(heightCM, v => { heightM.value  = toNum(v) / 100; });

// --- Body metrics ---
const bmi = computed(() =>
  heightM.value ? toNum(weight.value) / (heightM.value ** 2) : 0
);
const bmiLabel = computed(() => {
  const b = bmi.value;
  if (b < 18.5) return "Underweight";
  if (b < 25)   return "Normal";
  if (b < 30)   return "Overweight";
  return "Obese";
});
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

  // Protein/kg thực tế (dựa trên TDEE và % user nhập)
const proteinPerKgActual = computed(() => {
  const w = toNum(weight.value, 0);
  if (!w) return 0;
  return proteinG.value / w; // g protein / kg
});

// Cảnh báo nếu <1.6 hoặc >2.2 g/kg
const proteinWarning = computed(() => {
  const p = proteinPerKgActual.value;
  if (!p) return "";
  if (p < 1.6) return `⚠️ Protein hơi THẤP (${p.toFixed(2)} g/kg). Khuyến nghị 1.6 – 2.2 g/kg.`;
  if (p > 2.2) return `⚠️ Protein hơi CAO (${p.toFixed(2)} g/kg). Khuyến nghị 1.6 – 2.2 g/kg.`;
  return "";
});


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

// --- Persistence ---
const KEY = "meal-planner-v1";
function saveToLocal() {
  const data = {
    gender: gender.value, age: age.value, heightM: heightM.value, heightCM: heightCM.value,
    weight: weight.value, activity: activity.value, preset: preset.value, macros: macros.value,
    proteinPerKg: proteinPerKg.value
  };
  localStorage.setItem(KEY, JSON.stringify(data));
  alert("Đã lưu cấu hình vào trình duyệt.");
}
function loadFromLocal() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return;
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
  } catch {}
}
function resetAll() {
  if (!confirm("Đặt lại về mặc định?")) return;
  gender.value = "male"; age.value = 22; heightM.value = 1.7; heightCM.value = 170;
  weight.value = 85; activity.value = 1.375;
  preset.value = "maintenance"; macros.value = { p: 25, c: 45, f: 30 }; proteinPerKg.value = 1.8;
}
loadFromLocal();
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-slate-800">
    <!-- Header -->
    <header class="sticky top-0 z-20 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-md">
      <div class="max-w-none px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="h-9 w-9 rounded-xl bg-white/15 grid place-items-center ring-1 ring-white/20 shrink-0">🍽️</div>
          <h1 class="text-[clamp(18px,2.5vw,22px)] font-semibold tracking-tight truncate">Macro and Nutrition</h1>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <button @click="resetAll" class="btn btn-ghost flex-1 sm:flex-none">Đặt lại</button>
          <button @click="saveToLocal" class="btn btn-primary flex-1 sm:flex-none">Lưu</button>
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
              <!-- <p v-if="proteinWarning"
   class="mt-2 text-sm font-medium rounded-xl p-3 border
          bg-amber-50 border-amber-200 text-amber-800">
  {{ proteinWarning }}
</p> -->
            </div>
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
</style>
