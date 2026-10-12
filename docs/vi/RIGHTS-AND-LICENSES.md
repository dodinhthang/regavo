# Quyền, nguồn tài sản và giấy phép

[English](../en/RIGHTS-AND-LICENSES.md) | **Tiếng Việt** | [简体中文](../zh-CN/RIGHTS-AND-LICENSES.md)

Cập nhật **11/10/2026**. Đây là hồ sơ nguồn và giấy phép trong phạm vi bản chơi thử, không phải chứng nhận độc quyền. Thông báo giấy phép bên thứ ba được giữ nguyên văn trong các file riêng. Repo không cấp giấy phép tái sử dụng công cộng cho mã game, mỹ thuật hoặc âm thanh gốc.

## Nội dung riêng

Mã TypeScript/Canvas/SVG/CSS của dự án cung cấp mô phỏng, dựng hình, giao diện, huy hiệu và hiệu ứng. Nhạc và âm thanh được tổng hợp bằng mã Web Audio của dự án. Giao diện dùng font hệ thống, không phân phối font bên thứ ba, bộ icon stock hoặc bản ghi âm ngoài. Dự án không nhập sprite, logo, ảnh chụp màn hình, giao diện, âm thanh hoặc mã Age of Empires. AoE là nguồn tham khảo gameplay/kinh tế, không phải nhận diện thương hiệu Regavo.

Việc công khai repo không khiến giấy phép thư viện áp dụng cho nội dung gốc của dự án. Tác quyền bên thứ ba vẫn thuộc tác giả tương ứng. “Regavo” là tên tạm dùng; hồ sơ chưa ghi nhận việc tra cứu nhãn hiệu hoàn tất hoặc xác định độc quyền tên.

## Hồ sơ thư viện phụ thuộc

Phiên bản trực tiếp: **PixiJS 8.13.2**, **React/React DOM 19.2.0**, **Vite 7.3.7**, **TypeScript 5.9.3**. Công cụ phát triển gồm ESLint, typescript-eslint, lint React Hooks và Prettier. Đồ thị thư viện đã cài được audit ghi lại; số package không được coi là cố định trong văn bản này.

| Thành phần                      | Giấy phép                                      | Hồ sơ phân phối                                    |
| ------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| PixiJS, React/React DOM, Vite   | MIT                                            | Giữ thông báo tác quyền và giấy phép liên quan     |
| TypeScript và một số tooling    | Apache-2.0                                     | Giữ giấy phép/thông báo và hồ sơ sửa đổi liên quan |
| Thư viện phụ thuộc khác đã kiểm | ISC, BSD-2-Clause, BSD-3-Clause, BlueOak-1.0.0 | Giữ thông báo/điều khoản tương ứng                 |
| Dữ liệu phát triển caniuse-lite | CC-BY-4.0                                      | Giữ ghi công và giấy phép; không sửa dữ liệu gốc   |

[Blue Oak 1.0.0](https://blueoakcouncil.org/license/1.0.0), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.en) áp dụng cho công cụ/dữ liệu tương ứng, không áp dụng cho mỹ thuật gốc. WebGL/DOM/Web Worker là các API được gọi; repo không phân phối mã triển khai trình duyệt.

Xem [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md), [dependency-audit.json](../../licenses/dependency-audit.json), [license nguyên văn phân phối](../../public/third-party-licenses.txt) cho nguồn, hash và notice, gồm thành phần nhúng. Bằng chứng fallback upstream ở [dependency-fallbacks.json](../../licenses/upstream/dependency-fallbacks.json). Các file được sinh tự động; không chỉnh hoặc dịch văn bản bên thứ ba gốc.

Chạy `pnpm audit:licenses` sau khi đổi thư viện/nền tảng, rồi `pnpm check:licenses`. Audit theo đồ thị phụ thuộc runtime/build truy cập được, bỏ các mục store không còn được tham chiếu. Package tùy chọn khác nhau theo OS/CPU; snapshot không phải số package chung cho mọi máy. Audit đạt nghĩa là đồ thị và thông báo đã ghi khớp, không chứng nhận quyền sở hữu ảnh hoặc loại trừ mọi rủi ro pháp lý.

## Mỹ thuật AI và tham chiếu

Concept/atlas được tạo/chỉnh bằng `image_gen` tích hợp. Đầu vào gồm ảnh dự án **và ảnh tượng/kiến trúc do người dùng cung cấp** cho Đại Việt. URL bảo tàng/lịch sử trong tài liệu nền văn minh là nguồn nghiên cứu, không cấp quyền sao chép ảnh. Hồ sơ chưa xác lập độc quyền ảnh tham chiếu hoặc hiện vật được chụp.

[Terms of Use](https://openai.com/policies/terms-of-use/#content), [Services Agreement](https://openai.com/policies/services-agreement/) quy định quyền đầu ra theo luật và hợp đồng áp dụng. Đầu ra có thể tương tự đầu ra của người khác. Loại hợp đồng tài khoản chưa được xác minh; hồ sơ không chứng nhận tác quyền độc quyền hoặc quyền bên thứ ba đã được giải quyết.

Prompt runtime, PNG nguồn giữ lại, SHA-256 và dữ liệu frame/neo nằm trong [manifest runtime](RUNTIME-ART.md). Ảnh tham khảo gốc và các bản concept/nháp dư đã được xóa. PNG giữ lại không đổi byte. Hiệu chỉnh nguyên hình đổi hình học/RGB cache, không sửa PNG nguồn. Đại Việt dùng rồng v4, kiến trúc v9/v10, nền v11, đi v12, cargo v13. SVG/rig cũ không phải quy cách render hiện tại.

## File công khai và riêng

- `public/art/` chứa PNG runtime, metadata nguồn và tài liệu, được sao chép vào build website. Hồ sơ công khai dùng đường dẫn tương đối repo hoặc ID sinh ảnh, không chứa đường dẫn máy cá nhân.
- `src/assets/battlefield.png` là ảnh nền do UI CSS nhập vào. Vite xuất ảnh thành tài sản có hash trong tên file; cảnh văn minh ghép sprite runtime.
- `scripts/data/` giữ ba file JSON đầu vào được công cụ đo/hiệu chỉnh mỹ thuật và test sử dụng. Ảnh nguồn của chúng là PNG runtime giữ lại trong `public/art/`.
- Ảnh tham khảo người dùng và các bản concept/nháp dư đã được xóa. Hồ sơ công khai giữ mô tả vai trò của chúng trong thiết kế, không phát hành ảnh đầu vào gốc.
- Bảng ánh xạ đường dẫn công cụ gốc và hồ sơ trước chuẩn hóa được giữ cục bộ trong các file `.openai/*local*` bị Git bỏ qua. Đây là bằng chứng riêng, không phải dữ liệu cần đi kèm repo khi chuyển máy.

Không ghi CC0, public domain, “copyright-free” hoặc bảo đảm độc quyền cho ảnh AI. Thêm LICENSE, xóa nền hoặc vẽ lại riêng lẻ không xác lập đã giải quyết quyền bên thứ ba. Tài sản mới cần hồ sơ nguồn/quyền phù hợp; hồ sơ hiện tại còn giới hạn về nguồn tham chiếu/hợp đồng tài khoản.
