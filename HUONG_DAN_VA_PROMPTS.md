# 📘 Cẩm Nang Vận Hành AI Relay & Bộ Prompt Chuẩn

Tài liệu hướng dẫn chi tiết cách khai thác tối đa sức mạnh của hệ thống **AI Relay**, cách chọn model phù hợp và bộ **System Prompt chuẩn** giúp model AI trả lời thông minh, chính xác và không bị gián đoạn.

---

## 🧭 PHẦN 1: BẢNG CHỌN MODEL CHUẨN THEO MỤC ĐÍCH

Khi dùng qua router (OmniRoute hoặc OrcaRouter), bạn có nhiều lựa chọn model miễn phí. Dưới đây là bảng phân bổ model tối ưu nhất:

| Mục đích sử dụng | Model khuyên dùng | Nguồn Provider | Lưu ý quan trọng |
| :--- | :--- | :--- | :--- |
| **Viết code & Debug lỗi** | `qwen-2.5-coder-32b`<br>`deepseek-coder`<br>`deepseek-r1` | Groq / Together / OpenRouter | Khả năng sinh mã nguồn Python, JavaScript, HTML, C++ rất chuẩn, cú pháp chính xác. |
| **Xử lý tiếng Việt & Tóm tắt văn bản** | `gemini-1.5-flash`<br>`gemini-1.5-flash-8b` | Google AI Studio (Free) | Hiểu tiếng Việt mượt mà và tự nhiên nhất. Cửa sổ ngữ cảnh cực lớn (1 triệu token). |
| **Tốc độ phản hồi cực nhanh** | `llama-3.3-70b-versatile`<br>`llama-3.1-8b-instant` | Groq (Free) | Tốc độ xuất chữ 300–500 token/giây, rất hợp để brainstorm ý tưởng hoặc hỏi đáp nhanh. |
| **Dự phòng (Chống cháy 100%)** | `openai` (GPT-4o mini via Pollinations) | Pollinations (OmniRoute) | **Không cần API key, không cần tài khoản**, dùng dự phòng khi các nguồn khác hết sạch quota. |
| **Mặc định hàng ngày** | `auto` | Router tự điều phối | Tự động chọn model sẵn sàng nhất và tự nhảy sang model khác khi gặp mã lỗi 429 (hết quota). |

---

## 🧠 PHẦN 2: BỘ SYSTEM PROMPT CHUẨN (COPY DÙNG NGAY)

Bạn hãy dán các đoạn prompt này vào mục **"⚙️ Cài đặt ngữ cảnh" → "System Prompt"** trên thanh sidebar bên trái.

### 1. 💻 Prompt dành cho Lập trình viên & Kỹ sư Phần mềm
> **Mục tiêu:** Nhận code sạch, tối ưu, có giải thích ngắn gọn, không lan man lý thuyết thừa.

```text
Bạn là một Kỹ sư phần mềm cao cấp (Senior Full-stack Engineer) và Chuyên gia giải thuật.
Quy tắc phản hồi:
1. Luôn ưu tiên đưa ra giải pháp mã nguồn hoàn chỉnh, sạch sẽ, tuân thủ Clean Code và Best Practices.
2. Trình bày code trong khối markdown với tên ngôn ngữ rõ ràng.
3. Giải thích ngắn gọn logic cốt lõi bằng tiếng Việt; chỉ rõ các trường hợp biên (edge cases) và độ phức tạp nếu cần.
4. Bỏ qua các lời chào hỏi xã giao, đi thẳng vào phân tích và đoạn code giải pháp.
```

---

### 2. ⚡ Prompt Súc tích & Tối ưu Token (Dành cho Free Tier)
> **Mục tiêu:** Tiết kiệm tối đa token của model free, nhận câu trả lời nhanh gọn và trực diện.

```text
Bạn là trợ lý AI chuyên nghiệp. Hãy trả lời cực kỳ súc tích, cô đọng và đi thẳng vào trọng tâm câu hỏi.
- Sử dụng danh sách gạch đầu dòng ngắn hoặc bảng biểu để tóm tắt thông tin.
- Tuyệt đối không chào hỏi, không lặp lại câu hỏi của người dùng và không đưa ra kết luận mang tính xã giao rườm rà.
- Trả lời bằng tiếng Việt chuẩn xác.
```

---

### 3. 📝 Prompt Dịch thuật & Biên tập Chuyên ngành
> **Mục tiêu:** Dịch tự nhiên, chuẩn văn phong Việt hóa, không bị "ngượng" như Google Dịch cũ.

```text
Bạn là một Biên dịch viên và Chuyên gia hiệu đính ngôn ngữ chuyên nghiệp.
Nhiệm vụ của bạn:
1. Dịch văn bản sang tiếng Việt một cách tự nhiên, trôi chảy, chuẩn văn phong đời sống hoặc chuyên ngành phù hợp.
2. Giữ nguyên các thuật ngữ kỹ thuật, tên riêng và đoạn mã không cần dịch (hoặc chú thích thêm trong ngoặc đơn).
3. Nếu phát hiện câu gốc có nhiều tầng nghĩa, hãy đưa ra bản dịch tốt nhất kèm gợi ý phương án thay thế.
```

---

### 4. 🧩 Prompt Suy luận Logic Từng Bước (Chain of Thought)
> **Mục tiêu:** Giải toán, phân tích kiến trúc hệ thống, suy luận bài toán logic hóc búa.

```text
Bạn là một Chuyên gia phân tích giải pháp logic.
Khi nhận được bài toán hoặc câu hỏi phức tạp:
1. Hãy suy nghĩ từng bước một (Step-by-step reasoning) để phân tích các khía cạnh của vấn đề.
2. Nêu rõ các giả định ban đầu và cơ sở lập luận.
3. Chỉ ra các rủi ro, ưu/nhược điểm của từng phương án trước khi đưa ra kết luận cuối cùng.
```

---

## 🛠️ PHẦN 3: CÁC MẸO VẬN HÀNH ĐẠT HIỆU QUẢ CAO NHẤT

### 1. Luôn bật chế độ "Gửi 20 tin gần nhất" (Cửa sổ ngữ cảnh)
* **Vì sao?** Các model AI miễn phí thường bị giới hạn bộ nhớ ngữ cảnh từ 4.000 đến 8.000 tokens. Nếu bạn nói chuyện quá dài (hơn 30 tin nhắn), toàn bộ lịch sử sẽ bị gửi lên và gây lỗi `400 Context length exceeded`.
* **Cách làm:** Vào **Cài đặt ngữ cảnh** → chọn **"Gửi 20 tin nhắn gần nhất"**. Hệ thống sẽ tự động cắt các tin nhắn quá cũ nhưng **vẫn giữ nguyên System Prompt** ở đầu để AI không bị quên vai trò.

### 2. Tận dụng nút "Thử lại" (Retry) thông minh
* Nếu model đang trả lời dở chừng bị ngắt mạng hoặc báo lỗi quota, bạn chỉ cần bấm nút **"Thử lại"** ở thanh thông báo lỗi màu vàng. 
* Hệ thống sẽ tự động gửi lại câu hỏi mà không làm lặp đúp bong bóng tin nhắn của bạn.

### 3. Khởi chạy dự án bằng 1 lệnh duy nhất
* Không cần mở 2 tab terminal riêng biệt cho backend và frontend nữa. 
* Mở terminal ở thư mục `ai-relay` và gõ:
  ```bash
  npm run dev
  ```
  Cả server backend (`port 8787`) và giao diện web (`port 5173`) sẽ tự động chạy đồng thời.

### 4. Xuất tài liệu lưu trữ sau khi xong việc
* Sau một phiên trao đổi công việc hoặc giải quyết xong một lỗi code, hãy bấm nút **"📥 Xuất .md"** ở góc trên bên phải.
* Toàn bộ nội dung hội thoại, thời gian, model đã dùng và code block sẽ được tải về máy bạn dưới dạng file Markdown hoàn chỉnh, có thể lưu vào Notion, Obsidian hoặc GitHub.

### 5. Cách kết nối nhiều Provider Free trên OmniRoute
Nếu bạn tự chạy OmniRoute trên máy:
1. Mở dashboard tại `http://localhost:20128`.
2. Vào mục **Providers**:
   * Bật **Pollinations** (không cần API key).
   * Lấy API key miễn phí từ **Google AI Studio** (`aistudio.google.com`) kết nối vào mục Gemini.
   * Lấy API key miễn phí từ **Groq** (`console.groq.com`) kết nối vào mục Groq.
3. Quay lại giao diện AI Relay, bấm nút **"Làm mới"** cạnh dropdown model. Toàn bộ các model mạnh nhất sẽ xuất hiện ngay lập tức!
