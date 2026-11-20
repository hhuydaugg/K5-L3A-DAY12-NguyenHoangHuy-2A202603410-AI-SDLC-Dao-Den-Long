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
