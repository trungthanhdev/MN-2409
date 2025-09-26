export async function askAI(message: string): Promise<string> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", 
        messages: [
          { role: "system", content: "Bạn là huấn luyện viên fitness thân thiện, trả lời ngắn gọn, dễ hiểu. Luôn trả lời bằng Markdown với danh sách hoặc đoạn văn. Mỗi đoạn nên xuống dòng rõ ràng, dễ đọc." },
          { role: "user", content: message },
        ],
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "Không có câu trả lời.";
  } catch (err) {
    console.error(err);
    return "⚠️ Lỗi khi gọi AI.";
  }
}