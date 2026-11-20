# Đảo Đèn Lồng

> **Video demo:** (sẽ có ở bản phát hành `v1.0.0`)

Game 3D góc nhìn thứ ba. Bạn điều khiển Mây, người giữ đèn nhỏ tuổi: gom đom đóm, thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen, trước khi trời sáng.

Bài cá nhân Day 12 (AI SDLC) — Nguyễn Hoàng Huy, 2A202603410.

## Cài đặt và chạy (cần Node.js ≥ 18, chạy được trên macOS, Linux và Windows)

```bash
git clone https://github.com/hhuydaugg/K5-L3A-DAY12-NguyenHoangHuy-2A202603410-AI-SDLC-Dao-Den-Long.git && cd K5-L3A-DAY12-NguyenHoangHuy-2A202603410-AI-SDLC-Dao-Den-Long
npm install
npm start          # mở http://localhost:8000
```

Game không có thư viện npm nào: three.js đã nằm sẵn trong `web/vendor/`, nên `npm install` chỉ để kiểm tra Node.

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D | đi lại (theo hướng camera) |
| Kéo chuột / ← → | xoay camera |
| Space | nhảy |
| E | nạp đom đóm vào đèn gần nhất |
| F | tỏa sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m |
| Enter / R | bắt đầu / chơi lại |

## Cách tính điểm

| Sự kiện | Điểm |
|---|---|
| Nhặt một đom đóm | +10 |
| Thắp một đèn | +100 |
| Mỗi Bóng Mực bị choáng vì tỏa sáng | +5 |
| Khi thắng | +2 × số giây còn lại (làm tròn xuống) + 50 × số lửa còn lại |

Thắng khi cả 5 đèn đều sáng. Thua khi hết 3 lửa hoặc khi trời sáng (sau 300 s).

## Test và chế độ headless (Test Contract v1.0)

```bash
npm test                       # unit + scenario headless + kiểm tra contract
npm run verify -- phase-1      # sinh bằng chứng vào docs/proof/phase-1/
node src/headless.mjs --seed 1 --night 1 --ticks 600 --out run.jsonl \
     [--scenario tests/scenarios/pulse_stun.scenario.json] [--inputs tests/scenarios/pulse_stun.inputs.json]
```

- `game.contract.json` khai báo lệnh và mọi số trong `tuning`; test bắt buộc các số này trùng với `TUNING` trong `src/sim.js`.
- `fall_enabled: false`: Đêm 1 không có rơi khỏi đảo, Mây bị giữ trong bán kính 40 m, nên không có sự kiện `player_hit` với `by: "fall"`.
- `hit_drop_ratio: 0.5`: số đom đóm đánh rơi khi bị chạm là floor(đang mang × 0,5).
- Mã thoát: 0 khi thành công; 2 khi tham số hoặc file inputs/scenario sai định dạng; 1 khi gặp lỗi khác.

## Sáng tạo của tôi

- **Đèn trời:** khi một đèn được thắp, bảy chiếc đèn trời bay lên từ đó.
- **Âm thanh** tạo bằng WebAudio, không dùng file ngoài: tiếng chuông khi nhặt, hợp âm khi thắp đèn, tiếng vù khi tỏa sáng, tiếng trầm khi bị chạm.
- Đảo sáng dần và sương tan dần theo số đèn đã thắp.

Mọi phần trên chỉ nằm trong `web/main.js` (phần hiển thị). Chúng không chạm vào `src/sim.js`, nên đầu ra headless không đổi: các test headless vẫn xanh, xem `docs/proof/phase-1/`.

## Tài liệu

- Ghi chép từng phase (giả định, tiêu chí nghiệm thu, đánh giá): `docs/notes/phase-*.md`; nhật ký dùng AI: `docs/notes/ai-log.md`.
- Bằng chứng: `docs/proof/phase-*/`.
- Harness AI: `AGENTS.md`, `.claude/settings.json` (Stop hook chạy `npm test`), `.claude/skills/verify-phase/`, CI ở `.github/workflows/ci.yml`.
- Tài liệu lab: [GUIDE.md](GUIDE.md), [CHECKPOINTS.md](CHECKPOINTS.md), [SUBMISSION.md](SUBMISSION.md), [RULES.md](RULES.md), [RUBRIC.md](RUBRIC.md).
- Nguồn tài sản: [CREDITS.md](CREDITS.md) · Giấy phép: [LICENSE](LICENSE).
