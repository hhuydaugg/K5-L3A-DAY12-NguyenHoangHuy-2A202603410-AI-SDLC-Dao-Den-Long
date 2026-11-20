# Nhật ký dùng AI

Công cụ: Claude Code (Claude Opus 5.5) trong Claude desktop app. Harness: `AGENTS.md`, Stop hook trong `.claude/settings.json` (chặn kết thúc khi `npm test` đỏ), skill `.claude/skills/verify-phase`, CI ở `.github/workflows/ci.yml`.

Token là **ước tính**: tính theo độ dài các file đã đọc/viết và số lượt gọi công cụ, không phải số đo chính xác.

## Phase 1

| Việc | Cách làm | Token ước tính |
|---|---|---|
| Đọc tài liệu lab và PRD-0 | Clone repo đề vào thư mục tạm, đọc README, GUIDE, RUBRIC, RULES. PRD-0 lấy từ HTML của lab board (chỉ trích phần chữ). | ~35k |
| Thiết kế và viết lõi | Viết một lần `src/sim.js`, `src/headless.mjs`, scenario và test, sau khi đã đọc Test Contract | ~45k |
| Bản web 3D | `web/main.js`, `index.html`, `serve.mjs`; kiểm bằng browser pane (console, HUD, ảnh chụp) | ~30k |
| Harness, bằng chứng, ghi chép | `tools/verify.mjs`, AGENTS.md, hook, skill, CI, ghi chép | ~20k |

Cách tiết kiệm:
- Đọc Test Contract trước rồi mới thiết kế, nên không phải viết lại.
- Lấy chữ từ HTML lab board bằng một script ngắn thay vì cho model đọc nguyên trang 180 KB.
- Một test so `game.contract.json` với `TUNING`, nên không phải soát hai chỗ bằng tay.

Lỗi của AI:
- Đặt đèn đúng trên mép bán kính tương tác (xem phase-1.md mục Đánh giá).
- Đề xuất `node --test tests/`: Node 22 hiểu đường dẫn thư mục là một file và báo lỗi. Đã đổi sang `node --test`, dùng cách tự tìm file test mặc định.

## Phase 2

| Việc | Cách làm | Token ước tính |
|---|---|---|
| Lấy Ticket-02 | Trang lab board lưu về máy (Phase 2 đã mở trong bản lưu). Một script lấy riêng phần chữ của ticket (~11 KB) để đọc, thay vì đưa cả trang 3 MB vào ngữ cảnh. | ~15k |
| Viết lại `src/sim.js` theo số chuẩn, 3 bản đồ, thứ tự tick, Contract v1.1 | Viết một lần, tách thành 11 bước đánh số theo ticket | ~45k |
| Scenario và test | Sinh 29 scenario bằng một script; 30 test | ~35k |
| Bản web: menu, HUD, âm thanh, 3 Đêm | Viết lại `web/main.js`, kiểm bằng browser pane (ảnh chụp, đo khung hình) | ~45k |
| Review độc lập | Một subagent khác soát `sim.js` với nguyên văn ticket | ~40k (subagent) |
| Bằng chứng, ghi chép | `npm run verify -- phase-2`, `__bench`, ghi chép | ~20k |

Cách tiết kiệm:
- Lấy chữ ticket bằng script.
- Sinh scenario bằng một đoạn code thay vì viết tay 29 file.
- Đo FPS bằng hàm `__bench` chạy trong trang. Khi pane trình duyệt bị ẩn, requestAnimationFrame bị hãm xuống khoảng 1 FPS, nên đo kiểu thường vừa sai vừa tốn lượt.

Lỗi của AI ở Phase 2:
- Khối di chuyển viết lần đầu còn sót vài dòng thừa, vô nghĩa (biến `wasDashing`, một dòng tính `facing` hai lần). Phát hiện khi đọc lại diff, đã xoá trước khi chạy test.
- Giới hạn tốc độ sau khi lướt đặt sai chỗ, làm tick cuối của cú lướt chỉ đi 0,1 m. Test `dash_cooldown` bắt được: đi 2,667 m thay vì 2,8 m. Đã chuyển việc giới hạn sang tick sau.
- Test `hit_drop` ban đầu kiểm ở tick +480 trong khi ván đã thua ở tick 195. Đã cho nhân vật nhiều Ngọn Lửa hơn trong scenario và kiểm theo id từng đom đóm.
