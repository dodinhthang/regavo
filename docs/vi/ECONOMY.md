# Kinh tế và hàng mang

[English](../en/ECONOMY.md) | **Tiếng Việt** | [简体中文](../zh-CN/ECONOMY.md)

Cơ chế hiện tại, đối chiếu ngày **11/10/2026**. Lương thực, gỗ, vàng, đá là bốn kho tài nguyên. Thịt săn là nguồn lương thực, không phải tiền tệ thứ năm. Tài nguyên chỉ vào kho sau khi giao ở công trình nhận hàng đã hoàn thành, hợp lệ.

## Tốc độ khai thác

Thông số nền là tài nguyên mỗi dân mỗi giây mô phỏng, chưa tính đường đi, tắc nghẽn hoặc ngắt việc. Tốc độ trận đổi thời gian mô phỏng đã trôi, không đổi các thông số nền này.

| Nguồn   | Tài nguyên | Tốc độ |
| ------- | ---------- | -----: |
| Bụi quả | Lương thực |   0.90 |
| Cây     | Gỗ         |   1.10 |
| Mỏ vàng | Vàng       |   0.90 |
| Mỏ đá   | Đá         |   0.90 |
| Ruộng   | Lương thực |   0.80 |
| Xác thú | Lương thực |   0.90 |

Dân mang tối đa **10** tài nguyên. Khi đổi loại khai thác, dân giao số hàng đang mang trước; hàng mất khi người mang chết. Hình hàng dựa trên tồn kho thực tế, không dựa trên công việc mới vừa được giao. Dân dùng công cụ khi khai thác và tư thế mang hàng trên chuyến về.

## Thu nhập thực tế

Xấp xỉ hữu ích cho mỗi dân:

```text
income ≈ C / (C/r + 2d/v + t)
```

`C` là sức mang, `r` tốc độ khai thác, `d` quãng đường một chiều, `v` tốc độ đi và `t` thời gian nộp. Đường đi thực tế, chỗ làm và vật cản có thể khiến ước lượng quá lạc quan. Sáu dân hái quả gần kho có thể đáp ứng chi phí tuyển dân cơ bản **50 thực mỗi 10 giây** khi bố trí thuận lợi; nguồn xa hoặc đông người cần thêm dân hoặc kho gần hơn. Một bụi quả có số chỗ làm hữu hạn. Bài kiểm kinh tế đo thu nhập đã giao, không cộng hàng chưa nộp.

Thương mại diễn ra giữa hai chợ đã hoàn thành của bạn. Tuyến dài tăng vàng mỗi chặng nhưng cũng tăng thời gian; Ba Tư có hệ số ×1,3 trước làm tròn. Cần đường an toàn ở cả hai đầu.

## Đại Việt: sản xuất và dự bị

Từ đời II, huy động mỗi dân tốn **20 thực +10 gỗ** và rút người đó khỏi sản xuất. Dân giao hàng đang mang trước; thời gian đi và giao hàng nằm ngoài **8 giây** huấn luyện ở doanh trại. Khi chưa có kho hợp lệ, dân mang hàng phải chờ; hàng không tự mất hoặc được cộng vào kho.

Giải ngũ không tốn tài nguyên, cần thêm tám giây ở doanh trại và không hoàn trang bị đã dùng. Hủy trước huấn luyện được hoàn toàn bộ; hủy trong huấn luyện được hoàn `remaining/8 × cost`. Người chết mất hàng và không được hoàn tiền. Chuyển đổi giữ tỷ lệ HP. Giới hạn dân binh **12** tính cả người đang huy động, đang phục vụ và đang giải ngũ. AI giữ ít nhất mười dân làm kinh tế, giải ngũ sau 30 giây không còn nguy cơ nhìn thấy được ở gần nhà.

Đại Việt dùng tốc độ/tải/thương mại nền. Hình ruộng lúa đổi qua đời, cơ chế ruộng chung. Giữ sản xuất khi chuẩn bị phòng thủ là đánh đổi chính; dân binh là dự bị tạm thời, không phải quân miễn phí.

## Nguồn hiệu chỉnh

Nhịp ban đầu tham khảo [Bronze Time Study](https://groups.google.com/g/microsoft.public.ageofempires/c/ZGElKA11ea8) của Claude Pitre ngày 27/05/1998: 2,28/2,56/1,75 giây-dân mỗi tài nguyên cho quả/ruộng/gỗ và tuyển dân 20 giây. Thiết lập đo chưa đủ rõ để coi là chỉ số raw chính thức. [Changelog AoE:DE của Forgotten Empires](https://www.forgottenempires.net/age-of-empires-definitive-edition/balance-changelog) cũng phân biệt cân bằng DE với bản gốc.

Regavo chọn nền xấp xỉ 0,45 quả/thịt/vàng/đá, 0,55 gỗ, 0,40 ruộng, nhân hai để khớp nhịp tuyển dân mười giây. Vàng/đá, phép nhân và tải là hiệu chỉnh của dự án; các nguồn trên không chứng minh đó là chỉ số AoE gốc. Không đồng thời ép tốc độ toàn mô phỏng lên 2×.

Triển khai: [tốc độ và sức mang](../../src/game/data.ts), [khai thác/giao hàng/thương mại](../../src/game/engine.ts), [bài kiểm khai thác](../../tests/gathering.test.ts) và [bài kiểm hàng mang](../../tests/cargo.test.ts). Xem [nền văn minh](CIVILIZATIONS.md) để hiểu chuyển đổi quân và [bố trí lực lượng](FORCE-DEPLOYMENT.md) để bảo vệ kinh tế.
