// Worker entry point. Handles POST /card/chat; everything else falls through
// to the ASSETS binding (which serves _site/).
//
// The chat handler is a stub for now — it just echoes the request so we can
// verify the routing pipeline works before wiring up Anthropic + Turnstile.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/card/chat") {
      return handleChat(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleChat(request, env) {
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  if (env.CARD_CHAT_DISABLED === "true") {
    return json({ error: "chat is currently offline" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  return json({
    stub: true,
    received: body,
    note: "Chat handler not yet wired to Anthropic — this is a routing smoke test.",
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
