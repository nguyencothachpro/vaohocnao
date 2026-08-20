require('dotenv').config();
const bcrypt = require('bcryptjs');
const slugify = require('slugify');
const db = require('../config/db');

async function seed() {
  try {
    // 1. Tai khoan Super Admin mac dinh
    const existing = await db.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    if (existing.rows.length === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await db.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'super_admin')`,
        ['Quan tri vien', 'admin@example.com', hash]
      );
      console.log('>>> Da tao Super Admin: admin@example.com / admin123 (hay doi mat khau ngay!)');
    } else {
      console.log('>>> Da co Super Admin, bo qua.');
    }

    // 2. Danh muc mau: Lop 10 > Toan 10 ; Tieng Anh > IELTS > Listening
    const catCount = await db.query('SELECT COUNT(*) c FROM categories');
    if (parseInt(catCount.rows[0].c) === 0) {
      const lop10 = await db.query(
        `INSERT INTO categories (name, slug, position) VALUES ('Lớp 10', $1, 1) RETURNING id`,
        [slugify('Lop 10', { lower: true })]
      );
      const toan10 = await db.query(
        `INSERT INTO categories (parent_id, name, slug, position) VALUES ($1,'Toán 10',$2,1) RETURNING id`,
        [lop10.rows[0].id, slugify('Toan 10', { lower: true })]
      );

      const tienganh = await db.query(
        `INSERT INTO categories (name, slug, position) VALUES ('Tiếng Anh', $1, 2) RETURNING id`,
        [slugify('Tieng Anh', { lower: true })]
      );
      const ielts = await db.query(
        `INSERT INTO categories (parent_id, name, slug, position) VALUES ($1,'IELTS',$2,1) RETURNING id`,
        [tienganh.rows[0].id, slugify('IELTS', { lower: true })]
      );
      const listening = await db.query(
        `INSERT INTO categories (parent_id, name, slug, position) VALUES ($1,'Listening',$2,1) RETURNING id`,
        [ielts.rows[0].id, slugify('Listening', { lower: true })]
      );

      // 3. Khoa hoc mau + Chuong + Bai + Video mau
      const course = await db.query(
        `INSERT INTO courses (category_id, title, slug, short_desc, price, is_published)
         VALUES ($1,'Toán 10 - Đại số cơ bản',$2,'Khóa học Toán lớp 10 dành cho học sinh mới bắt đầu', 299000, 1) RETURNING id`,
        [toan10.rows[0].id, slugify('Toan 10 dai so co ban', { lower: true })]
      );
      const chapter = await db.query(
        `INSERT INTO chapters (course_id, title, position) VALUES ($1,'Chương 1: Mệnh đề - Tập hợp',1) RETURNING id`,
        [course.rows[0].id]
      );
      const lesson = await db.query(
        `INSERT INTO lessons (chapter_id, title, is_preview, position) VALUES ($1,'Bài 1: Mệnh đề',1,1) RETURNING id`,
        [chapter.rows[0].id]
      );
      await db.query(
        `INSERT INTO lesson_videos (lesson_id, title, source_type, source_value, position)
         VALUES ($1,'Video bài giảng','youtube','dQw4w9WgXcQ',1)`,
        [lesson.rows[0].id]
      );

      console.log('>>> Da tao du lieu mau: Danh muc / Khoa hoc / Chuong / Bai / Video.');
    } else {
      console.log('>>> Da co du lieu danh muc, bo qua seed mau.');
    }

    // 4. Menu dieu huong mac dinh (Trang chu la co dinh, con lai tu DB)
    const navCount = await db.query('SELECT COUNT(*) c FROM nav_menu_items');
    if (parseInt(navCount.rows[0].c) === 0) {
      await db.query(`INSERT INTO nav_menu_items (label, url, position) VALUES
        ('Khóa học', '/khoa-hoc', 1), ('Tin tức', '/tin-tuc', 2)`);
      console.log('>>> Da tao menu dieu huong mac dinh.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Loi seed:', err);
    process.exit(1);
  }
}

seed();
