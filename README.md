# Đảo Đèn Lồng

> **Video demo:** (sẽ có ở bản phát hành `v1.0.0`)

Game 3D góc nhìn thứ ba. Bạn điều khiển Mây, người giữ đèn nhỏ tuổi: gom đom đóm, thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen, lần lượt trên ba hòn đảo:
- **Đêm 1 — Đảo Bến:** 5 đèn.
- **Đêm 2 — Đảo Cau:** 2 đảo nối bằng cầu tre, có bục nhảy và Gió Lạc.
- **Đêm 3 — Đảo Chuông:** 3 tầng, có dốc, tháp chuông và gió mạnh.

Bài cá nhân Day 12 (AI SDLC) — Nguyễn Hoàng Huy, 2A202603410.

## Cài đặt và chạy (cần Node.js ≥ 18; chạy được trên macOS, Linux và Windows)

```bash
git clone https://github.com/hhuydaugg/K5-L3A-DAY12-NguyenHoangHuy-2A202603410-AI-SDLC-Dao-Den-Long.git && cd K5-L3A-DAY12-NguyenHoangHuy-2A202603410-AI-SDLC-Dao-Den-Long
npm install
npm start          # mở http://localhost:8000
```

Game không có thư viện npm nào: three.js đã nằm sẵn trong `web/vendor/`.

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D | đi lại (theo hướng camera) |
| Kéo chuột / ← → | xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Space | nhảy |
| Shift | lướt: 14 m/s trong 0,2 s, hồi chiêu 1,5 s |
| E | nạp ánh sáng vào đèn gần nhất (trong 2 m) |
| F | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m |
| Esc / P | tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |

## Cách tính điểm (chuẩn hoá theo Ticket-02)

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Mỗi đèn thắp | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi con, mỗi lần) | +5 |
| Khi thắng một Đêm | +2 × floor(giây còn lại) + 50 × Ngọn Lửa còn lại |

Tổng điểm game là tổng điểm các Đêm đã thắng.
- **Thắng** khi mọi đèn của Đêm đều sáng.
- **Thua** khi hết 3 Ngọn Lửa, hoặc khi trời sáng: Đêm 1/2/3 lần lượt 300/330/360 s.
- Rơi khỏi đảo mất 1 Ngọn Lửa và toàn bộ đom đóm đang mang.

## Test và chế độ headless (Test Contract v1.1)

```bash
npm test                       # unit + một scenario headless cho mỗi tính năng + kiểm tra contract
npm run verify -- phase-2      # sinh bằng chứng vào docs/proof/phase-2/
node src/headless.mjs --seed 1 --night 2 --ticks 600 --out run.jsonl \
     [--scenario tests/scenarios/drifter_steal.scenario.json] [--inputs file.json] [--snapshot-every 10]
```

- `game.contract.json`:
  - khai `contract_version: "1.1"` và đúng số chuẩn của Ticket-02;
  - test bắt buộc `tuning` trùng với `TUNING` trong `src/sim.js`;
  - `shade_speed` là 4,0 cho Đêm 1–2; Đêm 3 dùng 4,5 theo ticket (contract chỉ có một khoá).
- Mã thoát: 0 khi thành công; 2 khi tham số hoặc file inputs/scenario sai định dạng; 1 khi gặp lỗi khác.
- Một Đêm đầy đủ (21.600 tick) chạy dưới 0,5 s (xem `docs/proof/phase-2/README.md`).

## Sáng tạo của tôi

- **Đèn trời:** khi một đèn được thắp, bảy chiếc đèn trời bay lên từ đó.
- **Ông Đăng:** lời dẫn riêng cho từng Đêm ở màn giới thiệu.
- **Âm thanh** tạo bằng WebAudio, không dùng file: nhạc nền đêm và hiệu ứng.
- **Đom đóm rơi nhấp nháy** khi sắp tan; **Bóng Mực lớn dần** khi đang `spawning`.

Mọi phần trên chỉ nằm trong `web/main.js` (phần hiển thị) và không chạm vào `src/sim.js`. Vì vậy đầu ra headless không đổi: mọi test headless vẫn xanh, xem `docs/proof/phase-2/`.

## Tài liệu

- Ghi chép từng phase (giả định, tiêu chí nghiệm thu, test đã sửa, đánh giá): `docs/notes/phase-*.md`.
- Nhật ký dùng AI: `docs/notes/ai-log.md`.
- Bằng chứng: `docs/proof/phase-*/` (scenario, test, tính tất định, thời gian chạy, FPS, ảnh chụp).
- Harness AI:
  - `AGENTS.md`;
  - `.claude/settings.json`: Stop hook chạy `npm test`;
  - `.claude/skills/verify-phase/`;
  - CI ở `.github/workflows/ci.yml`.
- Tài liệu lab: [GUIDE.md](GUIDE.md), [CHECKPOINTS.md](CHECKPOINTS.md), [SUBMISSION.md](SUBMISSION.md), [RULES.md](RULES.md), [RUBRIC.md](RUBRIC.md).
- Nguồn tài sản: [CREDITS.md](CREDITS.md) · Giấy phép: [LICENSE](LICENSE).
