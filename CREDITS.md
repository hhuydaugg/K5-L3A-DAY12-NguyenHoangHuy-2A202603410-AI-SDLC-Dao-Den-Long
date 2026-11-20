# Credits

Game không dùng file hình, file âm thanh hay font nào tải từ ngoài về. Mọi thứ người chơi thấy và nghe đều sinh từ code trong repo này, trừ three.js.

## Thư viện và tài sản

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| three.js 0.160.0 (`web/vendor/three.module.min.js`) | https://threejs.org (npm `three@0.160.0`), chép nguyên vào repo | MIT, xem `web/vendor/three.LICENSE` |
| Mô hình 3D: đảo, cầu tre, tháp chuông, đèn lồng (cả vết rách khi tắt), Mây, Bóng Mực, Gió Lạc, đom đóm, Bùa Gió, cây thông | Dựng bằng hình khối cơ bản của three.js trong `web/main.js` | Tự làm (MIT) |
| Âm thanh: nhạc nền đêm và 14 hiệu ứng (nhặt, nạp, thắp, đèn tắt, Tỏa Sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực, đếm ngược, gió, bùa) | Tạo lúc chạy bằng WebAudio (oscillator) trong `web/main.js` | Tự làm (MIT) |
| Chữ | Font hệ thống (`system-ui`, Segoe UI), không kèm file font | — |
| Biểu tượng 🔥 và ⚠ | Emoji / ký tự Unicode của hệ điều hành | — |
| Video demo (`demo.mp4` ở Release v1.0.0) | Tự quay khi chơi game | Tự làm (MIT) |
| Nhân vật, bối cảnh, tên gọi, số liệu chuẩn, ticket | Bản gốc của lab Day 12 (VinUni AI20K) | Theo lab |

## Công cụ AI

| Công cụ | Dùng để | Không dùng để |
|---|---|---|
| Claude Code (model Claude Opus 5.5, Anthropic), trong Claude desktop app | Viết và sửa mã nguồn, test, scenario, công cụ đo (`tools/`), tài liệu; review độc lập bằng subagent; chạy lệnh, chụp ảnh bằng chứng | Tạo hình ảnh, âm thanh hay nhạc: không có tài sản nào do AI sinh ra dưới dạng file media |

Chi tiết cách dùng AI theo từng phase và token ước tính: `docs/notes/ai-log.md`. Tổng kết: `docs/retro.md`.
