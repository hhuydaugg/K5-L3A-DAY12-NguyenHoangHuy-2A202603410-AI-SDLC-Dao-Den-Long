# Retro — Đảo Đèn Lồng (Day 12, AI SDLC)

Nguyễn Hoàng Huy, 2A202603410. Làm cùng Claude Code (Claude Opus 5.5). Bốn phase, mỗi phase là một tag; bản phát hành là `v1.0.0`.

## 1. Tổng hợp đánh giá 4 phase

| Phase | Ticket | Test | Kết quả đo | Ghi chép |
|---|---|---|---|---|
| 1 | PRD-0: Đêm 1, headless, Contract v1.0 | 12/12 | Tất định (sha256 trùng); 1 Đêm headless < 1 s | `docs/notes/phase-1.md` |
| 2 | Ticket-02: số chuẩn, 3 Đêm, Contract v1.1 | 30/30 | 29 scenario; 358–818 FPS năng lực ở 1280×720 (đo chi phí mỗi khung, Iris Xe) | `phase-2.md`, `review-phase-2.md` |
| 3 | Ticket-03: dầu đèn, `drain`, thắng lúc bình minh, Contract v1.2 | 42/42 | 43 scenario; 5 test cũ viết lại có ghi lý do, không skip test nào | `phase-3.md`, `review-phase-3.md`, ADR 0001 |
| 4 | Ticket-04: phát hành, Contract v1.3 | 48/48 | Bench 192,4 FPS trung bình / 89,9 FPS 1% thấp / tải 834 ms; soak 0 crash, RSS ×1,085; chữ ≥ 18 px | `phase-4.md`, `bench.json`, `soak.json` |

Review độc lập bằng một subagent khác (không phải agent viết code), đối chiếu `sim.js` với nguyên văn ticket:
- Phase 2: 8 điểm mức thấp, sửa 6, giữ 2 dưới dạng giả định có ghi rõ.
- Phase 3: không có điểm mức cao, sửa 2, có test bắt lỗi.

## 2. Làm với AI: điều gì hiệu quả, điều gì không

**Hiệu quả**
- **Đọc Test Contract trước khi thiết kế.** Lõi game thuần (không DOM, không đồng hồ, RNG có seed) được dùng chung cho bản web và headless. Nhờ vậy ba lần đổi luật lớn không phải viết lại phần hiển thị, và tính tất định không bao giờ vỡ.
- **Chạy scenario trước, viết assert sau.** Lấy số thật từ headless rồi mới khẳng định. Từ Phase 3 không còn vòng "sửa test vì đoán sai số".
- **Sinh scenario bằng script** thay vì viết tay 40+ file JSON.
- **Một lệnh tạo bằng chứng** (`npm run verify -- phase-N`). Không có bằng chứng nào phải gõ tay.

**Không hiệu quả**
- **Lấy đề bài.** Ticket nằm trong một khung riêng của trang lab board: PDF in ra chỉ có màn hình đầu, đọc bằng chữ cũng không được. Phải chụp từng đoạn rồi chép tay. Việc này tốn token và có nguy cơ chép sai. Đề ra theo từng phase nên không tránh được hoàn toàn.
- **Trình duyệt trong app khi bị ẩn** làm `requestAnimationFrame` chạy khoảng 1 FPS. Mọi phép đo hay ảnh chụp phải đi qua hàm trong trang (`__bench`, `__frame`) hoặc Chrome chạy headless.
- **AI đôi khi làm trước khi hỏi.** Ví dụ: viết sẵn công cụ quay video demo trong khi người dùng muốn tự quay.

## 3. Những lần AI sai và cách phát hiện

| Lỗi | Phát hiện bằng |
|---|---|
| Đặt đèn đúng trên mép bán kính tương tác (Phase 1) | Test headless đỏ |
| Đề xuất `node --test tests/`, không chạy được trên Node 22 | Chạy lệnh |
| Giới hạn tốc độ sau khi lướt đặt sai tick, đi 2,667 m thay vì 2,8 m | Test `dash_cooldown` |
| Gió Lạc biến mất sau 119 tick thay vì 120; Bóng Mực sinh trong vùng an toàn | Review độc lập Phase 2 |
| Châm dầu đẩy nhầm Bóng Mực đang đứng ở mép 6 m, do sai số số thực | Review độc lập Phase 3, kèm script tái hiện |
| Script chụp ảnh tự làm treo chính nó (`spawnSync` khi đang làm server) | Hết thời gian chờ, đọc lại code |
| Một dòng số đo ghi theo trí nhớ, không theo lần chạy thật | Tự đọc lại trước khi commit, rồi chạy lại để lấy số đúng |

Bài học: test bắt các lỗi về số. Còn những lỗi về cách hiểu ticket thì một agent khác, chỉ cầm nguyên văn ticket và không biết tôi đã nghĩ gì, bắt tốt hơn hẳn.

## 4. Harness nào giúp nhiều nhất

1. **`npm run verify` cùng skill `verify-phase`:** quy trình tạo bằng chứng cố định, chạy lại được, không ai sửa tay.
2. **Review độc lập bằng subagent:** tìm được những lỗi mà cả agent viết code lẫn test đều không thấy.
3. **`AGENTS.md`:** các quy tắc như "luật chỉ nằm trong `src/sim.js`", "không đổi tên trường của contract", "luật đổi thì sửa test và ghi lý do" giữ cho bản web không tự viết lại luật, và các test cũ được xử lý minh bạch.
4. **Stop hook chạy `npm test`** và **CI** (có cả soak trên Linux): bảo đảm mỗi lượt làm việc và mỗi lần push đều xanh.

## 5. Token và chi phí

| Phase | Token ước tính |
|---|---|
| 1 | ~130k |
| 2 | ~240k (review ~40k) |
| 3 | ~310k (review đo được 162k) |
| 4 | ~190k |
| **Tổng** | **~870k** |

Token là ước tính theo độ dài file đọc/viết và số lượt gọi công cụ (`docs/notes/ai-log.md`); riêng review Phase 3 có số đo thật. Chi phí tính trong gói Claude của tài khoản, không có hoá đơn theo token.

Cách đã tiết kiệm:
- Lấy chữ ticket bằng script hoặc chép một lần ra file; mọi bước sau, kể cả subagent, chỉ đọc file đó.
- Đo FPS bằng hàm trong trang thay vì chụp màn hình.
- Thử nhỏ trước khi làm lớn: bench 5 s trước 30 s; một trang thăm dò 3 s trước khi viết công cụ quay video.

## 6. Nếu làm lại

- Lưu nguyên văn mỗi ticket vào repo (`docs/tickets/`) ngay khi phase mở. Như vậy người review và chính tôi đọc cùng một bản, không phải chụp lại.
- Dùng `rem` và phím có thể đổi ngay từ Phase 1. Ticket nào rồi cũng yêu cầu dễ tiếp cận, và sửa muộn thì phải đụng mọi chỗ.
- Hỏi trước những việc mang dấu ấn cá nhân (video, giọng nói, lời giới thiệu), trước khi để AI làm sẵn.
- Chạy review độc lập ngay sau khi viết xong luật, trước khi viết ghi chép, để bảng nghiệm thu chỉ cần viết một lần.
