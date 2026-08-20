-- =========================================================
-- SCHEMA LMS - He thong quan ly hoc tap
-- 4 cap noi dung: Danh muc > Khoa hoc > Chuong > Bai > Tai nguyen
-- =========================================================

-- ---------- 6. PHAN QUYEN ----------
-- super_admin > admin > teacher (giang vien) > ta (tro giang) > student (hoc vien)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('super_admin','admin','teacher','ta','student')),
  avatar_url TEXT,
  phone TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  logged_in_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- 1. DANH MUC (cay khong gioi han cap - vd: Lop 10 > Toan 10) ----------
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- KHOA HOC ----------
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  short_desc TEXT,
  description TEXT,
  thumbnail_url TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- CHUONG ----------
CREATE TABLE IF NOT EXISTS chapters (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- BAI ----------
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT, -- noi dung soan bang CKEditor
  is_preview INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- 3. VIDEO (nhieu nguon: youtube/vimeo/upload/drive), keo tha sap xep ----------
CREATE TABLE IF NOT EXISTS lesson_videos (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('youtube','vimeo','upload','drive')),
  source_value TEXT NOT NULL, -- id/url tuy loai nguon
  duration_seconds INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- FILE / PDF dinh kem bai hoc ----------
CREATE TABLE IF NOT EXISTS lesson_files (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf', -- pdf, doc, zip, download...
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- BAI KIEM TRA (quiz) ----------
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pass_score INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  attempted_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- 4. HOC VIEN: ghi danh, tien do, nhat ky hoc ----------
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  is_completed INTEGER NOT NULL DEFAULT 0,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- ---------- 5. THANH TOAN ----------
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer'
    CHECK (payment_method IN ('vnpay','momo','zalopay','bank_transfer','activation_code')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','cancelled')),
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- ---------- MA KICH HOAT ----------
CREATE TABLE IF NOT EXISTS activation_codes (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  is_used INTEGER NOT NULL DEFAULT 0,
  used_by_user_id INTEGER REFERENCES users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- BANNER / TIN TUC ----------
CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  link_url TEXT,
  title TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  author_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  thumbnail_url TEXT,
  content TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- 8. CHUNG CHI ----------
CREATE TABLE IF NOT EXISTS certificates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  certificate_code TEXT UNIQUE NOT NULL,
  file_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Bang luu session (dung chung voi connect-pg-simple, tu tao khi khoi dong)

-- ---------- CAI DAT HE THONG (key-value, dung cho cau hinh thanh toan...) ----------
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ---------- BO SUNG: nhieu dang cau hoi (trac nghiem 1 dap an / dung-sai / tra loi ngan / tu luan) ----------
-- Theo dung cau truc de thi tot nghiep THPT tu 2025 (Quyet dinh 764/QD-BGDDT)
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'single_choice';
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS points NUMERIC(6,2) NOT NULL DEFAULT 0.25;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS correct_answer TEXT;

-- Cac y (a,b,c,d) trong 1 cau hoi dang Dung/Sai
CREATE TABLE IF NOT EXISTS quiz_tf_items (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

-- Diem so gio la so thap phan (0.1 / 0.25 / 0.5...) thay vi so nguyen dem cau dung
ALTER TABLE quiz_attempts ALTER COLUMN score TYPE NUMERIC(6,2) USING score::numeric;
ALTER TABLE quiz_attempts ALTER COLUMN total TYPE NUMERIC(6,2) USING total::numeric;
ALTER TABLE quizzes ALTER COLUMN pass_score TYPE NUMERIC(6,2) USING pass_score::numeric;

-- Luu bai lam tung cau (dac biet la cau tu luan/tra loi ngan can giao vien cham tay)
CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  awarded_points NUMERIC(6,2) NOT NULL DEFAULT 0,
  needs_manual_grading INTEGER NOT NULL DEFAULT 0,
  graded_by INTEGER REFERENCES users(id),
  graded_at TIMESTAMPTZ
);

-- ---------- BO SUNG: menu dieu huong tuy chinh + popup quang cao ----------
CREATE TABLE IF NOT EXISTS nav_menu_items (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS popups (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  link_url TEXT,
  title TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS compare_at_price INTEGER;

-- ---------- BO SUNG: video gioi thieu khoa hoc ----------
ALTER TABLE courses ADD COLUMN IF NOT EXISTS intro_video_url TEXT;

-- ---------- BANG TIN CONG DONG (dang trang thai/anh/video dang link) ----------
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  video_url TEXT,          -- link YouTube/Vimeo/bat ky nguon nao, KHONG upload truc tiep
  video_orientation TEXT DEFAULT 'ngang', -- 'ngang' hoac 'doc'
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS post_likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- ---------- SACH (cung cau truc nhu Khoa hoc, mua chung gio hang) ----------
CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  author TEXT,
  short_desc TEXT,
  description TEXT,
  cover_url TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  compare_at_price INTEGER,
  file_url TEXT,            -- link file ebook (PDF/Drive...) de tai sau khi mua, khong upload truc tiep
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS book_purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, book_id)
);

-- ---------- GIO HANG DUNG CHUNG (khoa hoc + sach mua chung 1 don) ----------
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('course','book')),
  item_id INTEGER NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, item_type, item_id)
);

-- Don hang gio la nhieu san pham (thay vi 1 khoa hoc/don nhu truoc)
ALTER TABLE orders ALTER COLUMN course_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('course','book')),
  item_id INTEGER NOT NULL,
  title_snapshot TEXT,
  price_snapshot INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_address TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_method_check') THEN
    ALTER TABLE orders DROP CONSTRAINT orders_payment_method_check;
  END IF;
  ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('vnpay','momo','zalopay','bank_transfer','activation_code','cod'));
END $$;

-- ---------- BO SUNG: dang nhap bang SDT + thu thap thong tin khach hang day du ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
  END IF;
END $$;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_birth_year INTEGER;

-- ---------- BO SUNG: "Doc sach online" TACH BIET HOAN TOAN voi "Sach" (ban/tai file) ----------
CREATE TABLE IF NOT EXISTS online_books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  author TEXT,
  short_desc TEXT,
  description TEXT,
  cover_url TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  compare_at_price INTEGER,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- BO SUNG: doc sach truc tiep tu 1 file PDF (upload hoac dan link bat ky), khong bat buoc phai tach chuong
ALTER TABLE online_books ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE online_books ADD COLUMN IF NOT EXISTS file_source TEXT; -- 'upload' hoac 'link'
CREATE TABLE IF NOT EXISTS online_book_chapters (
  id SERIAL PRIMARY KEY,
  online_book_id INTEGER NOT NULL REFERENCES online_books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  is_free INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- BO SUNG: muc luc go tay (tieu de + so trang) cho sach doc online kieu 1 file PDF,
-- de nguoi doc bam vao la nhay thang toi dung trang, khong phu thuoc vao viec tu nhan dien.
CREATE TABLE IF NOT EXISTS online_book_toc_entries (
  id SERIAL PRIMARY KEY,
  online_book_id INTEGER NOT NULL REFERENCES online_books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  page_number INTEGER NOT NULL, -- so trang nguoi doc se thay (bat dau tu 1)
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS online_book_purchases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  online_book_id INTEGER NOT NULL REFERENCES online_books(id) ON DELETE CASCADE,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, online_book_id)
);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_item_type_check') THEN
    ALTER TABLE cart_items DROP CONSTRAINT cart_items_item_type_check;
  END IF;
  ALTER TABLE cart_items ADD CONSTRAINT cart_items_item_type_check CHECK (item_type IN ('course','book','online_book'));
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_item_type_check') THEN
    ALTER TABLE order_items DROP CONSTRAINT order_items_item_type_check;
  END IF;
  ALTER TABLE order_items ADD CONSTRAINT order_items_item_type_check CHECK (item_type IN ('course','book','online_book'));
END $$;

-- ---------- BO SUNG: "Thuc chien phong thi" - de thi doc lap khong gan voi bai hoc nao ----------
ALTER TABLE quizzes ALTER COLUMN lesson_id DROP NOT NULL;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_standalone INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ---------- BO SUNG: trai nghiem thi kieu Azota/EduQuiz (dem gio, tron de, xep hang, giao de rieng) ----------
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS shuffle_questions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS shuffle_answers INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'; -- 'public' hoac 'assigned'
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS duration_seconds INTEGER; -- thoi gian thuc te lam bai, dung de xep hang khi diem bang nhau

CREATE TABLE IF NOT EXISTS quiz_assignments (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(quiz_id, user_id)
);

-- Ghi lai thoi diem bat dau lam bai de tinh dem nguoc chinh xac (chong load lai trang bi reset gio)
CREATE TABLE IF NOT EXISTS quiz_starts (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(quiz_id, user_id)
);

-- ---------- BO SUNG: vong doi ma kich hoat (han dung, vo hieu hoa thu cong) ----------
ALTER TABLE activation_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE activation_codes ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1;

-- ---------- BO SUNG: doc sach online kieu "sach lat" theo chuong, gop chung voi Sach (khong tach rieng Truyen nua) ----------
CREATE TABLE IF NOT EXISTS book_chapters (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  is_free INTEGER NOT NULL DEFAULT 0, -- doc mien phi du sach dang tra phi (vd doc thu vai chuong dau)
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- BO SUNG: doc thu sach + phan loai sach (dat cuoi file vi can bang books da ton tai) ----------
ALTER TABLE books ADD COLUMN IF NOT EXISTS preview_url TEXT; -- link PDF doc thu (Google Drive...)

-- Danh muc rieng cho Sach, TACH BIET hoan toan voi danh muc Khoa hoc (categories)
CREATE TABLE IF NOT EXISTS book_categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES book_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chuyen books.category_id sang tro toi book_categories (truoc do dang tro nham qua categories cua Khoa hoc)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='books' AND column_name='category_id') THEN
    ALTER TABLE books DROP CONSTRAINT IF EXISTS books_category_id_fkey;
    UPDATE books SET category_id = NULL; -- gia tri cu tham chieu sai bang, dat lai ve rong cho an toan
  ELSE
    ALTER TABLE books ADD COLUMN category_id INTEGER;
  END IF;
  ALTER TABLE books ADD CONSTRAINT books_category_id_fkey FOREIGN KEY (category_id) REFERENCES book_categories(id) ON DELETE SET NULL;
END $$;

CREATE TABLE IF NOT EXISTS book_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE books ADD COLUMN IF NOT EXISTS book_type_id INTEGER REFERENCES book_types(id) ON DELETE SET NULL;

-- ---------- BO SUNG: Danh muc rieng cho "Doc sach online", TACH BIET hoan toan voi Danh muc Sach (book_categories) ----------
CREATE TABLE IF NOT EXISTS online_book_categories (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES online_book_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE online_books ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES online_book_categories(id) ON DELETE SET NULL;
