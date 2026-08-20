# LMS HọcOnline — Hệ thống Quản lý Học tập

Bản nâng cấp từ website khóa học đơn giản lên LMS đầy đủ:
**Danh mục → Khóa học → Chương → Bài → (Video / PDF / File / Bài kiểm tra)**

---

## ✅ Đã hoàn thành trong bản này

- **Cấu trúc 4 cấp nội dung** (Danh mục lồng nhau không giới hạn cấp, vd: Lớp 10 > Toán 10)
- **5 vai trò phân quyền**: super_admin, admin, teacher (giảng viên), ta (trợ giảng), student
- **Video đa nguồn**: YouTube, Vimeo, Upload MP4, Google Drive — kéo thả sắp xếp chương/bài
- **Học viên**: avatar, điểm, tiến độ học (%), nhật ký học tập, lịch sử đăng nhập
- **Thanh toán**: VNPay (đã code sẵn logic ký số, chỉ cần điền merchant), Chuyển khoản QR (VietQR — chạy ngay không cần đăng ký), khung sẵn cho MoMo/ZaloPay
- **Mã kích hoạt** để mở khóa thủ công
- **Đổi mật khẩu** có giao diện riêng (học viên + admin), không cần vào database
- **Chứng chỉ PDF + QR Code xác thực**
- **Dashboard admin**: học viên, khóa học, video, lượt xem, doanh thu (biểu đồ Chart.js)
- **Banner, Tin tức, Quản lý nhân sự/phân quyền**
- Giao diện Bootstrap 5, responsive

### ⏳ Chưa làm trong bản này (dự kiến ở giai đoạn tiếp theo)
- Giao diện làm bài kiểm tra (quiz) cho học viên — bảng dữ liệu đã có sẵn trong database, còn thiếu route + màn hình làm bài/chấm điểm
- Webhook tự động xác nhận thanh toán MoMo/ZaloPay (hiện tại VNPay đã tự động; MoMo/ZaloPay cần bạn đăng ký merchant rồi mình nối tiếp)
- CKEditor cho phần soạn nội dung bài học (hiện đang dùng textarea thường)

---

## ⚠️ Lưu ý quan trọng trước khi triển khai

**Render free KHÔNG có ổ đĩa lưu trữ bền vững.** Điều này ảnh hưởng tới:
- Database → đã giải quyết bằng cách dùng **Neon Postgres (miễn phí vĩnh viễn)** thay vì SQLite/Render Postgres free (tự xóa sau 30 ngày)
- **File upload (video MP4, ảnh đại diện, ảnh khóa học, banner)** → nếu dùng gói free của Render, các file này **sẽ mất mỗi khi service khởi động lại**. Vì vậy:
  - Với **video**: nên ưu tiên dùng YouTube/Vimeo/Google Drive (không lưu file trên server) thay vì "Upload MP4" khi chạy trên gói free
  - Với **ảnh đại diện/ảnh khóa học/banner**: nếu cần bền vững trên free tier, nên đổi sang lưu ảnh ở dịch vụ ngoài miễn phí như Cloudinary (mình có thể nối thêm nếu bạn cần)

---

## 1. Chạy thử trên máy tính

### Bước 1 — Tạo database miễn phí trên Neon
1. Vào https://neon.tech, đăng ký tài khoản miễn phí (không cần thẻ)
2. Tạo Project mới → copy **Connection String** (dạng `postgresql://...`)

### Bước 2 — Cài đặt
```
npm install
cp .env.example .env
```
Mở file `.env`, dán `DATABASE_URL` vừa copy từ Neon vào, và đặt `SESSION_SECRET` bất kỳ.

### Bước 3 — Tạo bảng & dữ liệu mẫu
```
npm run migrate
npm run seed
```

### Bước 4 — Chạy
```
npm start
```
Mở `http://localhost:3000`.

**Tài khoản Super Admin mặc định:** `admin@example.com` / `admin123` — đăng nhập tại `/admin/dang-nhap`, **đổi mật khẩu ngay** tại menu "Tài khoản" trong trang quản trị.

---

## 2. Đưa lên mạng (Render — miễn phí)

### Bước 1 — Đưa code lên GitHub
Tạo repository mới, upload toàn bộ thư mục này lên (**trừ `node_modules` và `.env`**, đã được `.gitignore` loại trừ sẵn).

### Bước 2 — Tạo Web Service trên Render
1. Vào https://render.com, đăng ký bằng GitHub
2. **New +** → **Web Service** → chọn repository vừa tạo
3. Build Command: `npm install` — Start Command: `npm start`
4. Vào mục **Environment Variables**, thêm toàn bộ các biến giống trong file `.env` của bạn (đặc biệt là `DATABASE_URL` và `SESSION_SECRET`)
5. **Không cần** thêm Disk (vì database đã ở Neon, không nằm trên Render)
6. Bấm **Create Web Service**

### Bước 3 — Khởi tạo database trên môi trường Render (chạy 1 lần)
Sau khi service chạy thành công, vào tab **Shell** của service trên Render, gõ:
```
npm run migrate
npm run seed
```

### Bước 4 — Gắn tên miền riêng
Vào **Settings → Custom Domains** trên Render, làm theo hướng dẫn để trỏ DNS từ nơi bạn mua tên miền.

---

## 3. Cấu trúc dự án (MVC)

```
config/db.js          Kết nối PostgreSQL
models/                Truy vấn database (User, Course, Chapter, Lesson...)
controllers/            Xử lý logic từng khu vực (admin, học viên, thanh toán...)
routes/                 Định tuyến URL
views/                  Giao diện EJS (public site + admin)
services/payment/       Tích hợp VNPay / MoMo / ZaloPay / VietQR
middleware/             Xác thực đăng nhập, phân quyền, upload file
scripts/                schema.sql, migrate.js, seed.js
```

## 4. Cách dùng hằng ngày (không cần biết code)

- **Thêm khóa học**: `/admin/khoa-hoc/them-moi`
- **Thêm chương/bài/video**: vào khóa học → nút "Nội dung" → thêm chương, thêm bài, thêm video (dán link YouTube/Vimeo/Drive hoặc upload MP4), kéo thả để sắp xếp
- **Cấp quyền học viên đã chuyển khoản thủ công**: `/admin/don-hang` → "Xác nhận đã thanh toán"
- **Tạo mã kích hoạt**: `/admin/ma-kich-hoat`
- **Thêm nhân sự (giảng viên/trợ giảng/admin)**: `/admin/nhan-su`
