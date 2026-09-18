import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const AUTO_MODEL_ID = "auto";
const STORAGE_CONVERSATIONS_KEY = "ai_relay_conversations_v2";
const STORAGE_ACTIVE_ID_KEY = "ai_relay_active_conv_v2";
const STORAGE_PASSWORD_KEY = "ai_relay_app_password_v1";
const STORAGE_SIDEBAR_KEY = "ai_relay_sidebar_open_v1";

// Cấu hình mẫu System Prompt
const SYSTEM_PROMPT_PRESETS = [
  {
    label: "💻 Lập trình",
    prompt: "Bạn là chuyên gia lập trình cao cấp. Hãy trả lời súc tích, cung cấp code chuẩn, tối ưu và có chú thích ngắn gọn bằng tiếng Việt.",
  },
  {
    label: "📝 Dịch thuật",
    prompt: "Bạn là chuyên gia dịch thuật và biên tập ngôn ngữ. Hãy dịch tự nhiên, chuẩn văn phong và giữ nguyên thuật ngữ chuyên ngành.",
  },
  {
    label: "⚡ Súc tích",
    prompt: "Hãy trả lời thật ngắn gọn, đi thẳng vào trọng tâm, bỏ qua các lời chào hỏi xã giao rườm rà.",
  },
];

// Component hiển thị khối mã kèm nút Copy
function CodeBlock({ className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!match && !String(children).includes("\n")) {
    return (
      <code className="inline-code" {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-lang">{lang || "code"}</span>
        <button
          type="button"
          className="code-copy-btn"
          onClick={handleCopy}
          title="Sao chép khối mã"
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Đã chép!</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Chép mã</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-block-pre">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function createNewConversation(model = AUTO_MODEL_ID) {
  return {
    id: "conv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: "Đoạn chat mới",
    model: model,
    systemPrompt: "",
    maxHistory: 20,
    messages: [],
    updatedAt: Date.now(),
  };
}

export default function App() {
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [modelSearch, setModelSearch] = useState("");

  // Trạng thái thu gọn/mở rộng thanh Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem(STORAGE_SIDEBAR_KEY);
    return saved !== null ? saved === "true" : window.innerWidth > 768;
  });

  // Quản lý mật mã truy cập ứng dụng
  const [appPassword, setAppPassword] = useState(() => {
    return localStorage.getItem(STORAGE_PASSWORD_KEY) || "";
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  // Quản lý danh sách hội thoại
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONVERSATIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Migrate dữ liệu v1 nếu có
      const oldMsgs = localStorage.getItem("ai_relay_messages_v1");
      const oldModel = localStorage.getItem("ai_relay_selected_model_v1") || AUTO_MODEL_ID;
      if (oldMsgs) {
        const parsedOld = JSON.parse(oldMsgs);
        if (parsedOld.length > 0) {
          return [
            {
              id: "conv_default",
              title: parsedOld[0]?.content?.slice(0, 24) || "Đoạn chat trước",
              model: oldModel,
              systemPrompt: "",
              maxHistory: 20,
              messages: parsedOld,
              updatedAt: Date.now(),
            },
          ];
        }
      }
    } catch {
      // ignore
    }
    return [createNewConversation()];
  });

  const [activeConvId, setActiveConvId] = useState(() => {
    return localStorage.getItem(STORAGE_ACTIVE_ID_KEY) || conversations[0]?.id || "";
  });

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastUsedModel, setLastUsedModel] = useState(null);
  const [notice, setNotice] = useState(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const threadEndRef = useRef(null);
  const textareaRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Cuộc trò chuyện đang chọn
  const currentConv = useMemo(() => {
    return (
      conversations.find((c) => c.id === activeConvId) ||
      conversations[0] ||
      createNewConversation()
    );
  }, [conversations, activeConvId]);

  // Headers kèm mật khẩu
  const apiHeaders = useCallback(() => {
    const headers = { "Content-Type": "application/json" };
    if (appPassword) {
      headers["x-app-password"] = appPassword;
    }
    return headers;
  }, [appPassword]);

  // Lưu trạng thái sidebar
  useEffect(() => {
    localStorage.setItem(STORAGE_SIDEBAR_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

  // Lưu danh sách hội thoại vào LocalStorage
  useEffect(() => {
    if (!sending) {
      try {
        localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(conversations));
      } catch (e) {
        console.warn("Không thể lưu danh sách hội thoại:", e);
      }
    }
  }, [conversations, sending]);

  // Lưu active ID
  useEffect(() => {
    localStorage.setItem(STORAGE_ACTIVE_ID_KEY, activeConvId);
  }, [activeConvId]);

  // Cập nhật thuộc tính của cuộc trò chuyện hiện tại
  const updateCurrentConv = useCallback((updater) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConvId) {
          const updated = typeof updater === "function" ? updater(c) : { ...c, ...updater };
          return { ...updated, updatedAt: Date.now() };
        }
        return c;
      })
    );
  }, [activeConvId]);

  // Cuộn xuống cuối
  const scrollToBottom = useCallback((behavior = "smooth") => {
    threadEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentConv.messages, sending, scrollToBottom]);

  // Tải danh sách models từ router
  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const r = await fetch("/api/models", { headers: apiHeaders() });
      const data = await r.json();

      if (r.status === 401) {
        setShowPasswordModal(true);
        throw new Error("Cần nhập mật mã truy cập để xem danh sách model.");
      }

      if (!r.ok) {
        throw new Error(data?.error || `Lỗi tải model (${r.status})`);
      }

      const rawList = data?.data || data?.models || [];
      const list = rawList
        .map((m) => (typeof m === "string" ? m : m.id))
        .filter(Boolean);

      setModels(list);
    } catch (err) {
      setModelsError(err.message || "Không thể kết nối router.");
    } finally {
      setModelsLoading(false);
    }
  }, [apiHeaders]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Tạo cuộc hội thoại mới
  const handleNewChat = () => {
    if (sending) handleStopGeneration();
    const newConv = createNewConversation(currentConv.model);
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setNotice(null);
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  // Xóa một cuộc trò chuyện
  const handleDeleteConv = (e, idToDelete) => {
    e.stopPropagation();
    if (conversations.length <= 1) {
      const fresh = createNewConversation(currentConv.model);
      setConversations([fresh]);
      setActiveConvId(fresh.id);
      return;
    }
    const remaining = conversations.filter((c) => c.id !== idToDelete);
    setConversations(remaining);
    if (activeConvId === idToDelete) {
      setActiveConvId(remaining[0].id);
    }
  };

  // Xuất đoạn chat ra file Markdown (.md)
  const handleExportChat = () => {
    if (currentConv.messages.length === 0) return;

    let md = `# ${currentConv.title}\n\n`;
    md += `- **Thời gian:** ${new Date(currentConv.updatedAt).toLocaleString("vi-VN")}\n`;
    md += `- **Model AI:** ${currentConv.model}\n`;
    if (currentConv.systemPrompt) {
      md += `- **System Prompt:** ${currentConv.systemPrompt}\n`;
    }
    md += `\n---\n\n`;

    currentConv.messages.forEach((m) => {
      const role = m.role === "user" ? "### 👤 Bạn" : `### 🤖 AI (${m.model || currentConv.model})`;
      md += `${role} [${m.timestamp || ""}]:\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeTitle = currentConv.title
      .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, "_")
      .slice(0, 30);
    a.download = `${safeTitle || "chat"}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Điều chỉnh độ cao ô nhập liệu
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 48), 180);
    textarea.style.height = `${nextHeight}px`;
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  // Dừng tạo câu trả lời
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSending(false);
  };

  // Gửi tin nhắn
  async function sendMessage(textToSend = null, customBaseMessages = null) {
    const text = (textToSend || input).trim();
    if (!text || sending) return;

    const currentBase = customBaseMessages !== null ? customBaseMessages : currentConv.messages;

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const nextMessages = [...currentBase, userMessage];

    // Tự động đặt tên cho hội thoại dựa trên câu đầu tiên
    let newTitle = currentConv.title;
    if (currentBase.length === 0 && currentConv.title === "Đoạn chat mới") {
      newTitle = text.slice(0, 26) + (text.length > 26 ? "..." : "");
    }

    const assistantId = (Date.now() + 1).toString();
    const assistantPlaceholder = {
      id: assistantId,
      role: "assistant",
      content: "",
      model: currentConv.model === AUTO_MODEL_ID ? "auto..." : currentConv.model,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    updateCurrentConv({
      title: newTitle,
      messages: [...nextMessages, assistantPlaceholder],
    });

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "48px";
    setSending(true);
    setNotice(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          model: currentConv.model,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          systemPrompt: currentConv.systemPrompt || "",
          maxHistory: currentConv.maxHistory || 20,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (response.status === 401) {
        setShowPasswordModal(true);
        throw new Error("Mật khẩu truy cập không đúng hoặc cần nhập lại.");
      }

      if (!response.ok) {
        let errData = {};
        try {
          errData = await response.json();
        } catch {
          // ignore
        }

        if (response.status === 429) {
          setNotice(
            "Model đang hết quota (429). Nếu bạn chọn 'auto', Router sẽ tự chuyển sang model free khác; hoặc chọn model khác ở cột bên trái."
          );
        } else {
          setNotice(errData?.error?.message || errData?.error || `Lỗi từ Router (${response.status})`);
        }

        // Bỏ bubble assistant rỗng
        updateCurrentConv({ messages: nextMessages });
        return;
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accumulatedText = "";
        let finalModel = currentConv.model;
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;

            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6).trim();
              if (dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.model) finalModel = parsed.model;
                const delta =
                  parsed?.choices?.[0]?.delta?.content ||
                  parsed?.choices?.[0]?.text ||
                  "";
                if (delta) {
                  accumulatedText += delta;
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === activeConvId
                        ? {
                            ...c,
                            messages: c.messages.map((m) =>
                              m.id === assistantId
                                ? { ...m, content: accumulatedText, model: finalModel }
                                : m
                            ),
                          }
                        : c
                    )
                  );
                }
              } catch {
                // ignore chunk lẻ
              }
            }
          }
        }

        setLastUsedModel(finalModel);
        updateCurrentConv((c) => ({
          messages: c.messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: accumulatedText || "_(Không có nội dung phản hồi)_",
                  model: finalModel,
                }
              : m
          ),
        }));
      } else {
        const data = await response.json();
        const reply = data.reply || "";
        const usedModel = data.model || currentConv.model;
        setLastUsedModel(usedModel);
        updateCurrentConv((c) => ({
          messages: c.messages.map((m) =>
            m.id === assistantId ? { ...m, content: reply, model: usedModel } : m
          ),
        }));
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setNotice("Đã dừng tạo câu trả lời.");
      } else {
        setNotice(err.message || "Không thể gửi tin nhắn.");
        updateCurrentConv({ messages: nextMessages });
      }
    } finally {
      setSending(false);
      abortControllerRef.current = null;
    }
  }

  // Thử lại câu hỏi gần nhất mà không lặp tin nhắn
  const handleRetry = () => {
    if (currentConv.messages.length === 0 || sending) return;
    const lastUserIdx = currentConv.messages.findLastIndex
      ? currentConv.messages.findLastIndex((m) => m.role === "user")
      : [...currentConv.messages].map((m) => m.role).lastIndexOf("user");

    if (lastUserIdx !== -1) {
      const lastUserMsg = currentConv.messages[lastUserIdx];
      const baseMessages = currentConv.messages.slice(0, lastUserIdx);
      sendMessage(lastUserMsg.content, baseMessages);
    }
  };

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const handleCopyMessage = (id, content) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    const pass = passwordInput.trim();
    setAppPassword(pass);
    localStorage.setItem(STORAGE_PASSWORD_KEY, pass);
    setShowPasswordModal(false);
    setPasswordInput("");
    loadModels();
  };

  const filteredModels = models.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase().trim())
  );

  return (
    <div className={`shell ${sidebarOpen ? "sidebar-open" : "sidebar-collapsed"}`}>
      {/* Lớp phủ mờ khi mở Sidebar trên Mobile */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar cấu hình & Danh sách hội thoại */}
      <aside className={`panel ${sidebarOpen ? "open" : "closed"}`}>
        <div className="panel-header">
          <div className="brand">
            <div className="brand-icon">⚡</div>
            <div>
              <div className="panel-title">AI RELAY</div>
              <div className="panel-badge">Auto-Fallback Free AI</div>
            </div>
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              title="Thu gọn sidebar"
            >
              ✕
            </button>
          </div>

          <button
            type="button"
            className="new-chat-btn"
            onClick={handleNewChat}
            title="Tạo cuộc hội thoại mới"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Cuộc trò chuyện mới</span>
          </button>
        </div>

        {/* Danh sách các phiên chat đã lưu */}
        <div className="conv-section">
          <div className="conv-header-row">
            <span className="section-title">LỊCH SỬ CHAT ({conversations.length})</span>
          </div>
          <div className="conv-list">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`conv-item ${c.id === activeConvId ? "active" : ""}`}
                onClick={() => {
                  if (c.id !== activeConvId) {
                    if (sending) handleStopGeneration();
                    setActiveConvId(c.id);
                    if (window.innerWidth <= 768) setSidebarOpen(false);
                  }
                }}
              >
                <div className="conv-icon">💬</div>
                <div className="conv-title" title={c.title}>
                  {c.title}
                </div>
                <button
                  type="button"
                  className="conv-delete-btn"
                  onClick={(e) => handleDeleteConv(e, c.id)}
                  title="Xóa đoạn chat này"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Model đang dùng */}
        <div className="field">
          <div className="field-label-row">
            <label htmlFor="model-select">Model đang chọn</label>
            <button
              type="button"
              className="refresh-btn"
              onClick={loadModels}
              disabled={modelsLoading}
              title="Tải lại danh sách model từ router"
            >
              <svg
                className={modelsLoading ? "spin" : ""}
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>{modelsLoading ? "Đang tải..." : "Làm mới"}</span>
            </button>
          </div>

          <select
            id="model-select"
            value={currentConv.model || AUTO_MODEL_ID}
            onChange={(e) => updateCurrentConv({ model: e.target.value })}
          >
            <option value={AUTO_MODEL_ID}>⚡ auto — Tự động chuyển khi hết quota</option>
            {models.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        {/* Tìm kiếm nhanh model */}
        {models.length > 6 && (
          <div className="field">
            <input
              type="text"
              className="search-input"
              placeholder={`Lọc model (${filteredModels.length}/${models.length})...`}
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
            />
            {modelSearch && (
              <div className="model-search-results">
                {filteredModels.slice(0, 8).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`model-search-item ${currentConv.model === id ? "active" : ""}`}
                    onClick={() => {
                      updateCurrentConv({ model: id });
                      setModelSearch("");
                    }}
                  >
                    {id}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cài đặt nâng cao: System Prompt & Giới hạn ngữ cảnh */}
        <div className="advanced-settings-block">
          <button
            type="button"
            className="settings-toggle-btn"
            onClick={() => setShowSettings(!showSettings)}
          >
            <div className="settings-toggle-left">
              <span>⚙️ Cài đặt ngữ cảnh</span>
              {currentConv.systemPrompt && <span className="badge-active">Bật Prompt</span>}
            </div>
            <span>{showSettings ? "▲" : "▼"}</span>
          </button>

          {showSettings && (
            <div className="settings-content">
              <div className="field">
                <label>System Prompt (Chỉ dẫn vai trò AI):</label>
                <div className="prompt-presets">
                  {SYSTEM_PROMPT_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className="preset-btn"
                      onClick={() => updateCurrentConv({ systemPrompt: p.prompt })}
                    >
                      {p.label}
                    </button>
                  ))}
                  {currentConv.systemPrompt && (
                    <button
                      type="button"
                      className="preset-btn clear"
                      onClick={() => updateCurrentConv({ systemPrompt: "" })}
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <textarea
                  className="system-prompt-input"
                  rows={3}
                  value={currentConv.systemPrompt || ""}
                  onChange={(e) => updateCurrentConv({ systemPrompt: e.target.value })}
                  placeholder="Ví dụ: Bạn là chuyên gia lập trình Python, trả lời ngắn gọn..."
                />
              </div>

              <div className="field">
                <label>Cửa sổ ngữ cảnh (Tránh tràn token model free):</label>
                <select
                  value={currentConv.maxHistory || 20}
                  onChange={(e) => updateCurrentConv({ maxHistory: Number(e.target.value) })}
                >
                  <option value={10}>Gửi 10 tin nhắn gần nhất (Tiết kiệm token)</option>
                  <option value={20}>Gửi 20 tin nhắn gần nhất (Khuyên dùng)</option>
                  <option value={30}>Gửi 30 tin nhắn gần nhất</option>
                  <option value={0}>Gửi toàn bộ (Không giới hạn)</option>
                </select>
              </div>

              <div className="field">
                <label>Mật mã truy cập App (nếu VPS yêu cầu):</label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowPasswordModal(true)}
                >
                  {appPassword ? "🔑 Đổi mật mã app" : "🔒 Nhập mật mã app"}
                </button>
              </div>
            </div>
          )}
        </div>

        {modelsError && (
          <div className="panel-error">
            <div className="error-title">⚠️ Lỗi Router</div>
            <div>{modelsError}</div>
          </div>
        )}

        {/* Trạng thái hoạt động */}
        <div className="status-block">
          <div className="status-row">
            <span className={`dot ${currentConv.model === AUTO_MODEL_ID ? "pulse" : ""}`} />
            <span className="status-text">
              Chế độ: <strong>{currentConv.model === AUTO_MODEL_ID ? "Auto chuyển đổi" : "Cố định model"}</strong>
            </span>
          </div>
          {lastUsedModel && (
            <div className="status-row muted">
              <span className="meta-icon">✓</span>
              <span>Model trả lời gần nhất:</span>
              <code title={lastUsedModel}>{lastUsedModel}</code>
            </div>
          )}
        </div>

        <div className="panel-footer">
          <div className="footer-tip">
            💡 <strong>Mẹo:</strong> Chế độ <code>auto</code> giúp OmniRoute/OrcaRouter tự chuyển sang model free khác khi gặp lỗi 429 Quota.
          </div>
        </div>
      </aside>

      {/* Vùng Chat chính */}
      <main className="chat">
        <header className="chat-header">
          <div className="chat-header-left">
            <button
              type="button"
              className="toggle-sidebar-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? "Thu gọn thanh bên" : "Mở thanh bên"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            <div className="chat-header-info">
              <h1>{currentConv.title}</h1>
              <span className="chat-header-sub">
                {currentConv.messages.length} tin nhắn • {currentConv.model === AUTO_MODEL_ID ? "⚡ auto router" : currentConv.model}
              </span>
            </div>
          </div>

          <div className="chat-header-actions">
            {currentConv.messages.length > 0 && (
              <button
                type="button"
                className="btn-text"
                onClick={handleExportChat}
                title="Tải cuộc trò chuyện này về máy dưới dạng file Markdown (.md)"
              >
                📥 Xuất .md
              </button>
            )}

            <button
              type="button"
              className="btn-text primary"
              onClick={handleNewChat}
              title="Bắt đầu hội thoại mới"
            >
              + Chat mới
            </button>
          </div>
        </header>

        {/* Khung tin nhắn */}
        <div className="thread">
          {currentConv.messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">⚡</div>
              <h2>AI Relay Router</h2>
              <p>Hệ thống tự động chuyển đổi giữa các AI provider miễn phí khi hết quota.</p>
              <div className="quick-suggestions">
                <button
                  type="button"
                  className="chip"
                  onClick={() => sendMessage("Viết một hàm JavaScript kiểm tra định dạng email và giải thích cách hoạt động.")}
                >
                  🚀 Viết hàm kiểm tra email bằng JavaScript
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => sendMessage("Tóm tắt các ưu điểm của kiến trúc Microservices so với Monolith.")}
                >
                  📊 So sánh Microservices và Monolithic
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => sendMessage("Giải thích khái niệm Rate Limit và cách các AI Router xử lý khi gặp mã lỗi 429.")}
                >
                  ⚡ Cách AI Router xử lý lỗi 429 Quota
                </button>
              </div>
            </div>
          )}

          {currentConv.messages.map((m) => (
            <div key={m.id} className={`bubble-row ${m.role}`}>
              <div className="bubble-avatar">
                {m.role === "user" ? "👤" : "🤖"}
              </div>

              <div className={`bubble ${m.role}`}>
                <div className="bubble-meta">
                  <span className="bubble-role">{m.role === "user" ? "Bạn" : "AI Assistant"}</span>
                  {m.model && m.role === "assistant" && (
                    <span className="bubble-model-tag" title="Model sinh nội dung này">
                      {m.model}
                    </span>
                  )}
                  {m.timestamp && <span className="bubble-time">{m.timestamp}</span>}

                  <button
                    type="button"
                    className="copy-msg-btn"
                    onClick={() => handleCopyMessage(m.id, m.content)}
                    title="Sao chép tin nhắn"
                  >
                    {copiedMsgId === m.id ? (
                      <span className="copied-tag">Đã sao chép</span>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </button>
                </div>

                <div className="bubble-content">
                  {m.role === "user" ? (
                    <div className="user-plain-text">{m.content}</div>
                  ) : m.content ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code: CodeBlock,
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" />
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    <div className="typing-indicator">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div ref={threadEndRef} />
        </div>

        {/* Thông báo lỗi / cảnh báo */}
        {notice && (
          <div className="notice-bar">
            <div className="notice-content">
              <span className="notice-icon">⚠️</span>
              <span>{notice}</span>
            </div>
            <div className="notice-actions">
              <button type="button" className="retry-btn" onClick={handleRetry}>
                Thử lại
              </button>
              <button
                type="button"
                className="close-notice-btn"
                onClick={() => setNotice(null)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Khung nhập tin nhắn */}
        <div className="composer-container">
          {sending && (
            <div className="stop-bar">
              <button
                type="button"
                className="stop-btn"
                onClick={handleStopGeneration}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
                <span>Dừng câu trả lời</span>
              </button>
            </div>
          )}

          <div className="composer">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter để xuống dòng)"
              rows={1}
            />

            <button
              type="button"
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={sending || !input.trim()}
              title="Gửi tin nhắn (Enter)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* Modal nhập mật khẩu truy cập */}
      {showPasswordModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-icon">🔒</div>
              <h3>Mật mã truy cập ứng dụng</h3>
            </div>
            <p className="modal-desc">
              Hệ thống yêu cầu mật mã để sử dụng (cấu hình trong <code>APP_PASSWORD</code> của backend).
            </p>
            <form onSubmit={handleSavePassword}>
              <input
                type="password"
                className="modal-input"
                placeholder="Nhập mật mã..."
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
              />
              <div className="modal-buttons">
                {appPassword && (
                  <button
                    type="button"
                    className="modal-btn-clear"
                    onClick={() => {
                      setAppPassword("");
                      localStorage.removeItem(STORAGE_PASSWORD_KEY);
                      setShowPasswordModal(false);
                      loadModels();
                    }}
                  >
                    Xóa mật mã đã lưu
                  </button>
                )}
                <button
                  type="button"
                  className="modal-btn-cancel"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Đóng
                </button>
                <button type="submit" className="modal-btn-submit">
                  Lưu & Áp dụng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
