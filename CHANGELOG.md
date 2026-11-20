# Changelog

Mỗi phase là một tag trên `main`. "Phá vỡ tương thích" là thay đổi làm đầu ra headless hoặc file scenario cũ cho kết quả khác.

## Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (tag `phase-4`, Release `v1.0.0`, Test Contract v1.3)

### Phá vỡ tương thích
- `contract_version` "1.2" → "1.3".
- `run_cmd` đổi từ `npm start` sang `node web/serve.mjs`, để `<run_cmd> --export-leaderboard out.json` chạy được. `npm start` vẫn dùng như cũ.
- Phím mặc định giờ đổi được. Bỏ các phím phụ cố định trước đây (P để tạm dừng, ↑ ↓ để đi, Shift phải để lướt). Ai muốn dùng lại thì gán trong Cài đặt.
- `web/serve.mjs` chỉ nghe trên `127.0.0.1`.

### Thêm mới
- **Benchmark** `node tools/bench.mjs --seed 42 --duration 30 --out bench.json`:
  - cảnh chuẩn `createBench` trong `src/sim.js`;
  - cửa sổ Chrome/Edge 1280×720, tắt vsync;
  - kết quả có các chỉ số FPS, p95, `load_ms`.
- **Soak test** `tools/soak.mjs`: 10 Đêm trong một tiến trình, input ngẫu nhiên theo seed, đo RSS. CI chạy soak trên Linux.
- **Bảng xếp hạng cục bộ:**
  - lưu ở `data/leaderboard.json` qua server cục bộ, giữ top 10;
  - nhập tên sau Bình Minh hoặc khi thua;
  - có màn hình riêng từ menu;
  - xuất ra file bằng `--export-leaderboard`.
- **Dễ tiếp cận:**
  - đổi phím mọi hành động, báo trùng phím, khôi phục mặc định;
  - phụ đề / chỉ báo hình ảnh: Bóng Mực xuất hiện kèm mũi tên ở mép màn hình, gió sắp thổi, 10 giây cuối, đèn dưới 30 dầu;
  - giảm chuyển động: tắt rung camera, chớp màn hình, nhấp nháy đồng hồ;
  - chữ tối thiểu 18 px ở 1280×720, tùy chọn chữ lớn ×1,25.
- `game.contract.json` có thêm `bench_cmd`, `soak_cmd`.
- Đóng gói: `npm run release` tạo `dist/dao-den-long-v1.0.0.zip` từ commit hiện tại.
- Tài liệu: README theo mẫu phát hành; CREDITS liệt kê mọi tài sản và công cụ AI; `docs/retro.md`.

## Phase 3 — Ticket-03 "Đèn cạn dầu" (tag `phase-3`, Test Contract v1.2)

### Phá vỡ tương thích
- Không còn thắng sớm khi mọi đèn sáng. `game_over.reason` không còn giá trị `all_lit`; thắng nay là `dawn_survived`.
- Thắng chỉ xét lúc hết giờ: cần còn sống và ít nhất `ceil(0,6 × số đèn)` đèn đang sáng (Đêm 1/2/3: 3/5, 4/6, 5/7). Không đủ đèn thì thua `dawn`.
- Thời lượng Đêm 1/2/3: 300/330/360 s → **240/270/300 s**.
- Điểm: +10 → **+5** mỗi đom đóm nạp (kể cả thắp lại và châm dầu). Thắp lại +40. Tỏa Sáng trúng Bóng Mực đang hút dầu được +15. Bỏ thưởng thời gian. Khi thắng: +50 + floor(dầu) cho mỗi đèn sáng, +50 cho mỗi Ngọn Lửa. `tuning.score.per_mote` = 5, `per_second_left` = 0.
- Đèn đã sáng nay nhận đom đóm để châm dầu (phát `refuel`, không phát `deposit`).
- Đèn có dầu dưới 30 mất vùng an toàn: Bóng Mực vào được.
- Bóng Mực `wander` không còn đi lang thang ngẫu nhiên khi còn đèn tắt hoặc đèn yếu: nó bay về đèn đó.
- Sự kiện `lantern_lit` có thêm `relight: true|false`.
- `contract_version` "1.1" → "1.2".

### Thêm mới
- `tuning`: `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.
- Snapshot:
  - mỗi đèn có `fuel`, `ever_lit`, `relit_count`;
  - `player.capacity`;
  - Bóng Mực có trạng thái `drain`.
- Scenario:
  - đèn có `fuel`, `ever_lit`;
  - `player.successful_lights`;
  - `shades[].target_lantern_id`;
  - trạng thái `drain`.
- Sự kiện mới: `refuel`, `lantern_out`, `fuel_drain` (mỗi 60 tick hút dầu).
- Sức chứa tăng 2 sau mỗi lần thắp, tối đa 20.
- Bản web:
  - thanh dầu trên đèn; đèn sắp cạn nhấp nháy 1 Hz;
  - đèn tắt bị xẹp 20% và có vết rách;
  - HUD hiện "đang mang / sức chứa" và số đèn cần giữ;
  - cài đặt "Bảng màu dễ phân biệt".

## Phase 2 — Ticket-02 "Ba hòn đảo" (tag `phase-2`, Test Contract v1.1)

### Phá vỡ tương thích
- Mọi số tự chọn ở Phase 1 được thay bằng số chuẩn: sức chứa 10, giá đèn 10, nhặt trong 1 m, Tỏa Sáng tốn 3, tầm 5 m (3D), Bóng Mực 4 m/s.
- Điểm tính khi nạp, không tính khi nhặt.
- Thắng/thua xét sau mỗi tick.
- Thêm rơi khỏi đảo.
- Vị trí đèn Đêm 1 theo bản đồ chuẩn.
- Trạng thái Bóng Mực phải dùng đúng tên `spawning`, `wander`, `chase`, `recoil`, `stunned`.

### Thêm mới
- 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông). `--night 1|2|3`.
- Lướt, bục nhảy, dốc, gió mạnh, Gió Lạc, Bùa Gió, tạm dừng.
- Menu, màn giới thiệu, Bình Minh, cài đặt được lưu, HUD, âm thanh.

## Phase 1 — PRD-0 (tag `phase-1`, Test Contract v1.0)

- Đêm 1 chơi được trong trình duyệt (three.js).
- Logic game thuần JS dùng chung cho bản web và chế độ headless `node src/headless.mjs`.
- `game.contract.json`, test, harness AI (AGENTS.md, Stop hook, skill `verify-phase`, CI) và `npm run verify`.
