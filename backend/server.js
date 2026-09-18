import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Readable } from "node:stream";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Ưu tiên đọc file .env trong thư mục backend, fallback về root
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Cấu hình Router
const ROUTER_BASE_URL = (process.env.ROUTER_BASE_URL || "http://localhost:20128/v1").replace(/\/+$/, "");
const ROUTER_API_KEY = process.env.ROUTER_API_KEY || "";
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const PORT = process.env.PORT || 8787;

if (!ROUTER_API_KEY) {
  console.warn(
    "[ai-relay] Cảnh báo: ROUTER_API_KEY chưa được đặt trong .env. Các yêu cầu tới router có thể bị từ chối."
  );
}

if (APP_PASSWORD) {
  console.log("[ai-relay] Đã kích hoạt bảo vệ bằng mật khẩu truy cập (APP_PASSWORD).");
}

function routerHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };
  if (ROUTER_API_KEY) {
    headers["Authorization"] = `Bearer ${ROUTER_API_KEY}`;
  }
  return headers;
}

// Middleware kiểm tra mật khẩu truy cập (nếu có bật APP_PASSWORD)
function checkAuth(req, res, next) {
  if (!APP_PASSWORD) return next();

  const authHeader = req.headers["x-app-password"] || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (authHeader && authHeader === APP_PASSWORD) {
    return next();
  }

  return res.status(401).json({
    error: "Mật khẩu truy cập không chính xác hoặc chưa được cung cấp.",
    authRequired: true,
  });
}

// Helper: Phân tích an toàn phản hồi từ Router (tránh crash khi gặp HTML/Text error)
async function safeParseResponse(r) {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || `Lỗi từ router (${r.status} ${r.statusText})` };
  }
}

// GET /api/health — kiểm tra trạng thái kết nối & yêu cầu mật khẩu
app.get("/api/health", async (_req, res) => {
  let routerConnected = false;
  let errorMsg = null;

  try {
    const check = await fetch(`${ROUTER_BASE_URL}/models`, {
      headers: routerHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    routerConnected = check.ok;
    if (!check.ok) {
      errorMsg = `Router trả về mã ${check.status}`;
    }
  } catch (err) {
    errorMsg = err.message || "Không kết nối được router";
  }

  res.json({
    status: "ok",
    routerBaseUrl: ROUTER_BASE_URL,
    hasApiKey: Boolean(ROUTER_API_KEY),
    authRequired: Boolean(APP_PASSWORD),
    routerConnected,
    error: errorMsg,
  });
});

// GET /api/models — lấy danh sách models trực tiếp từ router (yêu cầu auth nếu có đặt pass)
app.get("/api/models", checkAuth, async (_req, res) => {
  try {
    const r = await fetch(`${ROUTER_BASE_URL}/models`, {
      headers: routerHeaders(),
      signal: AbortSignal.timeout(15000),
    });

    const data = await safeParseResponse(r);
    if (!r.ok) {
      return res.status(r.status).json(data);
    }
    res.json(data);
  } catch (err) {
    console.error("[ai-relay] /api/models error:", err.message);
    const isTimeout = err.name === "TimeoutError";
    res.status(502).json({
      error: isTimeout
        ? "Kết nối tới Router bị quá thời gian (Timeout). Vui lòng kiểm tra lại Router."
        : "Không thể kết nối tới Router (OmniRoute / OrcaRouter). Hãy đảm bảo router đang chạy.",
    });
  }
});

// POST /api/chat — hỗ trợ Streaming (SSE), System Prompt, và Giới hạn ngữ cảnh (Context Window)
app.post("/api/chat", checkAuth, async (req, res) => {
  const {
    model,
    messages,
    stream = true,
    systemPrompt = "",
    maxHistory = 20,
  } = req.body || {};

  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Cần truyền vào { model, messages } hợp lệ (messages không được rỗng)." });
  }

  // Chuẩn hóa và áp dụng Sliding Window Context
  let processedMessages = messages
    .filter((m) => m && m.content && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: m.content }));

  // Giới hạn số lượng tin nhắn gần nhất nếu vượt quá maxHistory (để không bị tràn token)
  const historyLimit = Number(maxHistory);
  if (historyLimit > 0 && processedMessages.length > historyLimit) {
    processedMessages = processedMessages.slice(-historyLimit);
  }

  // Chèn System Prompt vào đầu danh sách nếu có
  if (typeof systemPrompt === "string" && systemPrompt.trim()) {
    processedMessages.unshift({
      role: "system",
      content: systemPrompt.trim(),
    });
  }

  // Cho phép hủy kết nối tới Router nếu người dùng bấm Hủy (Cancel/Stop) hoặc ngắt tab
  const abortController = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  // Timeout tối đa 90 giây chờ router phản hồi
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error("Request timed out after 90s"));
  }, 90000);

  try {
    const payload = {
      model,
      messages: processedMessages,
      stream: Boolean(stream),
    };

    const r = await fetch(`${ROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: routerHeaders(),
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    if (!r.ok) {
      const errorData = await safeParseResponse(r);
      return res.status(r.status).json(errorData);
    }

    // Nếu là chế độ streaming và router trả về stream
    if (stream && r.body) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const nodeStream = Readable.fromWeb(r.body);
      nodeStream.pipe(res);

      nodeStream.on("error", (err) => {
        console.error("[ai-relay] Stream pipe error:", err.message);
        if (!res.writableEnded) res.end();
      });
      return;
    }

    // Nếu không stream (hoặc router trả về JSON thường)
    const data = await safeParseResponse(r);
    const reply = data?.choices?.[0]?.message?.content ?? "";
    const usedModel = data?.model || model;
    res.json({ reply, model: usedModel, raw: data });
  } catch (err) {
    clearTimeout(timeoutId);
    if (abortController.signal.aborted) {
      if (!res.writableEnded) {
        return res.status(499).json({ error: "Yêu cầu đã bị hủy." });
      }
      return;
    }
    console.error("[ai-relay] /api/chat error:", err.message);
    const isTimeout = err.name === "TimeoutError";
    if (!res.writableEnded) {
      res.status(502).json({
        error: isTimeout
          ? "Router phản hồi quá lâu (Timeout 90s). Vui lòng thử lại hoặc đổi model khác."
          : "Không thể kết nối tới Router. Vui lòng kiểm tra lại dịch vụ OmniRoute/OrcaRouter.",
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`[ai-relay] Backend đang lắng nghe tại: http://localhost:${PORT}`);
  console.log(`[ai-relay] Kết nối tới Router tại: ${ROUTER_BASE_URL}`);
});
