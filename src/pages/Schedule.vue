```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";

interface Exercise {
  id: number;
  order: number;
  name: string;
  setsReps: string;
  weight?: string;
  focus: string;
  tips?: string;
  selected?: boolean;
  note?: string;
}

interface WorkoutGroup {
  title: string;
  exercises: Exercise[];
}

const initialWorkoutGroups: WorkoutGroup[] = [
  {
    title: "Chest",
    exercises: [
      { id: 1, order: 1, name: "Bài tập 1", setsReps: "5x10", weight: "20kg", focus: "Body" }
    ]
  },
  {
    title: "Back",
    exercises: [
      { id: 1, order: 1, name: "Bài tập 1", setsReps: "3x10", weight: "35kg", focus: "Body" }
    ]
  }
];

const workoutGroups = ref<WorkoutGroup[]>([]);

// Load data from localStorage on mount
onMounted(() => {
  const savedData = localStorage.getItem("workoutGroups");
  if (savedData) {
    workoutGroups.value = JSON.parse(savedData);
  } else {
    workoutGroups.value = initialWorkoutGroups;
  }
});

// Save data to localStorage
function saveToLocalStorage() {
  localStorage.setItem("workoutGroups", JSON.stringify(workoutGroups.value));
}

const showModal = ref(false);
const newGroupTitle = ref("");

function addExercise(group: WorkoutGroup) {
  group.exercises.push({
    id: group.exercises.length + 1,
    order: group.exercises.length + 1,
    name: "",
    setsReps: "",
    weight: "",
    focus: "",
    note: "",
    selected: false
  });
}

function openAddWorkoutGroupModal() {
  newGroupTitle.value = "";
  showModal.value = true;
}

function addWorkoutGroup() {
  if (newGroupTitle.value.trim()) {
    workoutGroups.value.push({
      title: newGroupTitle.value.trim(),
      exercises: []
    });
    showModal.value = false;
    newGroupTitle.value = "";
  }
}

function closeModal() {
  showModal.value = false;
  newGroupTitle.value = "";
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 font-sans">
    <!-- Header -->
    <header class="bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 class="font-bold text-xl flex items-center gap-3">
          <!-- <span class="text-2xl">🏋️</span>  -->
          Chế độ tập luyện
        </h1>
        <div class="flex gap-3">
          <router-link
            to="/"
            class="bg-white text-teal-700 px-4 py-2 rounded-full text-sm font-semibold shadow-md hover:bg-teal-50 transition-all duration-300"
          >
            Dinh dưỡng
          </router-link>
        </div>
      </div>
    </header>

    <!-- Main -->
    <main class="max-w-5xl mx-auto px-2 py-4 space-y-8">
      <!-- Buttons: Save and Add New Day -->
     <div class="mt-4 border-t border-slate-200 pt-3">
  <p class="text-sm text-slate-500 italic leading-relaxed">
    <strong class="text-slate-700">Lưu ý:</strong>
    Trong tập luyện để đạt được kết quả mong muốn, thì 
    <span class="font-bold text-slate-700">70%</span> đến từ việc ăn uống 
    và <span class="font-bold text-slate-700">30%</span> đến từ việc tập luyện. 
    Hãy đảm bảo bạn có một kế hoạch dinh dưỡng hợp lý và chương trình luyện tập phù hợp.
  </p>
  <div class="flex justify-end gap-3 mt-4">
    <button
      @click="saveToLocalStorage"
      class="px-4 py-2 bg-teal-600 text-white rounded-full text-sm font-semibold shadow-md hover:bg-teal-700 active:scale-95 transition-all duration-300"
    >
      Lưu
    </button>
    <button
      @click="openAddWorkoutGroupModal"
      class="px-4 py-2 bg-teal-600 text-white rounded-full text-sm font-semibold shadow-md hover:bg-teal-700 active:scale-95 transition-all duration-300"
    >
      + Thêm lịch tập
    </button>
  </div>
</div>


      <!-- Modal for Adding New Workout Group -->
      <div
        v-if="showModal"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <div class="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Thêm lịch tập</h3>
          <input
            v-model="newGroupTitle"
            class="w-full detail-input text-center bg-gray-50 rounded-lg mb-3"
            placeholder="Tên buổi tập"
          />
          <div class="flex justify-end gap-3">
            <button
              @click="closeModal"
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-300 transition-all duration-200"
            >
              Huỷ
            </button>
            <button
              @click="addWorkoutGroup"
              class="px-4 py-2 bg-teal-600 text-white rounded-full text-sm font-semibold shadow-md hover:bg-teal-700 transition-all duration-200"
            >
              Thêm
            </button>
          </div>
        </div>
      </div>

      <div
        v-for="group in workoutGroups"
        :key="group.title"
        class="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-2xl"
      >
        <!-- Group Title -->
        <h2 class="px-6 py-4 bg-gradient-to-r from-teal-600 to-teal-500 text-white font-semibold text-lg tracking-tight">
          {{ group.title }}
        </h2>

        <!-- Exercises -->
        <div class="divide-y divide-gray-100">
          <div
            v-for="ex in group.exercises"
            :key="ex.id"
            class="p-2 pt-6  hover:bg-gray-50 transition-all duration-200 space-y-4"
          >
            <!-- Row 1: Order + Name -->
            <div class="flex items-center gap-4">
              <input
                v-model="ex.order"
                type="number"
                class="order-input w-16 text-center bg-gray-50 rounded-lg"
                placeholder="#"
              />
              <input
                v-model="ex.name"
                class="detail-input flex-1 bg-gray-50 rounded-lg"
                placeholder="Tên bài tập"
              />
            </div>

            <!-- Row 2: Additional Info -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
              <div class="flex items-center gap-3">
                <span class="field-label">Tạ:</span>
                <input
                  v-model="ex.weight"
                  class="detail-input text-center bg-gray-50 rounded-lg"
                  placeholder="20kg"
                />
              </div>
              <div class="flex items-center gap-3">
                <span class="field-label">Sets & Reps:</span>
                <input
                  v-model="ex.setsReps"
                  class="detail-input text-center bg-gray-50 rounded-lg"
                  placeholder="3x10"
                />
              </div>
              <div class="flex items-center gap-3">
                <span class="field-label">Nhóm cơ:</span>
                <input
                  v-model="ex.focus"
                  class="detail-input text-center bg-gray-50 rounded-lg"
                  placeholder="Nhóm cơ"
                />
              </div>
              <div class="flex items-center gap-3 col-span-1 sm:col-span-2 lg:col-span-1">
                <span class="field-label">Ghi chú:</span>
                <textarea
  v-model="ex.note"
  class="detail-input flex-1 bg-gray-50 rounded-lg p-2 resize-none"
  placeholder="Ghi chú"
  rows="3"
/>
              </div>
            </div>
          </div>
        </div>

        <!-- Add new -->
        <div class="p-6 bg-gray-50">
          <button
            @click="addExercise(group)"
            class="w-full px-4 py-3 bg-teal-600 text-white rounded-full text-sm font-semibold shadow-md hover:bg-teal-700 active:scale-95 transition-all duration-300"
          >
            + Add Exercise
          </button>
        </div>
        
      </div>
       <div class="text-center text-[12px] text-slate-500">
        Copyrights © 2025 by @trungthanhdev.
      </div>
    </main>
  </div>
</template>

<style scoped>
.order-input {
  @apply border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700
         focus:outline-none focus:ring-2 focus:ring-teal-300 transition-all duration-200;
}

.exercise-name {
  @apply border-b border-gray-200 text-base font-medium 
         focus:outline-none focus:border-teal-400 placeholder-teal-500
         py-2 transition-all duration-200;
}

.detail-input {
  @apply flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700
         focus:outline-none focus:ring-2 focus:ring-teal-300 placeholder-teal-500
         transition-all duration-200;
}

.field-label {
  @apply text-gray-500 font-medium text-sm;
}

/* Smooth hover and focus effects */
input:focus, button:focus {
  @apply outline-none;
}

/* Custom checkbox styling */
input[type="checkbox"] {
  @apply cursor-pointer transition-all duration-200;
}

/* Button hover and active states */
button:hover {
  @apply shadow-lg;
}

button:active {
  @apply shadow-sm;
}
</style>
```