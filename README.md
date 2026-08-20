# Vào Học Nào — Rebuilt from LMS 8

Đây là bản build lại dựa trực tiếp trên bộ `lms-hoc-online 8(2)` bạn đã cung cấp, giữ lại cấu trúc và chức năng mạnh của bộ đó, đồng thời sửa các vấn đề khiến Render trước đây liên tục chết migration.

## 1. Database an toàn
Ứng dụng dùng PostgreSQL schema riêng:
`DB_SCHEMA=lms_v2`

Các bảng cũ trong `public` không bị xóa và không được dùng. Đây là điểm quan trọng nhất: không còn ép schema mới vào các bảng cũ gây lỗi FK.

## 2. Render
Build: `npm install`
Start: `npm start`
Node: 20.x

Environment:
- DATABASE_URL
- SESSION_SECRET
- ADMIN_EMAIL
- ADMIN_PASSWORD
- DB_SCHEMA=lms_v2

`npm start` tự:
1. tạo schema riêng;
2. tạo toàn bộ schema LMS 8;
3. bổ sung các bảng classroom, book-learning, activation/expiry;
4. seed admin + 4 tab menu + settings;
5. chạy server.

## 3. Admin
`/admin/dang-nhap`

Admin có:
- Dashboard
- Danh mục riêng cho Khóa học / Sách / Đọc sách online
- Kéo thả sắp xếp
- Khóa học: Chương > Bài > Video > Tài liệu > Quiz
- Video YouTube/Vimeo/Drive/MP4
- Video/tài liệu có cờ miễn phí riêng
- Thời lượng video là metadata phục vụ hiển thị/thống kê, không phải thời gian khóa
- Sách: cấu trúc Chương > Bài > Video > Tài liệu
- Đọc sách online: PDF + page-flip + PDF.js + mục lục + preview
- Banner, popup, menu, cài đặt website, hai banner hai bên
- Mã kích hoạt cho khóa học/sách/đọc online
- Hạn mã và hạn học
- Gia hạn học viên
- Xuất/nhập dữ liệu JSON
- Phòng học trực tuyến

## 4. Phòng học
`/admin/phong-hoc` tạo phòng.
Học viên vào `/phong-hoc/<MA_PHONG>`.

Có:
- Canvas viết note
- Tẩy
- Chèn chữ
- Copy/paste ảnh
- PDF.js + page-flip
- Camera + mic
- Chia sẻ màn hình
- Xóa nền xanh kiểu chroma-key đơn giản
- Realtime bảng viết qua Socket.IO
- WebRTC camera teacher -> học viên cho lớp nhỏ
- Link YouTube Live/OBS cho lớp đông

Với hàng nghìn học viên, không dùng WebRTC mesh trực tiếp cho tất cả; dùng YouTube Live/OBS làm luồng video, còn phòng học đảm nhiệm bảng viết/tài liệu/tương tác.

## 5. Sao lưu
Admin > Xuất / nhập dữ liệu.
Backup chứa dữ liệu nghiệp vụ và URL tài nguyên. Video/PDF trên YouTube/Drive/CDN không được copy vào JSON.

## 6. Lưu ý Render
File upload vào filesystem của web service Render không nên coi là nơi lưu trữ lâu dài. Với ảnh/PDF/video production, ưu tiên URL Google Drive/CDN/Supabase Storage. Bộ code vẫn hỗ trợ upload để thử nghiệm.
