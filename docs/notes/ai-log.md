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

## Phase 3

| Việc | Cách làm | Token ước tính |
|---|---|---|
| Lấy Ticket-03 | Hai file PDF người dùng gửi chỉ in được màn hình đầu. Nội dung ticket nằm trong khung riêng của trang lab board, không đọc được bằng chữ. Chụp từng đoạn ở khung nhìn cao 2400 px rồi chép tay vào một file văn bản. | ~45k (nhiều ảnh) |
| Sửa `src/sim.js`: dầu, `drain`, luật thắng, sức chứa, điểm | Viết ADR trong đầu trước, rồi sửa đúng các bước 2/4/5/6/7/8/10/11 | ~30k |
| Scenario và test | Sinh 15 scenario bằng một script. Chạy thử từng cái để lấy số thật trước khi viết assert. | ~25k |
| Bản web: thanh dầu, đèn tắt xẹp và rách, HUD, bảng màu dễ phân biệt | Sửa `web/main.js`, `index.html`; kiểm bằng browser pane và các hàm `__game`/`__frame` | ~30k |
| Review độc lập | Subagent soát `sim.js` với ticket | ~160k (subagent) |
| ADR, CHANGELOG, ghi chép, bằng chứng | | ~20k |

Cách tiết kiệm:
- Chép ticket một lần vào file. Các bước sau, kể cả subagent review, chỉ đọc file đó, không chụp lại.
- Viết assert sau khi chạy scenario. Lần này không có vòng sửa test nào vì đoán sai số.
- Một hàm dùng chung (`hasSafeZone`) cho ba chỗ đang xét `lit`, nên không phải tìm và sửa từng chỗ.

Lỗi của AI ở Phase 3:
- Scenario `drain_to_chase` ban đầu cho Mây đi 30 tick, chưa đủ gần 6 m. Phát hiện khi chạy thử trước lúc viết test; đã tăng lên 60 tick.
- Châm dầu cho đèn vốn đã ≥ 30 vẫn đẩy nhầm Bóng Mực đang đứng ở mép, do sai số số thực. Agent viết code không thấy; review độc lập bắt được và đưa ra cách tái hiện. Đã sửa và thêm test.
- `src/headless.mjs` báo lỗi khi được import từ `node -e`, vì `process.argv[1]` không có giá trị. Đã thêm kiểm tra.

## Phase 4

| Việc | Cách làm | Token ước tính |
|---|---|---|
| Lấy Ticket-04 | Chụp và chép tay như Ticket-03, cùng một lượt | ~20k |
| Soak test và đo RSS | Viết `tools/soak.mjs`, rồi đo tỉ lệ RSS với 6 cách cấu hình Node trước khi chọn | ~25k |
| Benchmark | Cảnh `createBench` có test; chế độ `?bench=1` trong trang; `tools/bench.mjs` mở Chrome và nhận kết quả qua HTTP. Chạy thử 5 s rồi mới chạy 30 s chính thức. | ~35k |
| Bảng xếp hạng | Module thuần có test; API trên server; màn nhập tên và màn bảng xếp hạng | ~25k |
| Dễ tiếp cận | Đổi phím, phụ đề, giảm chuyển động, cỡ chữ theo `rem`; đo cỡ chữ nhỏ nhất bằng script trong trình duyệt | ~30k |
| Công cụ quay video tự động (đã bỏ) | Thử quay tab bằng MediaRecorder được, nhưng người dùng muốn tự quay | ~15k |
| README, CHANGELOG, CREDITS, ghi chép, retro, đóng gói | | ~40k |

Cách tiết kiệm:
- Thử nhỏ trước khi làm lớn: bench 5 s trước 30 s; một trang thăm dò 3 s để biết Chrome có quay tab và ghi MP4 được không, trước khi viết cả công cụ.
- Đo thật thay vì đoán, ví dụ cờ Node cho soak. Cách đoán đầu tiên (thu nhỏ bộ nhớ thế hệ trẻ của V8) hoá ra không giúp gì.

Lỗi của AI ở Phase 4:
- **Treo vì `spawnSync`:** script chụp ảnh dùng `spawnSync` để chạy Chrome trong khi chính tiến trình đó đang làm server, nên Chrome không tải được trang và bị treo tới khi hết giờ. Đã đổi sang `spawn` bất đồng bộ.
- **Số không qua đo:** bảng RSS ở `phase-4.md` lúc đầu có một dòng ghi theo trí nhớ, không theo lần chạy thật. Phát hiện khi đọc lại trước lúc commit; đã chạy lại và sửa số.
- **Làm việc chưa được hỏi:** viết sẵn công cụ quay video demo trước khi hỏi người dùng có muốn tự quay không. Người dùng muốn tự quay, nên phần đó bị bỏ. Bài học: việc mang dấu ấn cá nhân như video, giọng nói hay lời giới thiệu thì nên hỏi trước.
- **Chỉ đo trên một hệ điều hành:** chọn cờ Node cho soak chỉ dựa trên số đo Windows, trong khi trên Linux tỉ lệ RSS vẫn 1,3–1,6. CI đỏ ngay sau khi push `phase-4`. Đã đo trên Linux bằng một nhánh tạm chạy GitHub Actions (Node 18/20/22), đổi sang `--jitless`, rồi xoá nhánh. Bài học: số đo nào có ngưỡng chấm thì phải đo trên cả hệ điều hành mà máy chấm có thể dùng.
