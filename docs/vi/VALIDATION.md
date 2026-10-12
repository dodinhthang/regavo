# Kết quả kiểm tra hiện tại

[English](../en/VALIDATION.md) | **Tiếng Việt** | [简体中文](../zh-CN/VALIDATION.md)

Ngày rà soát: **12/10/2026**. Phiên bản dự án: `0.1.0`. Kết quả này mô tả cây làm việc hiện tại, gồm cả thay đổi chưa commit; không phải bằng chứng của một bản phát hành đã gắn tag. Môi trường: macOS, Node.js `22.23.3`, pnpm `12.8.1`.

## Kiểm tra tự động

`pnpm validate` chạy lần lượt các bước sau:

| Kiểm tra             | Kết quả                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------ |
| ESLint               | Đạt, không có cảnh báo                                                                     |
| Prettier             | Đạt                                                                                        |
| TypeScript           | Đạt với kiểm tra strict cho mã nguồn và bài kiểm                                           |
| Giấy phép thư viện   | Đạt: 176 package instance đã cài thuộc đồ thị phụ thuộc, 16 trong bao đóng runtime bảo thủ |
| Bài kiểm hồi quy     | 141/141 đạt                                                                                |
| Production build     | Đạt; chunk JavaScript chính 864,51 kB, gzip 284,32 kB                                      |
| Kiểm tra ảnh runtime | Đạt: 112 WebP giữ nguyên RGBA/kích thước đã giải mã; 3 manifest hình học giữ nguyên byte   |

Vite vẫn cảnh báo chunk vượt 500 kB. Build thành công, nhưng kết quả này không chứng nhận thời gian tải, mức dùng bộ nhớ hay tốc độ khung hình.

Số lượng giấy phép trên máy này: MIT 133, Apache-2.0 20, ISC 11, BSD-2-Clause 6, BSD-3-Clause 4, BlueOak-1.0.0 1 và CC-BY-4.0 1. Đây là số đếm theo metadata package; notice và ghi công nguyên văn của thành phần đóng gói được giữ trong [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md) và `public/third-party-licenses.txt` được phân phối cùng bản web. Package tùy chọn cho nền tảng khác chưa cài được ghi riêng, không tính là đã cài.

Bài kiểm hồi quy được nhóm theo chức năng: [danh mục văn minh và bản lưu](../../tests/civilizations.test.ts), [huy động dân binh](../../tests/mobilization.test.ts) và [tài sản mỹ thuật](../../tests/art-assets.test.ts). Kiểm tra khởi tạo và lưu/tải tự động áp dụng cho mọi văn minh đã đăng ký, ở vai trò người chơi và AI trên cả ba dạng bản đồ. Kiểm tra tuyển quân đối chiếu danh mục với lệnh tuyển thực tế cho mọi văn minh và đời.

## Cài sạch và tài liệu

Cài mới bằng `pnpm install --frozen-lockfile`, sau đó chạy `pnpm check:licenses` trên cùng OS/CPU cho kết quả khớp các file notice đã sinh. Audit hiện đi theo đồ thị truy cập được từ `package.json`, bỏ các mục pnpm store cũ không còn được tham chiếu. Việc này sửa chênh lệch trong hồ sơ cũ do một bản Vite không sử dụng.

Tài liệu có 9 nhóm trang được duy trì (27 trang), mỗi nhóm có bản Anh, Việt và Trung giản thể. Các trang chủ đề dùng cùng tên file trong `docs/en/`, `docs/vi/` và `docs/zh-CN/`; README dự án tiếng Anh được giữ ở gốc repo. Đã kiểm tra liên kết file nội bộ, chuyển đúng bản ngôn ngữ, bảng quân/đời và số liệu dùng chung. Prompt gốc, mã trong manifest và văn bản giấy phép bên thứ ba giữ nguyên ngôn ngữ nguồn.

Hồ sơ tài sản công khai dùng đường dẫn tương đối trong repo hoặc mã rõ nghĩa `generation-record:`. Đường dẫn máy cá nhân chỉ được giữ trong hồ sơ cục bộ riêng tư. Ảnh tham khảo người dùng và các bản concept dư đã được xóa, không phân phối cùng dự án. Ảnh nền giao diện nằm trong `src/assets/`; đầu vào công cụ đo/hiệu chỉnh nằm trong `scripts/data/`. Việc dọn dẹp không đổi byte hay hash của PNG giữ lại.

## Chạy lại kiểm tra

Từ thư mục gốc repo:

```sh
pnpm install --frozen-lockfile
pnpm audit:licenses
pnpm validate
pnpm dev
```

Cần sinh lại giấy phép khi dependencies hoặc OS/CPU cài đặt khác snapshot đã ghi. Khi cập nhật snapshot, commit cả notice đã sinh lại. Validate tự động không mở game để tương tác trong trình duyệt; kiểm hình và gameplay là bước riêng.

Đã đối chiếu nơi đăng ký mỹ thuật chung với cả sáu văn minh chơi được. So sánh bằng Chrome headless cho **446 mẫu quân, hàng mang, chân dung và công trình Đại Việt trùng pixel** trước/sau refactor, gồm cả điểm neo không đổi. Cả sáu bộ quân tải được, một văn minh mới dựng được chỉ bằng cấu hình, và đổi lựa chọn nhanh loại được ảnh quân của phe không còn chọn. Kiểm tra này xác nhận phần refactor dựng hình, chưa thay thế toàn bộ ma trận nghiệm thu gameplay/hiệu năng.

Dung lượng deploy giảm từ **274,7 xuống 153,2 MiB** bằng cách bỏ 24 PNG lịch sử và tạo WebP runtime lossless. Mẫu màn hình đầu bằng Chrome headless trên máy tải khoảng **124,0 MiB trước và 26,5 MiB sau** (tổng Content-Length của response; không tính văn bản nén động). Đã kiểm tra đủ 18 tiểu cảnh văn minh/đời và trận Đại Việt/Rome, không có response ảnh thiếu hay lỗi JavaScript. Đây là số đo build/lượt tải cục bộ, không phải chứng nhận tốc độ Internet hoặc hiệu năng gameplay.

## Kiểm tra pipeline phát hành ở local

YAML CI/release đã qua actionlint. `pnpm validate` đạt **141 tests**, kiểm tra nguồn, build production và đối chiếu RGBA của 112 ảnh. Đủ **3 bài Playwright Chromium smoke** đạt, gồm 18 tiểu cảnh, trận chạy/thoát được và xưởng mô hình. Wrangler **4.149.0** chấp nhận cấu hình static assets bằng `deploy --dry-run`; server local đạt kiểm tra artifact/MIME/cache và trả 404 khi thiếu ảnh.

Cài đặt sạch trong container Linux đạt lint, format, type, giấy phép sinh theo nền tảng và đủ **141 tests**. Sau đó Docker báo lỗi I/O ở kho container trước bước build/browser; chưa xác nhận trọn pipeline Linux. Ổ hệ thống host gần đầy. Công việc chỉ ở local chưa push nhánh/tag, chạy GitHub Actions, cấu hình environment/secrets GitHub hoặc deploy Cloudflare.

## Giới hạn bằng chứng

Các lượt kiểm trình duyệt, ảnh, số đo atlas và probe hiệu năng trước đây được giữ trong hồ sơ QA cục bộ, ngoài repo công khai. Chúng chỉ áp dụng cho bản được ghi tại thời điểm kiểm. Fixture và log trong `test-results/` được Git bỏ qua; đợt chuẩn hóa tài liệu này chưa chạy lại toàn bộ kiểm tra trình duyệt.

Các mục tiêu chưa xác nhận gồm: đủ ma trận 6×5×3 phe/đối thủ/bản đồ, hiệu năng trình duyệt duy trì ở 400 quân tổng, mọi seed và bố trí đông chật, cân bằng competitive và hành vi triển khai cuối. Độ phủ hình và bài kiểm mô phỏng không xác lập quyền tác giả độc quyền hoặc thông qua nhãn hiệu. Công việc nghiệm thu còn lại được ghi trong [Kế hoạch 2D](PLAN-2D.md).
