# Phase 3 — Ticket-03 "Đèn cạn dầu" (Test Contract v1.2)

- **Quyết định thiết kế:** `docs/adr/0001-lantern-fuel.md`.
- **Thay đổi phá vỡ tương thích:** `CHANGELOG.md`.
- **Bằng chứng:** `docs/proof/phase-3/`, sinh bằng `npm run verify -- phase-3`, kèm hai ảnh chụp bản web.

## Thay đổi thiết kế (tóm tắt)

- **Dầu đèn** lưu bằng số nguyên, đơn vị 1/60.
  - Bước 2 trừ hao 1 đơn vị/tick, cộng 5 đơn vị/tick cho mỗi Bóng Mực đang `drain`.
  - Ngay sau đó, đèn còn ≤ 0 thì tắt.
- **Tương tác (bước 5)** chọn đèn gần nhất trong số đèn còn nhận được:
  - đèn chưa sáng: nạp tới 10, hoặc 5 nếu đã từng sáng;
  - đèn đang sáng: châm dầu.
- **Vùng an toàn, điểm sinh và vòng sáng** đều dùng chung `hasSafeZone` (dầu ≥ 30).
- **Bóng Mực có thêm trạng thái `drain`.**
  - Con `wander` bay về đèn yếu, nếu không có thì về đèn tắt.
  - Cách đèn yếu ≤ 2 m thì đứng hút.
  - Châm dầu lên ≥ 30 thì Bóng Mực bị đẩy ra mép như lúc đèn vừa thắp.
- **Thắng chỉ xét lúc bình minh.** Hết Ngọn Lửa vẫn thua trước.
- **Bản web:**
  - thanh dầu, đèn sắp cạn nhấp nháy 1 Hz;
  - đèn tắt bị xẹp 20% và có vết rách;
  - HUD "đang mang / sức chứa" và "(cần N)";
  - mũi tên chỉ ưu tiên đèn sắp cạn;
  - cài đặt "Bảng màu dễ phân biệt" (Bóng Mực #00B3FF, cảnh báo trắng kèm ⚠).

## Giả định mới (tiếp nối A-01..A-17 của Phase 2)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| A-18 | Tốc độ Bóng Mực khi bay về đèn yếu hoặc đèn tắt | Dùng tốc độ Bóng Mực của Đêm (4, Đêm 3 là 4,5), vì ticket gọi đây là "đi tới" một đích cụ thể. Đi lang thang ngẫu nhiên, khi không có đèn nào để tới, vẫn là 1,5 m/s (A-06). |
| A-19 | Bóng Mực có chọn lại đèn mỗi tick không; scenario đặt `drain` mà không ghi `target_lantern_id` | Giữ đèn đã chọn khi đèn đó còn đủ điều kiện (đèn yếu, hoặc đèn tắt khi không có đèn yếu), nên `target_lantern_id` của scenario có tác dụng. `drain` không ghi đích thì lấy đèn gần nhất. |
| A-20 | "Ghi `fuel_drain` mỗi 60 tick khi đang hút" | Mỗi Bóng Mực đếm số tick đã hút. Sự kiện phát ở tick hút thứ 60, 120, … với `fuel` sau khi đã trừ hết trong tick đó. |
| A-21 | "Đèn đầy dầu không được chọn" | Đèn đầy là đèn có đúng 6000 đơn vị. Vì bước 2 trừ dầu trước bước 5, đèn sáng gần như luôn thiếu một chút. Bấm E ở đèn 99,98 dầu vẫn tốn 1 đom đóm, đúng theo công thức `ceil((100 − fuel) / 10)`. |
| A-22 | Châm dầu "lên ≥ 30" khi đèn vốn đã ≥ 30 | Chỉ đẩy Bóng Mực ra khi dầu đi từ dưới 30 lên ≥ 30. Đèn đã ≥ 30 thì Bóng Mực chỉ đứng ở mép, nên không đẩy (sửa sau review, xem `review-phase-3.md` #1). |
| A-23 | Khoảng cách "Mây vào trong 6 m" khi đang `drain` | Đo theo XZ, giống ngưỡng phát hiện 12 m của Phase 2. |
| A-24 | Đèn `lit: false` trong scenario mà có `fuel` | Bỏ qua `fuel`, đèn tắt luôn có dầu 0. `ever_lit` mặc định bằng `lit`. |

## Tiêu chí nghiệm thu → bằng chứng

Mọi dòng dưới đây có test trong `tests/headless.test.mjs`. Kết quả: 42/42 đạt (`docs/proof/phase-3/tests.txt`).

| Yêu cầu Ticket-03 | Tiêu chí kiểm được | Scenario | Kết quả |
|---|---|---|---|
| Hao 1/s; hết dầu thì tắt, `deposited = 0`, `ever_lit` giữ `true`, phát `lantern_out` | Dầu 1 → 0,5 ở tick 30 → tắt ở tick 60 | `fuel_burn_out` | đạt |
| Snapshot `fuel` 1 chữ số thập phân | 99,5 ở tick 30 | `fuel_burn_out` | đạt |
| Thắp lại cần 5; +5/đom đóm, +40; `relit_count`; `relight: true` | Điểm 65, sức chứa 12, dầu 100 | `relight` | đạt |
| Châm dầu: `used = min(mang, ceil((100 − fuel)/10))`, +10 dầu mỗi đom đóm, tối đa 100 | 55 dầu (còn 54,98 sau bước 2) → dùng 5, lên 100; 20 dầu với 3 đom đóm → 50 | `refuel`, `refuel_partial` | đạt |
| Sức chứa 10 + 2 × số lần thắp, tối đa 20 | Có 1 lần thắp: nhặt tới 12 thì dừng | `capacity_pickup` | đạt |
| Đèn < 30 mất vùng an toàn; đúng 30 vẫn còn | Ở tick 30 (dầu 30,0) Bóng Mực bị chặn ở 6 m; tick 31 thì vào được | `safe_zone_threshold` | đạt |
| `wander` → đèn yếu gần nhất; ≤ 2 m thì `drain`, đứng yên, hút 5/s cộng với hao 1/s | `drain` ở tick 60 tại đúng 2 m; mất 6 dầu mỗi 60 tick; `fuel_drain` ở tick 120/180/240; đèn tắt ở tick 250 thì Bóng Mực về `wander` | `shade_drain` | đạt |
| Nhiều Bóng Mực hút thì cộng dồn | Hai con: 20 → 9 sau 60 tick | `shade_drain_two` | đạt |
| `drain` → `chase` khi Mây trong 6 m | Đổi trạng thái ở tick 33, lúc cách 5,88 m | `drain_to_chase` | đạt |
| Châm lên ≥ 30 thì đẩy ra mép trong ≤ 30 tick, vô hại | Ở mép 6 m tại tick 31; không bị chạm. Châm đèn vốn đã ≥ 30 thì không đẩy con nào | `refuel_ejects_drain`, test `refuelling a lantern already >= 30…` | đạt |
| Tỏa Sáng trúng Bóng Mực đang `drain`: +15 | Điểm 15 | `pulse_drain_bonus` | đạt |
| Thắng lúc bình minh khi đủ ngưỡng; thưởng +50 + floor(dầu) mỗi đèn, +50 mỗi Ngọn Lửa | `dawn_survived`, 1001 điểm | `dawn_win` | đạt |
| Thiếu đèn thì thua `dawn`; ngưỡng 3/5, 4/6, 5/7 | 2/5 thua; Đêm 2 có 3/6 thua; `winNeed` = 3, 4, 5 | `dawn_lose_two_lit`, `night2_dawn_needs_four` | đạt |
| Hết Ngọn Lửa ở chính tick bình minh vẫn thua `no_flames` | Đủ đèn, bị chạm ở tick cuối → `no_flames` | `dawn_no_flames` | đạt |
| Thắp đủ đèn không kết thúc Đêm | Hết 600 tick vẫn `playing` | `all_lit_keeps_playing` | đạt |
| Thời lượng 240/270/300 s | `time_left_s` ở tick 0 của Đêm 2/3; 238,333 ở tick 100 Đêm 1 | test `v1.2 snapshot fields` | đạt |
| Contract v1.2: tuning mới; scenario sai `target_lantern_id` / `fuel` → mã 2 | `game.contract.json` = `TUNING`; `bad_target`, `bad_fuel` thoát mã 2 | `contract.test.mjs`, test `malformed` | đạt |
| Tất định và một Đêm ≤ 30 s | sha256 trùng ở 3 Đêm; một Đêm đầy đủ chạy 0,3–0,5 s | `docs/proof/phase-3/README.md` | đạt |
| Hiển thị: thanh dầu, nhấp nháy 1 Hz khi < 30, đèn tắt xẹp và rách, bảng màu dễ phân biệt | Xem bằng mắt | `fuel_bar.jpg`, `lantern_out.jpg` | đạt (kiểm tay) |

## Test cũ phải sửa vì luật đổi

| Test cũ | Lý do | Xử lý |
|---|---|---|
| `last lantern wins with time + flame bonus` (scenario `win_all_lit`) | Ticket-03 bỏ thắng sớm và thưởng thời gian | Đổi tên scenario thành `all_lit_keeps_playing`. Test giờ khẳng định Đêm **không** kết thúc và điểm là 5 + 100. |
| `all lit on the very tick time runs out is a win` (scenario `win_on_dawn_tick`) | Lý do kết thúc đổi từ `all_lit` sang `dawn_survived`; thưởng đổi | Đổi tên thành `dawn_win`. Khẳng định `dawn_survived` và 1001 điểm theo công thức mới. |
| `pick 10 motes … score counts deposited motes` | +5 mỗi đom đóm; `lantern_lit` có thêm `relight` | Giữ test, thêm `relight: false` và khẳng định 150 điểm |
| `v1.1 snapshot fields` | Đêm 1 dài 240 s; có thêm trường | Đổi thành `v1.2 snapshot fields`: kiểm thêm `fuel`/`ever_lit`/`relit_count`/`capacity`, `time_left_s` 238,333, Đêm 2/3 dài 270/300 s |
| `pause freezes sim_tick …` | Đêm 1 dài 240 s | Đổi số kỳ vọng từ 300 sang 240 |

Không test nào bị bỏ qua (skip). Các test Phase 1–2 khác vẫn giữ nguyên và đạt.

## Đánh giá

- **Review độc lập** (một subagent khác soát `sim.js` với nguyên văn ticket): không có sai lệch mức cao; 2 điểm nhỏ đã sửa, có test. Chi tiết ở `docs/notes/review-phase-3.md`.
- Luật mới chỉ nằm trong `src/sim.js`. Bản web gọi `fuelOf`, `hasSafeZone`, `capacityOf`, `winNeed` để hiển thị.
- Còn kiểm tay, chưa có test tự động: các chi tiết hình ảnh (nhấp nháy, xẹp, vết rách) và việc cài đặt bảng màu được lưu.
