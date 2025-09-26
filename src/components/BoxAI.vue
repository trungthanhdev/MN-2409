<template>
  <!-- floating button -->
<button
  @click="toggleChat"
  class="fixed bottom-6 right-6 w-14 h-14 flex items-center justify-center 
         rounded-full shadow-lg hover:scale-105 transition 
         z-50 border-2 border-teal-600 bg-white text-2xl"
>
  💬
</button>


  <!-- overlay (click outside to close + blur background) -->
  <div
    v-if="showChat"
    class="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
    @click="closeChat"
  ></div>

  <!-- chatbox -->
  <transition name="fade-slide">
    <div
      v-if="showChat"
      class="fixed bottom-20 right-6 w-[350px] h-[500px] flex flex-col border rounded-xl shadow-lg bg-white z-50"
      @click.stop
    >
      <!-- header -->
      <div
        class="flex justify-between items-center px-4 py-2 border-b bg-gradient-to-r from-teal-600 to-emerald-500 text-white font-bold rounded-t-xl"
      >
        Tư vấn tự động
        <button
          @click="closeChat"
          class="bg-transparent text-white transition-colors"
        >
          ✖
        </button>
      </div>

      <!-- messages -->
      <div class="messages flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        <div
          v-for="(m, i) in messages"
          :key="i"
          v-html="renderMessage(m.content)"
          :class="[
            'prose prose-sm px-4 py-2 rounded-2xl shadow-sm max-w-[85%] leading-relaxed',
            m.role === 'user'
              ? 'bg-teal-600 text-white self-end ml-auto rounded-br-none prose-invert'
              : 'bg-white text-gray-800 border border-gray-200 self-start mr-auto rounded-bl-none text-justify',
          ]"
        />
      </div>

      <!-- input -->
      <div
        class="input-bar flex items-center border-t p-2 gap-2 bg-white rounded-b-xl"
      >
        <input
          v-model="input"
          @keyup.enter="send"
          placeholder="Nhập tin nhắn..."
          class="bg-transparent flex-1 border rounded-full px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          @click="send"
          class="bg-teal-600 text-white px-5 py-2 rounded-full font-medium hover:bg-teal-700 transition"
        >
          Gửi
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, nextTick } from "vue";
import { askAI } from "@/utils/aiService.ts";
import { marked } from "marked";

type ChatMessage = { role: "user" | "ai"; content: string };

const input = ref("");
const messages = ref<ChatMessage[]>([]);
const showChat = ref(false);

function toggleChat() {
  showChat.value = !showChat.value;
}
function closeChat() {
  showChat.value = false;
}

function renderMessage(content: string) {
  return marked(content); // chuyển markdown → HTML
}

async function send() {
  if (!input.value.trim()) return;

  const userMsg = input.value;
  messages.value.push({ role: "user", content: userMsg });
  input.value = "";

  messages.value.push({ role: "ai", content: "..." });
  const aiIndex = messages.value.length - 1;

  try {
    const aiRes = await askAI(userMsg);
    messages.value[aiIndex]!.content = aiRes ?? "Xin lỗi, chưa có câu trả lời.";
  } catch (e) {
    console.error(e);
    messages.value[aiIndex]!.content = "⚠️ Lỗi khi gọi AI.";
  }

  await nextTick();
  const chatEl = document.querySelector(".messages");
  chatEl?.scrollTo({ top: chatEl.scrollHeight, behavior: "smooth" });
}
</script>

<style scoped>
/* animation mở chat */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
.messages::-webkit-scrollbar {
  width: 8px;              /* độ rộng scrollbar */
}

.messages::-webkit-scrollbar-track {
  background: #f0fdf4;      /* nền track (màu xanh nhạt nhạt) */
  border-radius: 9999px;    /* bo tròn */
}

.messages::-webkit-scrollbar-thumb {
  background-color: #949494; /* màu ngọc (teal-500) */
  border-radius: 9999px;     /* bo tròn */
  border: 2px solid #f0fdf4; /* khoảng trắng xung quanh */
}

.messages::-webkit-scrollbar-thumb:hover {
  background-color: #0f766e; /* hover đậm hơn (teal-700) */
}

</style>
