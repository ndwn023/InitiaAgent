import { Router, Request, Response, NextFunction } from "express";
import { chatWithAgent, chatWithAgentStream, ChatMessage } from "../lib/ai-agent";
import { fetchPrices, formatMarketContext } from "../lib/price-feed";
import { chatBodySchema, parsePayload } from "@initia-agent/shared";

const router = Router();

// POST /api/agent/chat
// Body: { messages, agentContext, model, stream?: boolean }
// If stream=true  → responds with text/event-stream SSE
// If stream=false → responds with JSON { response }
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, agentContext, model, stream: wantStream } = parsePayload(
      req.body,
      chatBodySchema,
    );

    const marketSnapshot = await fetchPrices();
    const marketContext = formatMarketContext(marketSnapshot);
    const ctx = { ...agentContext, marketData: marketContext, model: model || undefined };

    // ── SSE streaming ─────────────────────────────────────────────────────────
    if (wantStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let usedModel = "unknown";
      try {
        const result = await chatWithAgentStream(
          messages as ChatMessage[],
          ctx,
          (chunk) => {
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          },
        );
        usedModel = result.model;
      } catch (err) {
        res.write(`data: ${JSON.stringify({ text: "I'm temporarily unavailable." })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true, model: usedModel })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // ── Non-streaming (fallback / simple clients) ─────────────────────────────
    const response = await chatWithAgent(messages as ChatMessage[], ctx);
    res.json({ response });

  } catch (error) {
    if (res.headersSent) {
      // Already streaming — best-effort cleanup, don't propagate to global handler.
      console.error("Agent chat error after headers sent:", error);
      try { res.end(); } catch { /* ignore */ }
      return;
    }
    next(error);
  }
});

export default router;
