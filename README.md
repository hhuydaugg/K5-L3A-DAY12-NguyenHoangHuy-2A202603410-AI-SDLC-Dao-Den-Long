# Đảo Đèn Lồng

> **Video demo:** (sẽ có ở bản phát hành `v1.0.0`)

Game 3D góc nhìn thứ ba. Bạn điều khiển Mây, người giữ đèn nhỏ tuổi: gom đom đóm, thắp các Đèn Lồng Lớn, châm dầu để đèn không tắt, và đuổi Bóng Mực đang hút dầu, cho tới khi trời sáng. Lần lượt trên ba hòn đảo:
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
| E | thắp đèn gần nhất (trong 2 m), hoặc châm dầu nếu đèn đang sáng |
| F | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m |
| Esc / P | tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |

## Luật chơi và cách tính điểm (Ticket-03)

- **Đèn có dầu.**
  - Vừa thắp: đầy 100.
  - Đang sáng: hao 1/s.
  - Hết dầu thì tắt; thắp lại chỉ cần 5 đom đóm.
  - Mỗi đom đóm châm vào được +10 dầu.
- **Đèn dưới 30 dầu mất vùng an toàn.** Bóng Mực tới gần, đứng hút thêm 5 dầu/s. Tỏa Sáng hoặc châm dầu lên ≥ 30 để đuổi chúng.
- **Thắng** khi trời sáng mà Mây còn Ngọn Lửa và còn ít nhất 60% số đèn đang sáng (Đêm 1/2/3: 3/5, 4/6, 5/7). Thắp đủ đèn không kết thúc Đêm sớm.
- **Thua** khi hết 3 Ngọn Lửa, hoặc trời sáng mà không đủ đèn. Đêm 1/2/3 dài 240/270/300 s.
- **Sức chứa** đom đóm: 10, cộng 2 sau mỗi lần thắp, tối đa 20.
- **Rơi khỏi đảo** mất 1 Ngọn Lửa và toàn bộ đom đóm đang mang.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp mới, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Bóng Mực trúng Tỏa Sáng | +5 mỗi con; +15 nếu nó đang hút dầu |
| Bình minh, chỉ khi thắng | +50 + floor(dầu) mỗi đèn đang sáng; +50 mỗi Ngọn Lửa còn lại |

Tổng điểm game là tổng điểm các Đêm đã thắng.

## Test và chế độ headless (Test Contract v1.2)

```bash
npm test                       # unit + một scenario headless cho mỗi tính năng + kiểm tra contract
npm run verify -- phase-3      # sinh bằng chứng vào docs/proof/phase-3/
node src/headless.mjs --seed 1 --night 2 --ticks 600 --out run.jsonl \
     [--scenario tests/scenarios/shade_drain.scenario.json] [--inputs file.json] [--snapshot-every 10]
```

- `game.contract.json`:
  - khai `contract_version: "1.2"` và đúng số chuẩn của Ticket-02/03;
  - test bắt buộc `tuning` trùng với `TUNING` trong `src/sim.js`;
  - `shade_speed` là 4,0 cho Đêm 1–2; Đêm 3 dùng 4,5 theo ticket (contract chỉ có một khoá).
- Mã thoát: 0 khi thành công; 2 khi tham số hoặc file inputs/scenario sai định dạng; 1 khi gặp lỗi khác.
- Một Đêm đầy đủ chạy dưới 1 s (xem `docs/proof/phase-3/README.md`).

## Sáng tạo của tôi

- **Đèn trời:** khi một đèn được thắp, bảy chiếc đèn trời bay lên từ đó.
- **Ông Đăng:** lời dẫn riêng cho từng Đêm ở màn giới thiệu.
- **Âm thanh** tạo bằng WebAudio, không dùng file: nhạc nền đêm và hiệu ứng.
- **Đom đóm rơi nhấp nháy** khi sắp tan; **Bóng Mực lớn dần** khi đang `spawning`, và **phập phồng** khi đang hút dầu.

Mọi phần trên chỉ nằm trong `web/main.js` (phần hiển thị) và không chạm vào `src/sim.js`. Vì vậy đầu ra headless không đổi: mọi test headless vẫn xanh, xem `docs/proof/phase-3/`.

## Tài liệu

- Lịch sử thay đổi và các thay đổi phá vỡ tương thích: [CHANGELOG.md](CHANGELOG.md).
- Quyết định thiết kế: `docs/adr/` (ADR 0001: đèn có dầu, thắng lúc bình minh).
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
