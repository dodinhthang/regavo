# Mỹ thuật runtime

[English](../en/RUNTIME-ART.md) | **Tiếng Việt** | [简体中文](../zh-CN/RUNTIME-ART.md)

Quy cách dựng hình hiện tại, cập nhật **11/10/2026**. PNG nguồn giữ nguyên byte; renderer xử lý khung cắt, hình học, cân màu và hiệu ứng. Trang này ghi các nguồn đang được chọn. Manifest cũ là snapshot nguồn, không phải quy cách của bộ tải hiện tại.

## Nguồn đang dùng

| Nội dung                   | Nguồn/bằng chứng                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Năm phe gốc                | Thành chính v6 (I)/v7 (II–III), nhà phụ v3/v6, quân/action v6, thương nhân/khí giới theo phe v7                                                                                                                                                                          |
| Voi Ba Tư                  | Năm PNG v9: [manifest voi](../../public/art/units-elephant-v9.manifest.json)                                                                                                                                                                                             |
| Nhà Đại Việt I–II          | Sheet độc lập gốc, nguồn cổng/cột cờ đời II                                                                                                                                                                                                                              |
| Nhà Đại Việt III           | [Atlas chung v9](../../public/art/daiviet-v9.manifest.json), nhà chính/nhà ở từ [v10](../../public/art/daiviet-v10.manifest.json)                                                                                                                                        |
| Phép chiếu nhà Đại Việt    | [Lưới/nền v11](../../public/art/daiviet-grid-v11.manifest.json)                                                                                                                                                                                                          |
| Bước đi Đại Việt           | [Nguyên hình v12](../../public/art/daiviet-walk-v12.manifest.json), căn thân/RGB                                                                                                                                                                                         |
| Dân/cargo Đại Việt         | [Hiệu chỉnh công cụ](../../public/art/daiviet-worker-calibration.manifest.json), [cargo v13](../../public/art/daiviet-cargo-v13.manifest.json)                                                                                                                           |
| Rồng chung Đại Việt        | [Huy hiệu v4](../../public/art/daiviet-v4-emblem.manifest.json)                                                                                                                                                                                                          |
| Thiên nhiên, thú, địa hình | [Tài nguyên](../../public/art/nature-v2.manifest.json), [thú](../../public/art/wildlife-v3.manifest.json), [bước B](../../public/art/wildlife-walk-b.manifest.json), [nền](../../public/art/terrain-v3.manifest.json), [cảnh](../../public/art/scenery-v3.manifest.json) |

Loader Đại Việt hiện tải **30 sheet sprite, chứa 431 frame đăng ký, cùng một PNG huy hiệu**. Số này gồm cả khung đã được lựa chọn mới thay thế nhưng vẫn nằm trong sheet được tải. Metadata đầy đủ còn chứa sheet công trình cũ, nên tổng khung lịch sử khác tổng khung mà bộ tải hiện dùng. Xem [loader](../../src/render/sheet-art.ts), [metadata nền](../../src/render/daiviet-frames.json), [metadata cargo](../../src/render/daiviet-cargo-frames.json).

## Hình học và chuyển động

Ô đất **64×32** ở zoom tham chiếu. Quân/thú dùng canvas 4×, nhà/cảnh 2×. Bốn hướng chéo nguồn phục vụ tám hướng xem bằng cách chọn hướng gần nhất. Khung cắt phải giữ toàn bộ đường bao, công cụ và kíp vận hành; giới hạn ô không phải lý do để cắt chân, mũ hoặc mái.

Thành chính có nền thấy **4/5/6 ô**, sân dự trữ **8 ô**. Không dùng sân để phóng ảnh. Cổng đá Đại Việt có nền 3×3, pháo đài 5×5. Phép chiếu căn góc trái/phải/trước đã đo; tường/cổng căn đầu nối theo hai trục, giữ cột thẳng. Đặt nhà, va chạm, preview và chọn dùng chung quy tắc nền của game.

Bước đi dùng tư thế nguyên hình. Bộ binh/dân Đại Việt dùng **A/D/B/C**, kỵ binh/voi dùng **A/C/B/D**, pháo luân phiên hai tư thế tiếp đất nguyên hình của kíp vận hành. Nhịp theo quãng đường thật; đứng lại ngừng nhịp, xưởng dùng tốc độ danh nghĩa của quân. Rig cắt khớp 12/24 nhịp đã bỏ. Giao chiến dùng ảnh lấy lực/ra đòn riêng đồng bộ pha đánh của mô phỏng; tên/đạn/chớp là hiệu ứng vector riêng.

Căn bước Đại Việt giữ chiều cao silhouette, bề ngang/neo thân trên và RGB theo khung chuẩn cùng loại/hướng, giữ alpha. Công cụ dân phóng đều X/Y theo giải phẫu, tư thế cúi được thấp hơn. Hàng theo tồn kho thật: gỗ, vàng, đá, thịt mỗi loại có bốn bước nguyên hình ở bốn hướng; thực giữ giỏ gốc. Phe khác dùng dấu gỗ/túi/vật liệu sẵn có. Khi đang khai thác vẫn dùng công cụ.

## Tiểu cảnh trang chủ và tải ảnh

Trang chủ ghép cùng mô hình runtime nhưng có **tỉ lệ riêng của preview** cho Đại Việt: nhà chính 95%, doanh trại/chuồng/trường bắn 82%, kho lương 88%, ruộng 94%, pháo 90%. Mô hình khác giữ mức preview. Không đổi cỡ trận/xưởng hoặc nền logic. Xem [bố trí preview](../../src/ui/empire-preview-layout.ts).

Bộ nhớ đệm có giới hạn; bộ tải dùng chung lượt tải đang chờ và bỏ kết quả cũ khi đổi phe. Luồng bình thường ưu tiên nguồn hiện tại; sheet thử nghiệm được giữ làm hồ sơ hoặc dự phòng. [asset-origins.json](../../public/asset-origins.json) kiểm kê nguồn phân phối, gồm lịch sử; có trong kiểm kê không có nghĩa được giải mã lúc này.

## Đăng ký mỹ thuật dùng chung

Cả sáu văn minh đăng ký bộ ảnh trong [civilization-art-data.ts](../../src/render/civilization-art-data.ts). Bố cục atlas chung giữ nguyên năm cột văn minh cũ; sheet độc lập dùng [sheet-art.ts](../../src/render/sheet-art.ts). Việc tải, chọn renderer quân/chân dung và chọn ảnh công trình đi qua nơi đăng ký này. Nguồn ảnh và các tư thế Đại Việt được khai báo trong [civilizations/daiviet.ts](../../src/render/civilizations/daiviet.ts), không cần renderer riêng theo văn minh. Khung cắt, hiệu chỉnh, thứ tự tư thế và PNG nguồn hiện tại được giữ nguyên.

Để thêm mỹ thuật cho một văn minh:

1. Đặt PNG runtime trong `public/art/`, ghi nguồn, kích thước, khung cắt, điểm neo và hash. Sheet quân độc lập đăng ký bốn hướng nguồn cho mỗi hàng tư thế.
2. Thêm `src/render/civilizations/<id>.ts` xuất một `SheetArtDefinition`: khai báo sheet, chu kỳ hành động/hàng mang của quân, ảnh công trình theo đời và hiệu chỉnh nếu cần. Có thể tham khảo cấu trúc khai báo Đại Việt; tọa độ và tỉ lệ phải đo trên bộ ảnh mới.
3. Đăng ký cấu hình vào `CIVILIZATION_ART`. Bộ tải/renderer chung tự nhận; không cần thêm nhánh riêng theo văn minh hay viết script đo mới. Bố cục `shared` chỉ phù hợp khi atlas hiện có thật sự chứa cột ảnh của văn minh đó.
4. Thêm ID văn minh, quân/cơ chế, bản dịch, icon và nội dung menu/preview ở các module tương ứng. Đăng ký mỹ thuật chưa đủ để có văn minh chơi được.

Các script đo và `scripts/data/` là đầu vào biên soạn cho bộ ảnh Đại Việt hiện tại. Bộ ảnh mới có thể khai báo metadata đã đo trực tiếp; profile hiệu chỉnh là tùy chọn. Các đầu vào này tách khỏi cấu hình runtime và không phân phối trong `dist/`.

## Công cụ, hồ sơ và giới hạn

Công cụ: [đo bước](../../scripts/measure-daiviet-walk-v12.py), [căn bước](../../scripts/calibrate-daiviet-walk.py), [căn công cụ](../../scripts/calibrate-daiviet-workers.py), [đo cargo](../../scripts/measure-daiviet-cargo-v13.py). Các công cụ dùng Python cùng Pillow/NumPy theo khai báo import; cài và chơi game thông thường không cần chúng. Ba file JSON đầu vào nằm trong [scripts/data/](../../scripts/data/); ảnh nguồn là PNG runtime giữ lại trong `public/art/`. Công cụ không cần các ảnh concept hay ảnh người dùng tham khảo đã xóa.

Chưa có hoạt họa chết đầy đủ, bộ nhà hư hại, toàn chu kỳ công cụ hoặc đồng phục riêng mọi quân/đời. Bốn hướng và chi tiết áo sinh độc lập vẫn là giới hạn. Kiểm frame/crop không suy ra FPS 400 quân. Số liệu cũ và thử nghiệm rig được giữ trong hồ sơ QA cục bộ; bằng chứng công khai hiện tại ở [Kết quả kiểm tra](VALIDATION.md).

[Quyền](RIGHTS-AND-LICENSES.md) ghi đầu vào dự án/người dùng và giới hạn AI; [validation](VALIDATION.md) ghi kiểm đạt. Văn bản license giữ nguyên bản.
