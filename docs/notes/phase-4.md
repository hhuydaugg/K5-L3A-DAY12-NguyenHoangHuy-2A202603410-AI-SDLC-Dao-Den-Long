# Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Test Contract v1.3)

- **Bằng chứng:**
  - `bench.json`, `soak.json` (ở thư mục gốc, do tôi tự chạy);
  - `docs/proof/phase-4/`, sinh bằng `npm run verify -- phase-4`, kèm ảnh chụp;
  - số đo cỡ chữ ở bảng dưới.
- **Bản phát hành:** GitHub Release `v1.0.0` (file zip chạy được, video demo).
- **Retro cả dự án:** `docs/retro.md`.

## Thay đổi thiết kế

- **Cảnh benchmark nằm trong lõi game** (`createBench` trong `src/sim.js`). Lõi có thêm cờ `g.bench`, chỉ dùng cho cảnh này. Khi bật cờ:
  - Mây không bị chạm tới (không nhặt, không sát thương, Bóng Mực không đuổi);
  - đèn không hao dầu;
  - Đêm không kết thúc.

  Các bước khác của tick chạy như thật, nên Bóng Mực vẫn đi theo luật `wander`. Cờ này không làm đổi đầu ra headless: mọi test cũ vẫn đạt và tính tất định không đổi.
- **Bản web đo trong chính trang game** (`?bench=1`). `tools/bench.mjs` dựng server tạm, mở trình duyệt, nhận kết quả qua `POST /__bench` rồi ghi `bench.json`. Không cần thư viện npm (Playwright, Puppeteer…).
- **Bảng xếp hạng** dùng chung `src/leaderboard.js` (thuần, có test) cho server và trang.
  - Server giữ file trên đĩa và có lệnh xuất ra file.
  - Trang mở không qua server (chỉ là thư mục tĩnh) thì tự lưu vào bộ nhớ của trình duyệt.
- **Dễ tiếp cận:** mọi cỡ chữ theo `rem` với gốc 18 px; chế độ chữ lớn đổi gốc thành 22,5 px. Phím đọc từ `settings.keys`, không còn viết cứng trong code.

## Giả định mới

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| A-25 | Soak: "Đêm thứ i dùng seed 7 + i" | i đếm từ 0, nên Đêm đầu dùng đúng seed truyền vào (7, 8, …, 16). |
| A-26 | Soak: RSS của Node dao động do JIT | Đo RSS sau khi gọi `gc()`, và chạy với `--single-threaded --optimize-for-size`. Lý do ở bảng đo bên dưới. Heap JS đứng yên quanh 4,2–4,7 MB qua 40 Đêm, nên không có rò rỉ trong game. |
| A-27 | Benchmark: cửa sổ 1280×720 với game web | Chrome ở chế độ `--app`, cửa sổ 1280×720, `--force-device-scale-factor=1`. Canvas luôn đúng 1280×720 với pixel ratio 1; `bench.json` có trường `canvas` để kiểm. |
| A-28 | Hướng bay của camera | Cùng quy ước góc với bản đồ: (30 cos a, 15, 30 sin a), a tăng dần, một vòng 15 s, bắt đầu ở (30, 15, 0). |
| A-29 | "Bóng Mực vẫn đi theo luật `wander`" trong cảnh bench | Mây vô hình với Bóng Mực, vì nếu đuổi thì không còn là `wander`. Dầu không hao nên không có đèn yếu. Bóng Mực bay về đèn tắt L4, L5 (A-18). |
| A-30 | `peak_mem_mb` của bản web | `null`, vì trang không đọc được RSS của tiến trình trình duyệt. Thêm `js_heap_peak_mb` (heap JS của trang) để tham khảo. |
| A-31 | `load_ms` | Từ lúc tiến trình `node tools/bench.mjs` bắt đầu (`performance.timeOrigin`) tới khung đầu tiên của cảnh bench (giờ hệ thống của trang). Có tính cả thời gian mở trình duyệt. |
| A-32 | `<run_cmd> --export-leaderboard out.json` | `run_cmd` = `node web/serve.mjs`. Với `npm start`, npm sẽ coi `--export-leaderboard` là cờ của chính npm. |
| A-33 | Tên trên bảng xếp hạng | Chấp nhận chữ Unicode (tiếng Việt có dấu), số và `_`, dài 3–12 ký tự sau chuẩn hoá NFC. |
| A-34 | Điểm và seed khi lưu sau khi thua | `score` là tổng các Đêm đã thắng, có thể bằng 0. `seed` là seed của lượt chơi; Đêm n dùng seed + n − 1. |
| A-35 | Phím dành riêng | ← → giữ cho xoay camera và không gán được, để luôn còn một cách xoay camera bằng bàn phím. |

## Tiêu chí nghiệm thu → bằng chứng

| Yêu cầu Ticket-04 | Số đo / tiêu chí | Bằng chứng | Kết quả |
|---|---|---|---|
| Benchmark: lệnh, cảnh chuẩn, 1280×720, tắt vsync, 3 s khởi động, đo `--duration` s, thoát mã 0 | Đúng 200 Bóng Mực `wander`, 100 đom đóm, L1–L3 dầu 100; không sinh, không hao, không kết thúc | `bench.json`; test `bench scene…`; ảnh `bench_scene.png` | đạt |
| Ngưỡng bench: `avg_fps` ≥ 60, `p1_low_fps` ≥ 30, `load_ms` ≤ 10000 | Máy tôi (Iris Xe): 192,4 / 89,9 / 834 ms; `frame_ms_p95` 8,6 ms; 5774 khung trong 30 s | `bench.json` | đạt trên máy tôi; máy chấm do giảng viên đo |
| Soak: 10 Đêm, 1 tiến trình, input ngẫu nhiên theo seed | `crashes` = 0; `mem_end_mb` ≤ 1,2 × `mem_start_mb` | `soak.json`: 41,4 → 44,9 MB (1,085); test soak 3 Đêm trong `contract.test.mjs`; CI chạy lại trên Linux | đạt |
| Bảng xếp hạng: nhập tên sau Bình Minh hoặc khi thua; tên 3–12 ký tự; top 10; sắp theo điểm, bằng điểm thì ai đạt trước đứng trên; lưu trên đĩa; có màn hình từ menu; lệnh xuất ra file | Hàm `insert` và `validName`; lệnh xuất đọc đúng file | `tests/leaderboard.test.mjs` (4 test); kiểm trong trình duyệt: tên "ab" bị chặn, "Hoàng_Huy" được lưu vào `data/leaderboard.json` và hiện trên bảng | đạt |
| Đổi phím: mọi hành động, báo trùng, khôi phục mặc định, được lưu | Gán E cho "Nhảy" bị từ chối kèm thông báo "Phím E đang dùng cho “Thắp / châm dầu”"; gán J thì được lưu | Kiểm trong trình duyệt | đạt (kiểm tay) |
| Phụ đề / chỉ báo hình ảnh: Bóng Mực xuất hiện kèm mũi tên ở mép, gió sắp thổi, 10 s cuối, đèn dưới 30 dầu | Có dòng phụ đề cho cả 4 tình huống, bật/tắt trong Cài đặt | `web/main.js` (`caption`, `edgeArrow`) | đạt (kiểm tay) |
| Giảm chuyển động | Không rung camera, không chớp màn hình, đồng hồ không nhấp nháy | Cài đặt "Giảm chuyển động" | đạt (kiểm tay) |
| Cỡ chữ ≥ 18 px ở 1280×720; chữ lớn ×1,25 | Duyệt mọi phần tử có chữ đang hiện. Cỡ nhỏ nhất ở menu, cài đặt, bảng xếp hạng, HUD Đêm 2: **18 px**; khi bật chữ lớn: **22,5 px** | Đo bằng script trong trình duyệt ở 1280×720 | đạt |
| Cài đặt tối đa 3 lệnh; README đủ mục; CHANGELOG có cả 4 phase; CREDITS; LICENSE | `git clone` → `npm install` → `npm start` | README, CHANGELOG.md, CREDITS.md, LICENSE | đạt |
| Release `v1.0.0` có bản chạy được | `dao-den-long-v1.0.0.zip` (`npm run release`): giải nén rồi chạy `node web/serve.mjs` | GitHub Release `v1.0.0` | đạt |
| Contract v1.3: `bench_cmd`, `soak_cmd`; giữ mọi yêu cầu v1.0–v1.2 | Test contract; 48/48 test | `docs/proof/phase-4/` | đạt |
| Retro và video demo dưới 5 phút | `docs/retro.md`; video do tôi tự quay, đính kèm Release `v1.0.0` | Release `v1.0.0` | retro: đạt; video: tôi tự quay và tải lên |

### Đo RSS của soak với các cờ của Node (A-26)

Mỗi dòng là 3 lần chạy với seed 7, 42, 99, mỗi lần 10 Đêm, trên Windows 11 với Node 22. Tỉ lệ = RSS lúc cuối / RSS sau khi tải Đêm đầu. Không có cờ thì kết quả thay đổi giữa các lần chạy với cùng seed, vì phụ thuộc lúc V8 dọn bộ nhớ.

| Cờ của Node | Tỉ lệ | Thời gian |
|---|---|---|
| chỉ `--expose-gc` | 1,14 · 1,08 · 1,24: **có lần vượt 1,2**; đo sau từng Đêm trong lần chạy 30 Đêm có lúc tới 1,6 | 0,3–0,4 s |
| `--max-semi-space-size=1` | 1,19 · 1,35 · 1,22 | 0,3–0,4 s |
| `--single-threaded` | 1,17 · 1,17 · 1,18 | 1,4 s |
| `--optimize-for-size` | 1,21 · 1,11 · 1,25 | 0,4 s |
| `--single-threaded --optimize-for-size` (**đã chọn**) | 1,12 · 1,12 · 1,13 | 1,6 s |
| `--jitless` | 1,11 · 1,11 · 1,05 | 0,9 s |

Không chọn `--jitless`: nó tắt JIT, nên con số không còn giống lúc game chạy thật. Phần RSS tăng lên nằm ở bộ nhớ của trình biên dịch và các luồng chạy nền của V8, không nằm ở heap JS. Nền của Node chỉ khoảng 37 MB, nên vài MB đó đã thành 20–30%.

## Đánh giá

- Mọi yêu cầu đo được bằng máy đều có lệnh chạy lại được (`npm run bench`, `npm run soak`, `npm test`), và kết quả đã được commit.
- Kiểm tay, không có test tự động: đổi phím trong giao diện, phụ đề, giảm chuyển động, chế độ bảng màu. Bảng trên ghi rõ những mục này.
- Rủi ro còn lại:
  - FPS trên máy chấm phụ thuộc GPU của máy đó.
  - Trên máy tôi, kể cả GPU tích hợp, số đo vẫn gấp khoảng 3 lần ngưỡng `avg_fps` và `p1_low_fps`.
  - Lệnh bench cần cài sẵn Chrome, Edge hoặc Chromium. Có thể chỉ đường dẫn bằng `--browser` hoặc `BENCH_BROWSER`.
