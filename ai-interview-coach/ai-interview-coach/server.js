require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;

// Prompt design: role + scope + output rules
const SYSTEM_PROMPT = `You are AI Interview Coach, a friendly interview preparation assistant for students and freshers.
Scope: Artificial Intelligence, Machine Learning, Deep Learning, NLP, Generative AI, LLMs, Data Science, Python for AI, and HR questions for AI roles.
Rules:
- Reply in the same language the user writes (English, Hindi or Hinglish).
- Keep answers short (max 180 words), clear, with simple bullet points.
- When the user asks for a question: ask ONE question at a time and mention its level (Easy, Medium or Hard). Then wait for the answer.
- When the user answers a question: give a score out of 10, what was good, what was missing, and a short model answer.
- When the user asks a concept: explain simply with a small example, then add one likely follow-up interview question.
- If you are not sure about something, say sorry instead of inventing an answer.
- If the question is unrelated to AI or interview preparation, politely say you only help with AI interview preparation.`;

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Simple in-memory rate limit: 20 requests / minute / IP
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 20;
}

app.get("/health", (req, res) => res.json({ ok: true, model: MODEL, keySet: Boolean(API_KEY) }));

app.post("/api/chat", async (req, res) => {
  try {
    if (limited(req.ip)) return res.status(429).json({ error: "Too many requests. Please wait a minute." });
    if (!API_KEY) return res.status(500).json({ error: "Server missing GEMINI_API_KEY." });

    const { message, history = [] } = req.body || {};
    if (typeof message !== "string" || !message.trim()) return res.status(400).json({ error: "Message is required." });

    // Keep last 10 turns only; map to Gemini format
    const contents = (Array.isArray(history) ? history : []).slice(-10)
      .filter(m => m && typeof m.text === "string" && (m.role === "user" || m.role === "model"))
      .map(m => ({ role: m.role, parts: [{ text: m.text.slice(0, 1500) }] }));
    contents.push({ role: "user", parts: [{ text: message.slice(0, 1500) }] });

    // Retry + fallback models: handles 503 (busy) / 429 (limit) / 404 (model removed)
    const models = [...new Set([MODEL, "gemini-flash-latest", "gemini-flash-lite-latest"])];
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 800 }
    });
    let data = null;
    for (const m of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
            body,
            signal: AbortSignal.timeout(30000)
          });
          const d = await r.json();
          if (r.ok) { data = d; break; }
          console.error(`Gemini error (${m}, try ${attempt}):`, JSON.stringify(d));
          if (![503, 429].includes(r.status)) break;      // other errors: go to next model
          await new Promise(ok => setTimeout(ok, 1500));  // busy: wait and retry
        } catch (e) { console.error(`Request failed (${m}):`, e.message); }
      }
      if (data) break;
    }
    if (!data) return res.status(502).json({ error: "AI service is busy right now. Please try again in a minute." });

    const reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ||
      "Sorry, I couldn't generate an answer. Please rephrase your question.";
    res.json({ reply });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
});

app.listen(PORT, () => console.log(`AI Interview Coach running on port ${PORT}`));
