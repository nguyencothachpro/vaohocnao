# KingEdu LMS V9 - build from lms-hoc-online 8

Bản này **bê trực tiếp bộ `lms-hoc-online 8` làm nền**, không phải prototype mới.

## Điểm chính
- Khóa học: Chương -> Bài -> Video/Tài liệu/Bài tập, kéo thả chương và kéo bài giữa các chương.
- Sách: dùng chung Content Engine với khóa học: Chương -> Bài -> Video/Tài liệu/Bài tập.
- Video có `Miễn phí` riêng và thời lượng chỉ là trường tùy chọn.
- Tài liệu có thể upload tối đa 50MB hoặc dán link Drive/PDF.
- Đọc sách online giữ nguyên bộ PDF.js + page-flip của bản 8.
- Có alias `/admin/doc-sach-tai-lieu` để không còn 404 khi dùng đường dẫn cũ.
- Phòng học `/hoc-cung-thay-co/<ROOM>` có bảng viết, bút, highlight, tẩy, text, undo, camera, micro, screen share, PDF/Drive và đồng bộ bảng/PDF qua WebSocket cho prototype.

## Deploy Render
1. Push toàn bộ repo lên GitHub.
2. Render Build Command: `npm install && npm run migrate`
3. Start Command: `npm start`
4. Giữ `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` theo môi trường hiện tại.
5. Sau deploy mở `/admin` hoặc `/admin/dang-nhap`.

## Lưu ý
- Camera/micro/screen share cần HTTPS và người dùng cấp quyền trình duyệt.
- WebSocket phòng học hiện là lớp đồng bộ thao tác/bảng cho prototype; không phải media server 5.000 người. Khi UX được duyệt, tầng live sẽ chuyển sang kiến trúc OBS/CDN/media server.
