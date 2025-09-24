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
      { id: 1, order: 1, name: "Incline barbell press", setsReps: "5x10", weight: "40kg", focus: "Upper chest" },
      { id: 2, order: 2, name: "Cable chest press", setsReps: "3x15", weight: "25kg", focus: "Upper/Middle chest" },
      { id: 3, order: 3, name: "Decline chest press", setsReps: "3x10", weight: "50kg", focus: "Lower chest", tips: "Slow, negative ROM" }
    ]
  },
  {
    title: "Back",
    exercises: [
      { id: 1, order: 1, name: "Wide grip lat pull down", setsReps: "3x10", weight: "35kg", focus: "Lat" },
      { id: 2, order: 2, name: "Dumbbell row", setsReps: "3x10", weight: "20kg", focus: "Thicker back" }
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
          Workout Schedule
        </h1>
        <div class="flex gap-3">
          <router-link
            to="/"
            class="bg-white text-teal-700 px-4 py-2 rounded-full text-sm font-semibold shadow-md hover:bg-teal-50 transition-all duration-300"
          >
            Trang chủ
          </router-link>
        </div>
      </div>
    </header>

    <!-- Main -->
    <main class="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <!-- Buttons: Save and Add New Day -->
      <div class="flex justify-end gap-3">
        <button
          @click="saveToLocalStorage"
          class="px-4 py-3 bg-teal-600 text-white rounded-full text-sm font-semibold shadow-md hover:bg-teal-700 active:scale-95 transition-all duration-300"
        >
          Lưu
        </button>
        <button
          @click="openAddWorkoutGroupModal"
          class="px-4 py-3 bg-teal-600 text-white rounded-full text-sm font-semibold shadow-md hover:bg-teal-700 active:scale-95 transition-all duration-300"
        >
          + Thêm lịch tập
        </button>
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
            class="p-6 hover:bg-gray-50 transition-all duration-200 space-y-4"
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
                placeholder="Exercise name"
              />
            </div>

            <!-- Row 2: Additional Info -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
              <div class="flex items-center gap-3">
                <span class="field-label">Tạ:</span>
                <input
                  v-model="ex.weight"
                  class="detail-input text-center bg-gray-50 rounded-lg"
                  placeholder="40kg"
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
                <span class="field-label">Focus:</span>
                <input
                  v-model="ex.focus"
                  class="detail-input text-center bg-gray-50 rounded-lg"
                  placeholder="Muscle"
                />
              </div>
              <div class="flex items-center gap-3 col-span-1 sm:col-span-2 lg:col-span-1">
                <span class="field-label">Notes:</span>
                <input
                  v-model="ex.note"
                  class="detail-input flex-1 bg-gray-50 rounded-lg"
                  placeholder="Your notes..."
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