# Kế hoạch thiết kế 2D và lộ trình

[English](../en/PLAN-2D.md) | **Tiếng Việt** | [简体中文](../zh-CN/PLAN-2D.md)

Cập nhật **11/10/2026**. Tài liệu này mô tả mục tiêu thiết kế và tiêu chí nghiệm thu. Phần đã triển khai được trình bày trong [README](README.md), [nền văn minh](CIVILIZATIONS.md), [kinh tế](ECONOMY.md) và [mỹ thuật runtime](RUNTIME-ART.md). Một mục tiêu có trong kế hoạch không có nghĩa là đã được kiểm tra đạt.

## Hướng sản phẩm

Trò chơi chiến thuật thời gian thực cho một người đấu AI trên trình duyệt máy tính, với sáu phe và ba đời. Mỹ thuật 2D đẳng cự ở góc cố định cần giúp người chơi nhận ra phe, vai trò quân, công năng công trình và hành động ở khoảng cách chơi thông thường. Người chơi có thể kéo và phóng to/thu nhỏ bản đồ, không xoay camera. Cảm hứng đến từ nhiều thời kỳ lịch sử; game không phục dựng một trận chiến chung niên đại.

Luật chính gồm bốn tài nguyên, thịt săn được tính là lương thực, giới hạn 200 đơn vị mỗi bên và một thành chính không thể xây lại. Sương mù dựa trên tầm nhìn hiện tại; AI tuân theo luật của người chơi; hàng chỉ được cộng vào kho sau khi giao. Hai thành chính bị phá trong cùng một nhịp mô phỏng thì trận đấu hòa. Lên đời thay đổi kiến trúc và mở tuyển quân, không tự nâng cấp quân đang có. Các giá trị chi tiết được quản lý trong tài liệu cơ chế.

## Hiện trạng và mục tiêu production

| Hạng mục  | Hiện trạng                                                 | Mục tiêu còn lại                                               |
| --------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Phe       | Sáu bộ quân chơi được, gồm huy động Đại Việt               | Thử cân bằng bằng trận và mở rộng kỹ năng AI                   |
| Kiến trúc | Hình riêng theo đời, nền thành chính 4/5/6 ô, sân dự trữ 8 | Hình xây dựng/hư hại/phá hủy đầy đủ                            |
| Quân      | Bốn hướng chéo nguồn, tư thế giao chiến/đi nguyên hình     | Tám hướng vẽ riêng, tiếp đất ổn định, chu kỳ hành động đầy hơn |
| Hàng mang | Hình theo tồn kho; Đại Việt có atlas tài nguyên riêng      | Chuyển động thống nhất hơn ở mọi phe/vật phẩm                  |
| Di chuyển | A*, tránh nhau cục bộ, đích nhóm và lệnh thoát giao chiến  | Kiểm khe hẹp mạnh hơn và đội hình nâng cao                     |
| Bản đồ    | 96×96, ba địa hình, đọc save 64×64 cũ                      | Địa hình/mép chuyển phong phú, chiến trường dễ đọc             |
| UI        | Menu/HUD/xưởng Việt, Anh, Trung giản thể                   | Tiếp tục kiểm trợ năng, màn hình và thao tác                   |
| Hiệu năng | Kiểm trình duyệt/mô phỏng trên cảnh có phạm vi             | Đo mục tiêu 400 quân với tài sản thật                          |

## Yêu cầu mỹ thuật

Phép chiếu mặt đất dùng lưới 2:1: **64×32 pixel** mỗi ô ở mức phóng tham chiếu. Trước biến đổi camera, `sx = (x-y) × 32` và `sy = (x+y) × 16`. Nền logic, đường bao ảnh và hình chọn được đo riêng; mái nhà không xác định vùng cản đường.

Giữ bản sắc kiến trúc, vật liệu và trang bị của từng phe. Công trình cùng chức năng phải dễ nhận ra ở cả sáu phe. Đổi đời giữ mã công trình, HP, hàng chờ và điểm tập kết. Rào gỗ vẫn là gỗ, không biến thành tường đá. Quy tắc nền runtime hiện tại được ưu tiên hơn kích thước concept cũ.

Các trạng thái quân mục tiêu gồm đứng, đi, làm việc, lấy lực/ra đòn, trúng đòn và chết; khí giới phù hợp còn cần trạng thái nạp, triển khai và thu lại. Điểm neo ổn định, phóng đều hai trục và thời điểm ra đòn theo mô phỏng quan trọng hơn số khung hình. Hoạt họa tám hướng là mục tiêu sản xuất tương lai. Atlas PNG/WebP cần độ trong suốt thực, vùng đệm, khung/neo đã đo, hash nguồn và ghi chú quyền. Mặt nạ màu đội và hình công trình hư hại vẫn cần bổ sung.

Concept dư và ảnh người dùng gửi để tham khảo đã được xóa sau khi phục vụ thiết kế. Mỹ thuật giữ lại cho game tuân theo [quy cách runtime](RUNTIME-ART.md) và [hồ sơ quyền](RIGHTS-AND-LICENSES.md). Nguồn nghiên cứu lịch sử tập trung ở tài liệu [nền văn minh](CIVILIZATIONS.md).

## Hướng kỹ thuật

PixiJS dựng cảnh WebGL; React phụ trách menu/HUD thay vì tạo một component cho từng thực thể. Web Worker mô phỏng cố định **20 Hz**, còn luồng chính nhận snapshot và nội suy để hiển thị. Dựng hình 60 FPS không có nghĩa mô phỏng chạy ở 60 Hz.

Bỏ qua hình ngoài màn hình, giới hạn bộ nhớ đệm texture/canvas và chi phí tìm đường; không dựng hoặc cho chọn quân địch ngoài tầm nhìn. Bản lưu phải giữ tài nguyên, hàng mang, hàng chờ, lệnh, HP, đời, seed, AI và trạng thái thú/xác. Tầm nhìn được tính lại khi tải. Kết luận hiệu năng cần số đo FPS, thời gian mỗi khung hình, chi phí Worker và bộ nhớ với tài sản thật.

## Lộ trình

1. Duy trì vòng chơi: kinh tế, săn và giao hàng, xây dựng/tuyển quân, lên đời, sương mù, thắng thua và lưu/tải.
2. Giữ đồng bộ sáu phe, ba đời, ba bản đồ và ba ngôn ngữ giao diện.
3. Hoàn thiện mỹ thuật còn thiếu, mở rộng kiểm tra di chuyển và trợ năng.
4. Thử cân bằng theo ngân sách tài nguyên và chạy đủ ma trận cấu hình.
5. Đo hiệu năng và kiểm tra đúng bản production trước phát hành.

## Nghiệm thu phát hành

- Phe, vai trò quân và công năng công trình dễ nhận ra ở mức phóng thông thường; bản sắc không chỉ dựa vào màu đội.
- Đổi hình giữ nền, hàng tuyển, điểm giao hàng và HP; nguồn mới được kiểm khung cắt, alpha, neo và hash.
- Chọn, xếp lệnh, vừa đi vừa đánh, rút lui, giữ vị trí, nhóm quân, tập kết và đặt nhà hoạt động nhất quán trên bản đồ/bản đồ nhỏ.
- Quân tìm đường hoặc báo đích bị chặn, không xuyên vật cản hoặc dồn vô hạn vào một điểm.
- Có kiểm tra hồi quy cho giao hàng, chết, hoàn tiền, dân số, tầm nhìn và lưu/tải, gồm huy động dân binh và xác thú dùng chung.
- Tối thiểu **90 cấu hình: 6 phe người chơi ×5 đối thủ khác ×3 bản đồ**; bổ sung trận cùng phe và kiểm tra theo độ khó. Đây là ma trận mục tiêu, chưa phải báo cáo QA hoàn tất.
- Đo **400 đơn vị tổng, 1080p Medium trên M3 Pro**, mục tiêu 60 FPS với tài sản thật; ghi thời gian khung hình, chi phí Worker và bộ nhớ texture. Xác định mục tiêu phần cứng rộng hơn sau khi đo.

Chơi online, chiến dịch, hải quân và mô phỏng bốn đội không thuộc phạm vi bản chơi thử hiện tại. Bằng chứng phát hành được ghi trong [kết quả kiểm tra](VALIDATION.md). Manifest tài sản theo phiên bản vẫn được công khai; ghi chép QA đã thay thế được giữ cục bộ.
