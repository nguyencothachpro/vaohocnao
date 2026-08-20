# Thiết kế lớp học và mã học sinh

## Mục tiêu
- Admin tạo lớp và chỉ định số lượng học sinh.
- Mỗi học sinh có mã đăng nhập duy nhất.
- Lớp là tầng phân quyền chính cho khóa học và phòng học.
- Có thể khóa, cấp lại mã, chuyển lớp và xuất danh sách mã.
- Không dùng mã lớp chung để thay thế danh tính học sinh.

## Luồng
Admin → Lớp học → tạo N học sinh → sinh mã riêng → gán khóa học → gán phòng học.

Học sinh → nhập mã học sinh → hệ thống xác định học sinh/lớp → chỉ hiển thị nội dung được cấp quyền.

## Dữ liệu dự kiến
- classes: id, name, grade, subject, teacher_id, status, created_at
- students: id, code, display_name, status, created_at
- class_students: class_id, student_id, joined_at
- class_courses: class_id, course_id
- classroom_classes: classroom_id, class_id

## Nguyên tắc
- code phải unique toàn hệ thống và khó đoán.
- Không lưu mã đăng nhập dạng plaintext nếu có thể dùng hash.
- Không phá dữ liệu hiện có khi bổ sung module.
- Các thay đổi tiếp theo sẽ triển khai trên branch feature/lop-hoc-ma-hoc-sinh và chỉ merge main sau khi kiểm tra.