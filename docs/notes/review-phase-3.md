# Review độc lập Phase 3

- **Người review:** một subagent riêng của Claude Code, không phải agent đã viết code.
- **Đầu vào:** nguyên văn Ticket-03 và Ticket-02 (thứ tự xử lý).
- **Cách làm:** tự chạy `npm test` (41/41 lúc review) và các script thăm dò headless riêng, không sửa file nào trong repo.
- **Kết luận chung:** `src/sim.js` làm đúng Ticket-03, không có sai lệch mức cao. Đã kiểm khớp:
  - dầu bằng số nguyên 1/60, hao và hút cộng dồn;
  - công thức châm dầu, loại đèn đầy, chọn đèn gần nhất (bằng nhau thì id nhỏ);
  - `lantern_out` đặt `deposited = 0` và giữ `ever_lit`; thắp lại tốn 5;
  - sức chứa, bảng điểm;
  - thắng lúc bình minh với ngưỡng 3/4/5; không thắng sớm; `no_flames` xét trước;
  - trường snapshot, scenario và sự kiện của v1.2;
  - thứ tự trong tick.

## Phát hiện và cách xử lý

| # | Phát hiện | Xử lý |
|---|---|---|
| 1 | Châm dầu cho đèn **vốn đã ≥ 30** vẫn đẩy (eject) khoảng 1/4 số Bóng Mực đang bị chặn ở mép 6 m, do sai số làm tròn (`d < 6` đúng với d = 5,9999999). Những con đó đứng yên 30 tick và không gây sát thương. | **Đã sửa.** Chỉ đẩy khi dầu đi từ dưới 30 lên ≥ 30, đúng chữ "được châm dầu lên ≥ 30". Thêm test `refuelling a lantern already >= 30 does not eject…`: code cũ đẩy 7/52 con, code mới đẩy 0. Giả định A-22 sửa theo. |
| 2 | Bất kỳ lần đẩy nào cũng chuyển Bóng Mực đang `drain` về `wander`, kể cả khi lệnh đẩy đến từ một đèn khác | **Đã sửa.** Chỉ con đang hút **chính đèn đó** mới về `wander`. Trên bản đồ chuẩn không xảy ra; chỉ xảy ra khi scenario đặt hai đèn cách nhau dưới khoảng 8 m. |
| 3 | Snapshot làm tròn dầu tới 0,1. Dầu 29,95–29,98 hiện là 30,0 dù đã mất vùng an toàn; đèn 99,98 hiện 100 nhưng thưởng là floor(99,98) = 99 | **Giữ nguyên.** Ticket yêu cầu "1 chữ số thập phân" và "chỉ làm tròn khi xuất ra". Ghi lại để người đọc snapshot biết. |
| 4 | A-19 giữ đèn đã chọn, trong khi ticket nói đèn yếu "gần nhất" | **Giữ nguyên, có lý do:** nếu chọn lại mỗi tick thì `target_lantern_id` của scenario vô nghĩa. Lúc chọn thì vẫn chọn đèn gần nhất. Hai cách chỉ khác nhau khi một đèn yếu mới xuất hiện gần hơn trong lúc Bóng Mực đang bay. |
| 5 | "như trước": trước Phase 3, Bóng Mực `wander` không bay về đèn tắt mà đi ngẫu nhiên (A-06), nên đầu ra headless của scenario cũ có Bóng Mực đổi | Đã ghi là thay đổi phá vỡ tương thích trong `CHANGELOG.md`. Mọi test Phase 1–2 vẫn đạt. |
| 6 | Scenario `lit: true, fuel: 0`: tick 0 hiện đèn sáng với dầu 0, tới tick 1 thì tắt. Scenario đèn tắt có `ever_lit` và `deposited` ≥ 5: lần bấm E kế tiếp thắp lại với `deposit` số lượng 0 | Giữ nguyên: đây là trạng thái scenario tự mâu thuẫn, game xử lý theo đúng thứ tự tick. |
| 7 | `AGENTS.md` còn ghi Ticket-02 / v1.1 | Đã cập nhật trong lúc review chạy. |

Sau khi sửa: `npm test` 42/42 cho phần Phase 3, chạy lại `npm run verify -- phase-3`.
