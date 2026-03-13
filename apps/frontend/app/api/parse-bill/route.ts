// app/api/parse-bill/route.ts
// Receives voice transcript → returns structured bill JSON via Google Gemini

export async function POST(req: Request) {
  try {
    const { transcript, userAddress } = await req.json();

    if (!transcript) {
      return Response.json({ error: "No transcript provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const systemPrompt = `You are a smart bill-splitting agent for a crypto payments app on Celo.
Parse the user's voice input about splitting expenses and return ONLY valid JSON with no markdown.

The user's wallet address is: ${userAddress || "unknown"}

Extract and return this exact shape:
{
  "title": "short bill name (e.g. Dinner, Uber, Groceries)",
  "totalAmountDisplay": "human readable (e.g. $120.00)",
  "totalAmount": number in dollars (e.g. 120),
  "participants": [
    {
      "address": "0x... (use user's address if they say 'me' or 'I', else '0xPENDING' if unknown)",
      "shareDisplay": "$X.XX",
      "share": number in dollars
    }
  ],
  "confirmation": "natural spoken confirmation sentence (e.g. Got it! splitting $90 three ways at $30 each. Should I create this bill?)"
}

Rules:
- Shares must add up to totalAmount exactly
- If someone gets extra, add it to their share and reduce others proportionally
- Equal split if no amounts specified
- Keep addresses short in confirmation (e.g. 0xABC...123)
- Return ONLY JSON, no explanation, no markdown fences`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,     
{
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: transcript }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("[parse-bill] Gemini API error:", err);
      return Response.json({ error: "Parsing failed" }, { status: 500 });
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!raw) {
      console.error("[parse-bill] Empty Gemini response:", data);
      return Response.json({ error: "Empty response from AI" }, { status: 500 });
    }

    let parsed: unknown;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error("[parse-bill] Failed to parse Gemini response:", raw);
      return Response.json(
        { error: "Could not understand the bill. Please try rephrasing." },
        { status: 400 }
      );
    }

    return Response.json(parsed);
  } catch (err: any) {
    console.error("[parse-bill] unexpected error:", err);
    return Response.json({ error: "Server error: " + err.message }, { status: 500 });
  }
}