# Phase 2 — Ticket-02 "Ba hòn đảo" (Test Contract v1.1)

## Thay đổi thiết kế

- **Số liệu và luật chuẩn** thay toàn bộ số tự chọn ở Phase 1. `TUNING` giữ các khoá có trong contract; `RULES` giữ phần còn lại của Phần 1; `MAPS` giữ bản đồ chuẩn của 3 Đêm (Phần 2), gồm đèn, điểm sinh, bục nhảy, hàm `ground(x, z)` và tốc độ Bóng Mực.
- **`step()` theo đúng 11 bước** của mục "Thứ tự xử lý", mỗi bước một khối có đánh số trong code.
- Khi tạm dừng, `tick` vẫn tăng nhưng `sim_tick` (`g.steps`) và mọi bộ đếm đứng yên.
- **Địa hình:** `ground(x, z)` trả về độ cao mặt đất, hoặc `null` nếu là biển mây.
  - Đi vào chỗ cao hơn chân quá 0,3 m là gặp vách đứng, bị chặn.
  - Bước ra mép thì rơi xuống tầng dưới; xuống dưới Y = −10 là rơi khỏi đảo.
  - Dốc là mặt phẳng nghiêng. Tháp chuông được mô hình hoá như mặt đất cao 14 m, nên không leo được.
- **Bản web:**
  - luồng menu → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 thì ra màn Bình Minh, thua thì chơi lại Đêm đó;
  - tạm dừng có 4 lựa chọn;
  - cài đặt âm lượng và độ nhạy chuột, lưu bằng localStorage;
  - nhạc nền và 10 loại hiệu ứng âm thanh (WebAudio);
  - HUD theo đúng vị trí trong ticket, bảng màu chuẩn;
  - ánh sáng nền = 0,15 + 0,55 × tỉ lệ đèn sáng.

## Giả định (ticket không quy định, đánh số A-xx, có ghi chú tương ứng trong code)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| A-01 | Thời điểm phát `night_start` trong headless | `tick: 0`, ngay sau snapshot tick 0, vì đây là sự kiện mở đầu Đêm. |
| A-02 | Kiểu của `player.invuln` | Boolean (đang bất tử hay không). Các trường `_s` khác là số giây còn lại. |
| A-03 | Trạng thái của Bóng Mực dựng bằng scenario | `wander` nếu không ghi `state`; cách Mây ≤ 12 m thì chuyển `chase` ngay ở tick đầu. |
| A-04 | Chênh cao khi chạm Bóng Mực | So tâm Bóng Mực (`shade.pos`) với chân Mây (`player.pos`), cần ≤ 1,5 m. |
| A-05 | Trạng thái `spawning` | Kéo dài 30 tick: không di chuyển, không gây sát thương, vẫn bị Tỏa Sáng trúng. |
| A-06 | Tốc độ `wander` | 1,5 m/s về một điểm ngẫu nhiên trên đất trong bán kính 8 m. |
| A-07 | Đom đóm rơi ra ngoài đảo | Nếu điểm trên vành 1,5–2,5 m là biển mây thì đặt tại chỗ Mây đứng (không ai nhặt được đom đóm trên biển). |
| A-08 | Độ cao của Gió Lạc | Mặt đất + 1,5 m. Bóng Mực ở mặt đất + 1 m. Cả hai bay qua địa hình; chỉ vùng an toàn chặn được Bóng Mực. |
| A-09 | Nạp đèn và nhặt khi khác tầng | Ngoài khoảng cách XZ, cần chênh cao giữa chân Mây và chân đèn hoặc đom đóm ≤ 1,5 m, để không nạp xuyên sàn ở Đêm 3. |
| A-10 | Điểm xuất phát Đêm 3 | (0, 0, −30): điểm (0, 0, 0) nằm trong tháp chuông. Đêm 1 và 2 xuất phát ở (0, 0, 0). |
| A-11 | "Điểm sương ngẫu nhiên" để sinh Gió Lạc | Các điểm sinh Bóng Mực của Đêm đó. |
| A-12 | Tỏa Sáng trúng Gió Lạc đang `idle` | Không có tác dụng (ticket chỉ nói về `chase` và `flee`). |
| A-13 | Gió Lạc đã cướp xong | Chạy `flee` 240 tick rồi chuyển `removed`, vẫn hiện trong snapshot với số đã cướp. Con mới chỉ sinh khi số con chưa `removed` < 2. |
| A-14 | Tốc độ ngay sau khi lướt | Quay về tối đa tốc độ chạy, sau đó dừng hoặc tăng tốc trong 0,1 s như thường. |
| A-15 | Hướng gió | Lấy ngẫu nhiên theo seed, làm tròn 0,1°, đo từ +X ngược chiều kim đồng hồ như bản đồ. Gió đẩy thêm 2 m/s vào chuyển động của Mây. |
| A-16 | Nhảy trong lúc lướt | Bị bỏ qua: lướt giữ nguyên độ cao, trên đất cũng như trên không. |
| A-17 | Trần số lượng | Trần 30 đom đóm tính cả đom đóm rơi. Trần Bóng Mực tính mọi con, vì Bóng Mực không chết. Trần 2 Gió Lạc chỉ tính con chưa `removed`. |

## Tiêu chí nghiệm thu → bằng chứng (Phần 1–4)

Bằng chứng nằm trong `docs/proof/phase-2/`, do `npm run verify -- phase-2` sinh ra. Mỗi tính năng có ít nhất một scenario trong `tests/scenarios/`.

| Yêu cầu | Tiêu chí kiểm được | Scenario / test | Kết quả |
|---|---|---|---|
| Chạy 6 m/s, tăng tốc ≤ 0,1 s | Đạt 6 m/s sau 6 tick | `camera_yaw_move` | đạt |
| Nhảy 7 m/s, trọng lực −20 | Lướt trên không giữ độ cao | `air_dash` | đạt |
| Lướt 14 m/s / 0,2 s / hồi 1,5 s | Đi được 2,8 m; lần bấm trong lúc hồi chiêu bị bỏ qua | `dash_cooldown` | đạt (sự kiện dash ở tick 1 và 101) |
| Đom đóm: sức chứa 10, nhặt trong 1 m | Nhặt 10 con theo thứ tự, nạp 10 thì thắp | `light_one_lantern` | đạt |
| 20 đom đóm lúc đầu ở 20 điểm khác nhau; sinh thêm mỗi 240 tick | Snapshot tick 0: 20 vị trí khác nhau | test `v1.1 snapshot fields` | đạt |
| Nạp: bán kính 2 m, đèn gần nhất, bằng nhau thì id nhỏ | Hai đèn cách đều → nạp vào L1 | `interact_tie` | đạt |
| Vùng an toàn 6 m; Bóng Mực bị đẩy ra mép trong ≤ 30 tick, vô hại khi đó | Không bị chạm; tới mép đúng ở tick 31 | `safe_radius`, `safe_eject` | đạt |
| Tỏa Sáng: 3 đom đóm / 5 m 3D từ chân + 0,8 / choáng 120 / đẩy 4 m trong 15 tick / +5 mỗi con | Có các con số; tầm 3D loại con cách 5 m theo XZ | `pulse_stun`, `pulse_3d_range`, `pulse_needs_three` | đạt |
| Bóng Mực: 2 con ở tick 300, sau đó mỗi 8 s; điểm sinh r = 37; trạng thái `spawning` | Sự kiện 300:S1, 300:S2, 780:S3, 1260:S4 | `shade_spawn_schedule` | đạt |
| Bị đánh: −1 lửa, rơi floor(n/2) ra vành 1,5–2,5 m, tồn tại 480 tick; Bóng Mực `recoil` | Có 3 đom đóm `dropped`, ttl 8 s; biến mất ở tick +480 | `hit_drop`, `shade_hit_lose` | đạt |
| Rơi khỏi đảo: 1 lần, mất hết, hồi sinh sau 60 tick, bất tử | `player_hit` có `by: "fall"`, `lost: 4`; về (0,0,0) | `fall_respawn` | đạt |
| Thắng/thua: sau mỗi tick; thắng kể cả đúng tick hết giờ | Thắng ở tick cuối | `win_on_dawn_tick`, `win_all_lit`, `dawn` | đạt |
| Điểm chuẩn hoá (+10 mỗi đom đóm nạp) | 10 đom đóm nạp + 1 đèn = 200 | `light_one_lantern` | đạt |
| Tạm dừng: `tick` tăng, `sim_tick` và thời gian đứng | `sim_tick` 10 ở tick 40; bằng 40 ở tick 100 | `pause` | đạt |
| Đêm 2: hai đảo, cầu tre, bục nhảy 14/24 m/s | Bay cao hơn 4 m, đáp trên đảo B | `night2_jump_pad` | đạt |
| Đêm 3: vách đứng, dốc 30°/150°, bục nhảy lên tầng 2 | Bị chặn ở r = 8; leo lên Y = 3; đáp ở Y = 6 | `night3_wall`, `night3_ramp`, `night3_jump_pad` | đạt |
| Gió mạnh mỗi 30 s, 5 s, 2 m/s | Gió bật ở tick 1800, tắt ở tick 2100; đẩy 2 m trong 60 tick | `wind_gust` | đạt |
| Gió Lạc: đuổi khi Mây mang ≥ 5 và cách ≤ 15 m, cướp 3 một lần, `flee` 240 tick | `drifter_steal` {D1, 3, 3}; sau đó `removed` | `drifter_steal` | đạt |
| Tỏa Sáng trúng Gió Lạc | `chase` → `flee` không cướp; `flee` có đồ → `drifter_drop` | `drifter_pulse_chase`, `drifter_pulse_drop` | đạt |
| Bùa Gió: 600 tick, chạy 7,2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick | `charm_picked` {C1, 600}; hai lần lướt cách 20 tick | `charm` | đạt |
| Contract v1.1: `--night` 1–3; snapshot thêm `night`, `wind`, các trường `player.*`, mảng `motes`/`drifters`/`charms`; sự kiện mới | Đủ trường; file sai định dạng → mã 2 | test `v1.1 snapshot fields`, `malformed` | đạt |
| Tất định ở cả 3 Đêm | sha256 trùng nhau | README.md mục Determinism | đạt |
| Một Đêm đầy đủ chạy ≤ 30 s | Thời gian chạy 21.600 tick | README.md mục Full night timing | đạt (≤ 0,5 s) |
| ≥ 30 FPS ở 1280×720 | `__bench` 600 khung mỗi Đêm, có `gl.finish()` | fps.json | đạt (358–818 FPS năng lực; 1,2–2,8 ms mỗi khung) |
| Chuỗi 3 Đêm, menu, giới thiệu, Bình Minh, tạm dừng, cài đặt lưu được, HUD, bảng màu | Chơi thử trong trình duyệt | menu.jpg, night1_intro.jpg, night2_hud.jpg, night3_hud.jpg | đạt (kiểm tay, có ảnh) |
| Âm thanh: nhạc nền và các hiệu ứng | Nghe thử | — | đạt (kiểm tay; ảnh không thể hiện được âm thanh) |

## Test cũ phải sửa vì luật đổi

| Test Phase 1 | Lý do sửa | Thay bằng |
|---|---|---|
| Điểm tính khi **nhặt** đom đóm | Ticket-02 đổi sang +10 mỗi đom đóm **nạp** | `light_one_lantern` khẳng định 10 × 10 + 100 |
| Mang 5, chi phí đèn 5, nhặt trong 1,5 m | Số chuẩn là 10 / 10 / 1,0 m | scenario dùng 10 đom đóm, đèn cách 1 m |
| Đi đủ 6 m/s ngay tick đầu (camera yaw: x = 6) | Số chuẩn có gia tốc 0,1 s | khẳng định x = 0,35 + 54 × 0,1 |
| Tỏa Sáng tốn 1, tầm 6 m, choáng 3 s; Bóng Mực 3,5 m/s | Số chuẩn: 3, 5 m (3D), 120 tick, 4 m/s | `pulse_stun`: kiểm đẩy 4 m trải trong 15 tick |
| Thắng chỉ xét khi đèn vừa sáng; không rơi khỏi đảo | Ticket-02 xét thắng/thua sau mỗi tick; có rơi | `win_on_dawn_tick`, `fall_respawn` |
| Vị trí đèn Đêm 1 tự chọn | Bản đồ chuẩn | test `v1.1 snapshot fields` khẳng định toạ độ L1–L5 |

## Đánh giá

- Phase 1 không bị hỏng theo nghĩa hồi quy: các hành vi cũ vẫn có test, chỉ đổi số theo ticket (bảng trên).
- **Review độc lập:** một agent khác (không phải agent viết code) đối chiếu `src/sim.js` với nguyên văn Ticket-02. Kết quả và cách xử lý ở `docs/notes/review-phase-2.md`.
- Còn kiểm tay, chưa có test tự động: âm thanh, việc cài đặt được lưu giữa các lần mở game, màu từng chi tiết.
