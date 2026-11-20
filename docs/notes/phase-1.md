# Phase 1 — PRD-0 · Đêm 1 Đảo Bến (Test Contract v1.0)

## Thiết kế

- Logic game nằm trong `src/sim.js`: hàm thuần, 60 tick/giây, RNG có seed, không dùng DOM hay đồng hồ thật.
- Cả bản web (`web/main.js`, Three.js) và chế độ headless (`src/headless.mjs`) gọi cùng `createGame` / `step`. Vì vậy hai bản có cùng luật và chỉ cần kiểm luật ở một chỗ.
- Thứ tự xử lý mỗi bước:
  1. di chuyển và nhảy;
  2. tỏa sáng;
  3. nạp đèn;
  4. nhặt đom đóm;
  5. Bóng Mực di chuyển, bị chặn ở vùng an toàn;
  6. Bóng Mực chạm người chơi;
  7. sinh đom đóm và Bóng Mực;
  8. kiểm tra hết giờ.

## Giả định (PRD-0 không quy định)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| A1 | "Tốn ánh sáng" khi tỏa sáng | Trừ `pulse_cost` = 1 đom đóm đang mang. Không đủ thì không kích hoạt, không có sự kiện. |
| A2 | Đèn nào làm Bóng Mực sợ | Chỉ đèn **đã sáng**. Bóng Mực không vào được vòng `safe_radius` quanh đèn đó. |
| A3 | Nạp đèn | Bấm `interact` trong `interact_radius` của đèn chưa sáng gần nhất. Mỗi lần nạp min(đang mang, còn thiếu). Đèn nhớ phần đã nạp. |
| A4 | Bị chạm | −1 lửa, đánh rơi floor(đang mang × 0,5) đom đóm. Đom đóm rơi mất luôn. Sau đó bất tử 1,5 s. Bóng Mực đang choáng không gây sát thương. |
| A5 | Đom đóm | 20 con lúc đầu; cứ 3 s sinh 1 con nếu đang dưới 20. Tự nhặt khi đứng trong `pickup_radius`, mang tối đa 5. |
| A6 | Bóng Mực | 2 con ở mép đảo lúc đầu (không có sự kiện, vì là dựng màn). Sau đó mỗi 45 s thêm 1 con, tối đa 5. Luôn đuổi thẳng, tốc độ 3,5 m/s (chậm hơn Mây 6 m/s). |
| A7 | Rơi khỏi đảo | Không có: Mây bị giữ trong bán kính 40 m (`fall_enabled: false`). |
| A8 | Điểm | +10 mỗi đom đóm nhặt, +100 mỗi đèn thắp, +5 mỗi Bóng Mực bị choáng. Khi thắng cộng thêm 2 × floor(giây còn lại) + 50 × lửa còn lại. |
| A9 | Scenario `random_shades:false` hoặc `random_motes:false` mà không có danh sách | Không có con nào, kể cả con ban đầu. |
| A10 | Thắng | Chỉ xét lúc một đèn vừa được thắp. Scenario dựng sẵn đủ 5 đèn sáng thì không tự thắng. |

## Tiêu chí nghiệm thu → bằng chứng

Bằng chứng do `npm run verify -- phase-1` sinh ra, nằm trong `docs/proof/phase-1/`.

| Yêu cầu | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| Headless đúng định dạng: snapshot từ tick 0, mỗi N tick, dòng `end` cuối | test `output format` | tests.txt | đạt |
| Tất định | chạy 2 lần, so từng byte; so sha256 | test `determinism`; README.md mục Determinism | đạt (IDENTICAL) |
| Nhặt đom đóm, nạp, thắp đèn | scenario `light_one_lantern` | scenarios/light_one_lantern.jsonl | đạt: 5 lần `mote_picked`, `deposit`, `lantern_lit`, 150 điểm |
| Thắng khi thắp đèn cuối, cộng thưởng; đèn dựng sẵn không có điểm | scenario `win_all_lit` | scenarios/win_all_lit.jsonl | đạt: 848 điểm, dừng ở tick 1 |
| Bị chạm mất lửa, đánh rơi, thua khi hết lửa | scenario `shade_hit_lose` | scenarios/shade_hit_lose.jsonl | đạt |
| Tỏa sáng: tốn ánh sáng, làm choáng và đẩy lùi Bóng Mực trong tầm | scenario `pulse_stun` | scenarios/pulse_stun.jsonl | đạt |
| Thua khi trời sáng | scenario `dawn` | scenarios/dawn.jsonl | đạt |
| Bóng Mực không vào vùng an toàn của đèn sáng | scenario `safe_radius` | scenarios/safe_radius.jsonl | đạt |
| Hướng di chuyển xoay theo `cam_yaw_deg` đúng công thức | scenario `camera_yaw_move` | test `camera yaw` | đạt |
| File sai định dạng → mã thoát 2 | test `malformed` | tests.txt | đạt |
| `tuning` khớp số thật của game | test `contract tuning equals` | tests.txt | đạt |
| Chơi được Đêm 1, có HUD, chơi lại được | chơi thử trong trình duyệt | title.jpg, gameplay.jpg | đạt |

## Đánh giá

- Đạt mọi bàn giao của PRD-0: chơi được, README, `game.contract.json`, headless, bằng chứng, harness.
- AI sai một lần: đặt đèn trong scenario đúng trên mép `interact_radius` (3 m). Sai số dấu phẩy động có thể đẩy khoảng cách lên thành 3,0000001. Đã sửa scenario để khoảng cách còn 2 m.
- Bản web lúc đầu quá tối và cây che camera. Đã tăng ánh sáng nền và dời cây ra mép đảo.
- Chưa có bộ đo FPS (PRD-0 không yêu cầu).
