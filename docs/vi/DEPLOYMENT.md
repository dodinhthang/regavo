# Deploy và phát hành

[English](../en/DEPLOYMENT.md) | **Tiếng Việt** | [简体中文](../zh-CN/DEPLOYMENT.md)

Regavo dùng Cloudflare Workers Static Assets, Worker `regavo`, phục vụ bản tối ưu `dist/` tại gốc domain. URL đầu tiên dùng subdomain `workers.dev` của account. Mô phỏng chạy trong trình duyệt; người chơi không cần backend, database hay khóa API.

## Khi nào pipeline chạy

| Sự kiện                             | Kiểm tra                                                                                  | Production         |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------ |
| Mở/cập nhật PR vào `main`           | Lint, format, type, giấy phép, tests, build, RGBA ảnh, Chromium smoke và Wrangler dry-run | Không              |
| Push/merge vào `main`               | Cùng bộ kiểm tra trên                                                                     | Không              |
| Push tag ổn định như `v1.0.0`       | Xác minh tag rồi chạy toàn bộ kiểm tra                                                    | Deploy khi đạt     |
| Chạy Release thủ công với tag đã có | Xác minh, build và kiểm tra tag đó                                                        | Deploy lại khi đạt |

Workflow PR chỉ có quyền đọc repo, không nhận credentials Cloudflare. `ci.yml` không deploy. `release.yml` chạy các release production lần lượt và chuyển artifact đã kiểm tra sang job deploy, không build lại. Artifact deploy và log lỗi được giữ một ngày.

## Review local và thiết lập GitHub

Có thể review và kiểm tra toàn bộ cấu hình ở local. Chỉ tạo tag phát hành sau khi code/pipeline đã ở `main` và CI đạt. Remote đích là `git@github.com:dodinhthang/regavo.git`; nhánh local giữ cả commit LICENSE sẵn có trên GitHub và lịch sử local. Push nhánh và tạo PR là bước riêng.

Khi muốn bật deploy từ GitHub:

1. Push nhánh thiết lập và merge qua PR vào `main`; không force-push hay commit `node_modules/`, `dist/`, `.openai/`, `.wrangler/`, kết quả test hoặc file môi trường.
2. Trong **Settings → Environments**, tạo `production`. Thêm hai environment secrets: `CLOUDFLARE_ACCOUNT_ID` và `CLOUDFLARE_API_TOKEN`.
3. Tạo Worker `regavo` trước khi tạo token deploy. Tạo account API token tên `regavo-github-production` với **Specified Workers → regavo → Editor** để token chỉ được deploy Worker này. Nhập trực tiếp token vào GitHub Secrets, không ghi vào code, YAML hay chat. Xem [quyền và phạm vi Workers](https://developers.cloudflare.com/workers/authorization/workers/).
4. Sau lần CI đầu đạt, yêu cầu status check **Validate** trước khi merge PR vào `main`. Không bật thêm luồng tự deploy từ Cloudflare Builds.

Workflow dùng Ubuntu 24.04, Node `22.23.3`, pnpm `12.8.1`, Wrangler `4.149.0`; GitHub Actions được pin bằng commit SHA đã xác minh. Cache pnpm và WebP phân biệt nền tảng runner/toolchain; cache ảnh thiếu hoặc sai sẽ được tạo lại.

Hồ sơ giấy phép có dependency riêng theo OS/CPU. CI chạy `pnpm audit:licenses` trước `pnpm validate` để notice Linux khớp package thực sự cài và được đưa vào artifact phát hành; không commit file sinh lại về GitHub.

## Kiểm tra trước phát hành

```sh
pnpm install --frozen-lockfile
pnpm audit:licenses
pnpm exec playwright install chromium
pnpm validate
pnpm test:smoke
pnpm dlx wrangler@4.149.0 deploy --dry-run --outdir test-results/wrangler
```

Chromium kiểm tra sáu văn minh × ba đời, vào/thoát trận Đại Việt sau khi Web Worker mô phỏng chạy, và mở xưởng bằng URL hash. Response thiếu, MIME ảnh/Worker sai hoặc lỗi JavaScript làm bài kiểm thất bại. Kết quả smoke tách vào `test-results/smoke/` và `playwright-report/`.

## Phát hành và phục hồi

Merge thay đổi đã kiểm tra, cập nhật version trong `package.json`, rồi gắn tag cho đúng commit trên `main`. Với bản đầu:

```sh
git switch main
git pull --ff-only origin main
git tag -a v1.0.0 -m "Regavo 1.0.0"
git push origin v1.0.0
```

Chỉ nhận tag ổn định `vMAJOR.MINOR.PATCH`, không có số 0 thừa hoặc hậu tố prerelease. Tag phải tồn tại, commit thuộc lịch sử `origin/main`, và version của `package.json` tại tag phải khớp. Tag không hợp lệ bị chặn trước deploy. Các bản sửa tiếp dùng `v1.0.1`, `v1.0.2`…; không dời tag đã phát hành.

Sau deploy, workflow so sánh HTML, asset manifest, ảnh đại diện, hình học, bundle khởi động, icons và Web Worker với artifact đã kiểm tra. Asset có hash phải có cache immutable một năm; ảnh thiếu phải trả 404. Pipeline thử lại ngắn khi bản mới đang lan truyền, rồi báo lỗi nếu vẫn không đạt. Job summary ghi tag, SHA, URL và kết quả. Không tự rollback.

Để phục hồi, vào **Actions → Release → Run workflow** từ `main`, nhập một tag ổn định đã deploy vào ô `tag`. Pipeline build và kiểm tra phiên bản đó trước khi deploy lại. Artifact GitHub hết hạn không cản phục hồi; tag được chọn phải chứa pipeline này. Không cần tạo tag mới khi phục hồi.

URL production ban đầu là `https://regavo.dothang-hit.workers.dev`. Chưa cấu hình custom domain hoặc URL preview PR. Toàn bộ nội dung gốc của dự án, gồm code, artwork, logo và âm thanh, dùng [MIT](../../LICENSE); thư viện giữ giấy phép riêng.
