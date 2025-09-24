import { createRouter, createWebHistory } from "vue-router";

// import các trang
import Schedule from "@/pages/Schedule.vue";
import Home from "@/pages/Home.vue";    
const routes = [
  { path: "/", name: "Home", component: Home },
  { path: "/schedule", name: "Schedule", component: Schedule }
];
export const router = createRouter({
  history: createWebHistory(),
  routes,
});
