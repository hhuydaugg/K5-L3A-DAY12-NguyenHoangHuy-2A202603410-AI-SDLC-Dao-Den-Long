# ADR 0001 — Đèn có dầu, thắng lúc bình minh (Ticket-03)

- **Trạng thái:** đã áp dụng ở Phase 3 (tag `phase-3`, Test Contract v1.2).
- **Bối cảnh:** Ticket-03 đổi mục tiêu từ "thắp hết đèn" sang "giữ đảo sáng tới bình minh". Đèn thắp rồi vẫn có thể tắt. Bóng Mực hút dầu đèn yếu. Điểm, sức chứa và thời lượng Đêm đều đổi.

## Quyết định

### 1. Mô hình trạng thái đèn

Trước đây đèn chỉ có `lit` và `deposited`, và đã sáng thì sáng mãi. Nay mỗi đèn có thêm:

| Trường trong `sim.js` | Ý nghĩa | Ra snapshot |
|---|---|---|
| `f` | Dầu, số nguyên, đơn vị 1/60 (100 dầu = 6000) | `fuel` = làm tròn 1 chữ số thập phân |
| `everLit` | Đã từng sáng trong Đêm | `ever_lit` |
| `relit` | Số lần thắp lại | `relit_count` |

Vòng đời một đèn:

```
chưa sáng ──nạp đủ 10──▶ sáng (f = 6000) ──f ≤ 0──▶ tắt (deposited = 0, everLit = true)
                            ▲   │ châm dầu: +600 mỗi đom đóm, tối đa 6000                │
                            └───┴──────────────── nạp đủ 5 (thắp lại) ◀───────────────────┘
```

Lý do dùng số nguyên: hao 1 đơn vị mỗi tick, bị hút 5 đơn vị mỗi tick. Mọi phép tính dầu đều đúng tuyệt đối, không lệch dần như số thực. Chỉ làm tròn khi xuất ra (`fuelOf`).

### 2. Vùng an toàn phụ thuộc dầu

`hasSafeZone(l) = l.lit && l.f >= 1800`. Một hàm này được dùng ở cả ba chỗ trước đây xét `l.lit`:
- chặn Bóng Mực ở mép 6 m;
- loại điểm sinh Bóng Mực nằm trong vùng an toàn;
- vẽ vòng sáng trên mặt đất.

### 3. Bóng Mực thêm trạng thái `drain`

- **Chọn đèn:** chỉ con đang `wander` mới chọn đèn (hàm `wanderLantern`). Ưu tiên đèn sáng có dầu dưới 30; nếu không có thì chọn đèn tắt gần nhất. Chọn rồi thì giữ đèn đó cho tới khi nó hết đủ điều kiện.
- **Vào `drain`** ở bước 8, khi cách đèn yếu ≤ 2 m.
- **Hút dầu** ở bước 2 của tick sau, cùng lúc với hao dầu. Ngay sau đó đèn hết dầu thì tắt, đúng thứ tự ticket yêu cầu.
- **Rời `drain`:**
  - Mây trong 6 m → `chase`;
  - đèn tắt hoặc cách đèn > 2 m → `wander`;
  - đèn được châm lên ≥ 30 → bị đẩy ra mép (bước 6, dùng chung cơ chế với đèn vừa thắp) và về `wander`;
  - trúng Tỏa Sáng → `stunned`.

### 4. Luật thắng

- Bỏ thắng sớm khi mọi đèn sáng.
- Bước 11 chỉ còn hai nhánh:
  - hết Ngọn Lửa → thua `no_flames`, xét trước mọi thứ khác;
  - hết giờ → thắng `dawn_survived` nếu số đèn sáng ≥ `ceil(0.6 × số đèn)`, ngược lại thua `dawn`.
- Thưởng bình minh chỉ cộng khi thắng.

### 5. Sức chứa

`capacityOf(p) = min(20, 10 + 2 × p.lights)`. `p.lights` đếm số lần thắp thành công trong Đêm, kể cả thắp lại. Đèn dựng sẵn bằng scenario không được tính.

## Hệ quả

- **Phá vỡ tương thích** (liệt kê ở `CHANGELOG.md`):
  - `all_lit` không còn xuất hiện;
  - điểm khác hẳn;
  - Đêm ngắn hơn 60 s;
  - `lantern_lit` có thêm trường `relight`.
- Test cũ về thắng sớm và thưởng thời gian đã được viết lại, không bị xoá âm thầm (xem `docs/notes/phase-3.md`).
- Bản web chỉ đọc trạng thái mới (`fuelOf`, `hasSafeZone`, `capacityOf`, `winNeed`), không tự tính luật.
- Giả định mới: A-18, A-19, A-20 trong `docs/notes/phase-3.md`.

## Phương án đã cân nhắc

- **Lưu dầu bằng số thực, làm tròn mỗi tick:** đơn giản hơn, nhưng sai số tích luỹ làm lệch tick tắt đèn. Ticket cũng khuyên dùng số nguyên.
- **Bóng Mực chọn lại đèn mỗi tick:** phản ứng nhanh hơn khi có đèn mới yếu đi. Nhưng như vậy `target_lantern_id` trong scenario vô nghĩa, và Bóng Mực có thể đổi hướng liên tục giữa hai đèn cách đều. Đã chọn cách giữ đèn đã chọn (A-19).
