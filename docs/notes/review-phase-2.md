# Review độc lập Phase 2

- **Người review:** một subagent riêng của Claude Code, không phải agent đã viết code.
- **Đầu vào:** nguyên văn Ticket-02 và Test Contract v1.0. Agent tự chạy headless và `npm test` (30/30), không sửa file nào trong repo.
- **Kết luận chung:** không có sai lệch mức cao. Đã kiểm khớp:
  - số chuẩn Phần 1;
  - toạ độ bản đồ và góc của các điểm sinh;
  - thứ tự xử lý trong một tick và cơ chế tạm dừng;
  - cách tính điểm;
  - rơi khỏi đảo, đom đóm rơi;
  - tầm Tỏa Sáng tính theo 3D;
  - đẩy Bóng Mực ra khỏi vùng an toàn;
  - bục nhảy, dốc, gió;
  - mọi tên trường, sự kiện và trạng thái của v1.1.

## Các điểm mức thấp và cách xử lý

| # | Phát hiện | Xử lý |
|---|---|---|
| 1 | Gió Lạc trúng Tỏa Sáng biến mất sau 119 tick thay vì 120, vì bước 8 đếm lùi ngay trong tick của bước 7 | **Đã sửa.** Bộ đếm vừa đặt thì không bị trừ trong cùng tick. Test `drifter_pulse_drop` giờ khẳng định còn `flee` ở tick 120 và `removed` ở tick 121. |
| 2 | Bấm nhảy trong lúc lướt trên mặt đất thì không có tác dụng | **Giữ nguyên, ghi giả định A-16:** trong lúc lướt, độ cao giữ nguyên, nên lệnh nhảy bị bỏ qua. Ticket chỉ nói lướt trên không giữ độ cao. |
| 3 | Đang có Bùa Gió mà snapshot vẫn hiện `dash_cd_s` = 1,5 | **Đã sửa.** Khi có bùa thì không đặt hồi chiêu ("Lướt không hồi chiêu"). Test `charm` khẳng định `dash_cd_s` = 0. |
| 4 | Điểm sinh r = 43 ở Đêm 3 cách L6, L7 khoảng 5,9 m, nên Bóng Mực có thể sinh trong vùng an toàn của đèn đã sáng | **Đã sửa.** Điểm nằm trong vùng an toàn của một đèn đã sáng không còn là "điểm hợp lệ". |
| 5 | Lực đẩy của Tỏa Sáng không dừng ở vật cản | **Đã sửa một phần.** Tháp chuông (r = 2) giờ là vật cản cho Bóng Mực. Biển mây không chặn, vì Bóng Mực bay (giả định A-08). |
| 6 | Bóng Mực dựng bằng scenario ở trạng thái `stunned`/`spawning` không ghi `state_ticks_left` thì thoát trạng thái ngay; `recoil` thì không lùi | **Đã sửa.** Thời lượng mặc định theo trạng thái là 120 / 30 / 60 tick. `recoil` lùi theo hướng ra xa Mây. |
| 7 | Gió Lạc đánh rơi đom đóm trên biển mây; đom đóm rơi có thể nằm trên nóc tháp | **Đã sửa.** Hàm `dropPoint` dùng chung: điểm rơi trên biển, hoặc cao hơn chân Mây quá 1,5 m, thì đặt tại chân Mây (A-07). |
| 8 | Trần 30 đom đóm có tính cả đom đóm rơi; "tối đa 2 Gió Lạc" chỉ tính con chưa `removed`, trong khi trần Bóng Mực tính mọi con | **Giữ nguyên, ghi giả định A-17:** cả hai cách đọc đều hợp lý. Bóng Mực không bao giờ chết nên "đang có" bằng "đã sinh". Gió Lạc đã `removed` thì không còn trên đảo. |

Sau khi sửa: `npm test` 30/30, chạy lại `npm run verify -- phase-2`.
