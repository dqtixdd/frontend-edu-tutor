const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export async function chat({ question, k = 6, conversation_id = "default" }) {
  const r = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, k, conversation_id }),
  });
  if (!r.ok) throw new Error(`/chat failed: ${r.status}`);
  return r.json();
}

export async function reset(conversation_id = "default") {
  const r = await fetch(
    `${BASE}/reset?conversation_id=${encodeURIComponent(conversation_id)}`,
    {
      method: "POST",
    }
  );
  if (!r.ok) throw new Error(`/reset failed: ${r.status}`);
  return r.json();
}
