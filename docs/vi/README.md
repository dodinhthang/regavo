# Regavo — trò chơi RTS 2D trên trình duyệt

[English](../../README.md) | **Tiếng Việt** | [简体中文](../zh-CN/README.md)

Regavo là bản chơi thử chiến thuật thời gian thực một người đấu AI trên trình duyệt máy tính. Chọn La Mã, Mông Cổ, Ba Tư, Đại Đường, Ottoman hoặc Đại Việt và phát triển qua ba đời: Định cư, Quân sự, Đế quốc.

Phá thành chính đối thủ để thắng. Nếu hai thành chính bị phá trong cùng nhịp mô phỏng, trận đấu hòa. Bản chơi thử có vòng trận hoàn chỉnh; cân bằng thi đấu và hiệu năng phát hành vẫn cần thử nghiệm thêm.

![Khu dân cư Đại Việt với dân thu hoạch, khai thác tài nguyên, voi chiến và hỏa pháo giao chiến với quân Mông Cổ trong Regavo](../images/daiviet-gameplay.jpg)

_Đại Việt đời III với dân làm ruộng, lấy gỗ và khai thác vàng, cùng đầy đủ các loại quân giao chiến với Mông Cổ. Ảnh chụp trận minh họa trực tiếp trong game, lấy cảm hứng từ chiến thắng của nhà Trần trước quân Nguyên–Mông._

## Chạy trên máy

Yêu cầu **Node.js từ 22.13** và **pnpm 12.8.1**, được khai báo trong `package.json`. Cài pnpm theo [hướng dẫn chính thức](https://pnpm.io/installation), rồi chạy từ thư mục gốc repo:

```sh
pnpm install --frozen-lockfile
pnpm audit:licenses
pnpm dev
```

Mở URL Vite in ra. Dev server tiếp tục chạy trong terminal này. Lệnh sinh hồ sơ giấy phép ghi các package được cài trên nền tảng của bạn, bỏ qua package thừa ngoài đồ thị phụ thuộc. `pnpm-lock.yaml` là lockfile duy nhất.

Mở terminal thứ hai để chạy toàn bộ kiểm tra:

```sh
pnpm validate
```

Build tĩnh và xem thử production trên máy:

```sh
pnpm build
pnpm exec vite preview --host 127.0.0.1
```

Triển khai `dist/` tại gốc website. Game không cần khóa API hoặc backend ứng dụng; mô phỏng và AI chạy trong Web Worker.

Bản production chỉ chứa ảnh runtime và atlas dự phòng cần thiết, nén WebP lossless giữ nguyên từng điểm ảnh, kích thước và alpha. PNG lịch sử cùng hồ sơ nguồn được giữ trong repo. `dist/asset-manifest.json` ghi hash nguồn/đầu ra; `pnpm check:assets` kiểm tra toàn bộ RGBA đã giải mã sau khi build. Build đầu mã hóa ảnh; các build sau dùng cache theo nội dung tại `node_modules/.cache/regavo-assets/`. Quy tắc cache Cloudflare trong `public/_headers` áp dụng cho ảnh và bundle có hash trong tên.

[Deploy và phát hành](DEPLOYMENT.md)

## Nội dung có thể chơi

- Bốn tài nguyên: lương thực, gỗ, vàng, đá. Dân khai thác, săn và giao hàng về kho hợp lệ; hàng mất khi người mang chết.
- Xây dựng, sửa chữa, ruộng, hàng tuyển, điểm tập kết và lên đời. Mỗi bên tối đa 200 dân/quân; voi Ba Tư và Đại Việt tối đa sáu con, kể cả hàng chờ.
- Sáu bộ quân và cơ chế phe: khiên La Mã, trại di động Mông Cổ, thương mại Ba Tư, chế độ sản xuất Đại Đường, triển khai pháo Ottoman và huy động dân binh Đại Việt.
- Bản đồ 96×96, ba kiểu địa hình, ba mức AI, sương mù theo tầm nhìn hiện tại, bản đồ nhỏ, tạm dừng, tốc độ trận và lưu trên trình duyệt/JSON. Bản lưu 64×64 cũ vẫn đọc được.
- Xưởng Mô Hình để xem quân, nhà, thiên nhiên, hành động và hướng nhìn. Nhạc và hiệu ứng tổng hợp bằng Web Audio.
- Giao diện tiếng Việt, Anh và Trung giản thể. Lựa chọn trực tiếp được lưu; nếu chưa chọn, dùng ngôn ngữ trình duyệt đầu tiên được hỗ trợ, dùng tiếng Anh khi không khớp.

## Điều khiển

| Thao tác                                | Phím/chuột                                                    |
| --------------------------------------- | ------------------------------------------------------------- |
| Chọn                                    | Nhấp trái hoặc kéo khung                                      |
| Thêm/bớt lựa chọn; xếp lệnh             | Shift + nhấp; Shift + chuột phải                              |
| Di chuyển hoặc tương tác mục tiêu       | Chuột phải; di chuyển thường ngắt giao chiến đến khi tới đích |
| Tiến công trên đường đi                 | A, rồi nhấp trái vào đích                                     |
| Rút lui                                 | D, rồi nhấp trái vào đích                                     |
| Dừng / bật tắt giữ chỗ                  | S / H                                                         |
| Chọn dân rảnh                           | I                                                             |
| Gán / gọi nhóm                          | Ctrl/Cmd + 1–9 / 1–9; bấm số hai lần để đưa camera tới nhóm   |
| Đưa camera về lựa chọn hoặc thành chính | F                                                             |
| Kéo / zoom trên touchpad                | Vuốt hai ngón / Ctrl/Cmd + cuộn hoặc chụm ngón                |
| Kéo bản đồ                              | Space/Alt + kéo, hoặc bật nút kéo bản đồ                      |
| Xoay tường/cổng / đặt tiếp              | R / Shift + nhấp                                              |

Rời trận chưa kết thúc hoặc bấm Back mở hộp xác nhận và tạm dừng trận. Bạn có thể ở lại, lưu rồi thoát, hoặc thoát không lưu; xác nhận thoát về trang chủ. Tự lưu mỗi 30 giây và khi tab chuyển sang nền. Cảnh báo refresh/đóng tab dùng `beforeunload` của trình duyệt và có thể cần tương tác trước đó. Xuất JSON để có bản lưu mang sang máy khác.

## Tài liệu

[Mục lục tài liệu](INDEX.md) phân biệt cơ chế hiện tại, thiết kế mục tiêu và bằng chứng lịch sử. Mỗi trang được duy trì có bản Anh, Việt và Trung giản thể tương ứng.

| Nội dung                                     | Tài liệu                                     |
| -------------------------------------------- | -------------------------------------------- |
| Phe, bộ quân và căn cứ lịch sử               | [Nền văn minh](CIVILIZATIONS.md)             |
| Phối quân, điều khiển và khắc chế            | [Bố trí lực lượng](FORCE-DEPLOYMENT.md)      |
| Tốc độ khai thác, hàng mang và giá huy động  | [Kinh tế](ECONOMY.md)                        |
| Thiết kế mục tiêu và các mốc còn lại         | [Kế hoạch 2D](PLAN-2D.md)                    |
| Kiểm tra đã xác minh và giới hạn bằng chứng  | [Kết quả kiểm tra](VALIDATION.md)            |
| Nội dung riêng, ảnh AI và giấy phép thư viện | [Quyền và giấy phép](RIGHTS-AND-LICENSES.md) |
| Atlas runtime                                | [Mỹ thuật runtime](RUNTIME-ART.md)           |

## Phát triển

`pnpm validate` chạy lint, định dạng, kiểm kiểu, giấy phép, bài kiểm và build production. Lệnh riêng: `pnpm lint`, `pnpm format:check`, `pnpm check`, `pnpm check:licenses`, `pnpm test`, `pnpm build`. Dùng `pnpm lint:fix` hoặc `pnpm format` để sửa tự động.

Khi đổi thư viện phụ thuộc hoặc sinh hồ sơ cho OS/CPU khác, chạy `pnpm audit:licenses` rồi `pnpm check:licenses`. Notice sinh tự động và manifest ảnh được loại khỏi Prettier. `pnpm clean` dọn build/cache sinh lại được; `test-results/` chứa bằng chứng QA cục bộ và được Git bỏ qua.

| Đường dẫn                           | Vai trò                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| `src/game/`                         | Dữ liệu, profile phe, mô phỏng, tìm đường và AI; bước cố định 20 Hz |
| `src/render/`                       | Cảnh PixiJS, chọn atlas, hình học, camera và hiệu ứng giao chiến    |
| `src/ui/`, `src/i18n/`              | React menu/HUD/xưởng và bản dịch                                    |
| `src/audio/`                        | Âm thanh tổng hợp riêng                                             |
| `tests/`, `scripts/`                | Kiểm tra hồi quy và công cụ ảnh/giấy phép                           |
| `src/assets/`                       | Ảnh nền giao diện do Vite nhập vào                                  |
| `scripts/data/`                     | Dữ liệu đầu vào của công cụ đo và hiệu chỉnh mỹ thuật               |
| `docs/`, `public/art/`, `licenses/` | Tài liệu, ảnh runtime và hồ sơ giấy phép                            |

## Giới hạn bản chơi thử và quyền

Chưa có chơi online, chiến dịch, thủy chiến, trú quân trong công trình, cây công nghệ quân sự hoặc đặt tường bằng cách kéo chuột. Bốn vị trí khởi đầu dự trữ không có nghĩa mô phỏng hỗ trợ bốn đội. Cơ chế tránh nhau cục bộ chưa bảo đảm giữ đội hình cố định; AI chưa dùng đầy đủ mọi kỹ năng phe.

Ảnh dùng bốn hướng chéo nguồn và chọn hướng gần nhất. Đại Việt có tư thế đi nguyên hình và atlas hàng gỗ/vàng/đá/thịt riêng; các phe còn lại có cách thể hiện hàng riêng. Chưa có đầy đủ hoạt họa chết, nhà hư hại hoặc trang phục từng đời cho mọi quân. Chưa chứng nhận hiệu năng ở 400 đơn vị tổng.

Mã nguồn, mỹ thuật, logo và âm thanh gốc của dự án được cấp phép [MIT](../../LICENSE). Điều khoản bên thứ ba áp dụng cho thành phần tương ứng; notice nguyên văn ở [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md) và [file giấy phép phân phối](../../public/third-party-licenses.txt). Ảnh tham chiếu người dùng cung cấp chỉ dùng trong quá trình thiết kế, đã được xóa và không phân phối cùng dự án. Xem hồ sơ quyền cho giới hạn đầu ra AI và nguồn tham chiếu.
