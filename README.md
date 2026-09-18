# Relay — Chat AI Tự Động Fallback Free Models

Web chat AI thông minh: hỗ trợ chọn model cụ thể hoặc chế độ `auto`. Khi model đang dùng bị cạn quota (mã lỗi 429) hoặc quá tải, Router (OmniRoute hoặc OrcaRouter) sẽ tự động luân chuyển sang model AI miễn phí khác để câu trả lời không bị gián đoạn.

```
Frontend (React + Vite)  →  Backend (Express SSE Proxy, port 8787)  →  Router (OmniRoute / OrcaRouter)
```

---

## 🌟 Toàn bộ tính năng đã hoàn thiện

- ⚡ **Khởi động 1 lệnh duy nhất:** Chỉ cần gõ `npm run dev` ở thư mục gốc là tự bật cả Backend (port 8787) lẫn Frontend (port 5173).
- 🌊 **Streaming Realtime (SSE):** Chữ hiển thị mượt mà từng từ như ChatGPT/Claude, không phải đợi lâu.
- 🗂️ **Quản lý nhiều cuộc trò chuyện (Multi-Session):** Lưu lịch sử nhiều phiên chat khác nhau trong sidebar, tự động đặt tên theo câu hỏi đầu tiên, có nút xóa riêng từng đoạn chat.
- 📥 **Xuất đoạn chat (.md):** Nút tải nhanh toàn bộ nội dung cuộc trò chuyện về máy dưới dạng Markdown có định dạng đầy đủ.
- 📱 **Ẩn/Hiện Sidebar & Tương thích di động:** Nút thu gọn thanh bên giúp vùng chat rộng rãi toàn màn hình, hỗ trợ mượt mà trên điện thoại.
- 🧠 **Cài đặt System Prompt & Mẫu vai trò có sẵn:** Tùy biến vai trò AI theo ý muốn (Lập trình, Dịch thuật, Trả lời súc tích...) kèm nút áp dụng nhanh.
- 📏 **Trượt cửa sổ ngữ cảnh (Sliding Window Context):** Tùy chọn chỉ gửi 10, 20 hoặc 30 tin nhắn gần nhất lên router, giúp các model free không bao giờ bị lỗi quá tải bộ nhớ (`Context length exceeded`).
- 🎨 **Render Markdown & Code Blocks:** Trình bày đẹp mắt mã nguồn (Python, JS, HTML...), bảng biểu, danh sách, kèm **nút sao chép mã (Copy Code)** 1-click.
- ⏹️ **Nút Dừng (Stop Generation) & Thử lại (Retry):** Cho phép dừng AI sinh câu trả lời bất kỳ lúc nào hoặc thử lại ngay khi gặp lỗi mạng.
- 🔒 **Bảo mật truy cập (APP_PASSWORD):** Hỗ trợ đặt mật khẩu bảo vệ khi triển khai ứng dụng lên VPS công khai để người ngoài không dùng ké API key.
- 🔍 **Tìm kiếm & Làm mới Model:** Tìm nhanh model trong danh sách dài và nút **"Làm mới"** để đồng bộ ngay khi thêm provider mới trên router.
- 🛡️ **Bảo mật & Ổn định:** Đã cấu hình `.gitignore`, timeout 90s, tự ngắt tiến trình khi đóng tab, và an toàn khi router trả về trang lỗi HTML.

---

## 1. Cài đặt Router (chọn 1 trong 2)

### Lựa chọn A: OmniRoute (Tự host trên máy)
```bash
npm install -g omniroute
omniroute
```
Mặc định chạy ở `http://localhost:20128`. Mở dashboard, vào mục **Providers** kết nối các nguồn free (ví dụ Pollinations không cần key, hoặc Gemini/DeepSeek/Groq free...). Sau đó lấy API key ở **Dashboard → Endpoints**.

### Lựa chọn B: OrcaRouter (Cloud, không cần tự host)
Đăng ký tại [orcarouter.ai](https://orcarouter.ai), lấy API key, Base URL là `https://api.orcarouter.ai/v1`.

---

## 2. Cấu hình Backend

Đảm bảo file `backend/.env` đã có key router của bạn:
```env
ROUTER_BASE_URL=http://localhost:20128/v1   # hoặc https://api.orcarouter.ai/v1
ROUTER_API_KEY=<key_cua_ban>
PORT=8787

# (Tùy chọn) Mật mã bảo vệ web nếu deploy lên VPS public
# APP_PASSWORD=mat_khau_cua_ban
```

---

## 3. Khởi chạy toàn bộ hệ thống (1 Lệnh duy nhất)

Ở ngay thư mục gốc của dự án (`ai-relay`), chỉ cần gõ:
```bash
npm run dev
```
Cả Backend và Frontend sẽ cùng lúc khởi động. Mở trình duyệt tại:
👉 `http://localhost:5173`
