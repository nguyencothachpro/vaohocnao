const Category = require('../models/Category');
const Course = require('../models/Course');
const Banner = require('../models/Banner');
const News = require('../models/News');
const Enrollment = require('../models/Enrollment');
const axios = require('axios');
const path = require('path');
const { resolveDirectDownloadUrl } = require('../utils');

exports.home = async (req, res) => {
  const [categories, courses, banners, news] = await Promise.all([
    Category.tree(),
    Course.published(),
    Banner.active(),
    News.published()
  ]);
  res.render('index', { categories, courses: courses.slice(0, 12), banners, news: news.slice(0, 4) });
};

exports.allCourses = async (req, res) => {
  const courses = await Course.published();
  const categories = await Category.tree();
  res.render('all-courses', { courses, categories });
};

exports.categoryPage = async (req, res) => {
  const category = await Category.findBySlug(req.params.slug);
  if (!category) return res.status(404).render('404');
  const courses = await Course.byCategory(category.id);
  const categories = await Category.tree();
  res.render('category', { category, courses, categories });
};

exports.courseDetail = async (req, res) => {
  const course = await Course.findBySlug(req.params.slug);
  if (!course) return res.status(404).render('404');
  await Course.incrementView(course.id);
  const chapters = await Course.fullTree(course.id);
  let enrolled = false;
  if (req.session.user) enrolled = await Enrollment.isEnrolled(req.session.user.id, course.id);
  res.render('course-detail', { course, chapters, enrolled });
};

exports.allBooks = async (req, res) => {
  const Book = require('../models/Book');
  const BookType = require('../models/BookType');
  const BookCategory = require('../models/BookCategory');

  const categories = await BookCategory.tree();
  const bookTypes = await BookType.all();

  let category_id = null, category_ids = null, book_type_id = null;
  if (req.query.danh_muc) {
    const cat = await BookCategory.findBySlug(req.query.danh_muc);
    if (cat) { category_id = cat.id; category_ids = await BookCategory.subtreeIds(cat.id); }
  }
  if (req.query.the_loai) {
    const bt = await BookType.findBySlug(req.query.the_loai);
    if (bt) book_type_id = bt.id;
  }

  const books = await Book.published({ category_ids, book_type_id });
  res.render('all-books', { books, categories, bookTypes, activeCategory: req.query.danh_muc || null, activeType: req.query.the_loai || null });
};

exports.bookDetail = async (req, res) => {
  const Book = require('../models/Book');
  const BookPurchase = require('../models/BookPurchase');
  const book = await Book.findBySlug(req.params.slug);
  if (!book) return res.status(404).render('404');
  let purchased = false;
  if (req.session.user) purchased = await BookPurchase.isPurchased(req.session.user.id, book.id);
  const chapters = await require('../models/ContentTree').fullTree('book', book.id);
  res.render('book-detail', { book, purchased, chapters });
};

exports.onlineReadingBooks = async (req, res) => {
  const OnlineBook = require('../models/OnlineBook');
  const OnlineBookCategory = require('../models/OnlineBookCategory');

  const categories = await OnlineBookCategory.tree();

  let category_ids = null;
  if (req.query.danh_muc) {
    const cat = await OnlineBookCategory.findBySlug(req.query.danh_muc);
    if (cat) category_ids = await OnlineBookCategory.subtreeIds(cat.id);
  }

  const books = await OnlineBook.published({ category_ids });
  res.render('online-reading-books', { books, categories, activeCategory: req.query.danh_muc || null });
};

exports.onlineBookDetail = async (req, res) => {
  const OnlineBook = require('../models/OnlineBook');
  const OnlineBookChapter = require('../models/OnlineBookChapter');
  const OnlineBookPurchase = require('../models/OnlineBookPurchase');
  const book = await OnlineBook.findBySlug(req.params.slug);
  if (!book) return res.status(404).render('404');
  // Sach kieu moi (1 file PDF, dan link/upload truc tiep) khong can danh sach chuong nua
  const chapters = book.file_url ? [] : await OnlineBookChapter.byBook(book.id);
  let purchased = false;
  if (req.session.user) purchased = await OnlineBookPurchase.isPurchased(req.session.user.id, book.id);
  res.render('online-book-detail', { book, chapters, purchased });
};

// Trang doc sach online kieu "sach lat".
// Uu tien sach kieu moi: 1 file PDF duy nhat (book.file_url), duoc lat trang bang pdf.js + page-flip.
// Sach cu con dung he thong chuong (chua chuyen doi) van doc duoc binh thuong nhu truoc.
exports.onlineBookRead = async (req, res) => {
  const OnlineBook = require('../models/OnlineBook');
  const OnlineBookPurchase = require('../models/OnlineBookPurchase');
  const book = await OnlineBook.findBySlug(req.params.slug);
  if (!book) return res.status(404).render('404');

  let purchased = false;
  if (req.session.user) purchased = await OnlineBookPurchase.isPurchased(req.session.user.id, book.id);
  const unlocked = book.price === 0 || purchased;

  if (book.file_url) {
    const OnlineBookTocEntry = require('../models/OnlineBookTocEntry');
    const manualToc = await OnlineBookTocEntry.byBook(book.id);
    return res.render('online-book-read', { book, mode: 'pdf', unlocked, purchased, chapters: [], manualToc });
  }

  const OnlineBookChapter = require('../models/OnlineBookChapter');
  const chapters = await OnlineBookChapter.byBook(book.id);
  if (chapters.length === 0) return res.redirect(`/doc-sach-online/${book.slug}`);

  const unlockedChapters = chapters.map(c => ({
    ...c,
    unlocked: book.price === 0 || c.is_free === 1 || purchased
  }));

  res.render('online-book-read', { book, mode: 'chapters', chapters: unlockedChapters, purchased, unlocked });
};

// Phat truc tiep (stream/proxy) file PDF cua sach cho trinh doc lat trang.
// Ly do can proxy qua server thay vi tro thang toi link goc: link Google Drive/link tu nhieu noi
// luu tru khac thuong khong cho phep JS trinh duyet tai truc tiep (CORS), va ta cung khong muon
// lo link file goc + kiem tra quyen mua sach truoc khi cho tai.
exports.onlineBookFile = async (req, res) => {
  const OnlineBook = require('../models/OnlineBook');
  const OnlineBookPurchase = require('../models/OnlineBookPurchase');
  const book = await OnlineBook.findBySlug(req.params.slug);
  if (!book || !book.file_url) return res.status(404).end();

  let purchased = false;
  if (req.session.user) purchased = await OnlineBookPurchase.isPurchased(req.session.user.id, book.id);
  if (book.price > 0 && !purchased) return res.status(403).end();

  try {
    // File da upload len chinh server thi phuc vu thang tu dia, khong can goi mang ra ngoai
    if (book.file_url.startsWith('/uploads/')) {
      return res.sendFile(path.join(__dirname, '..', 'public', book.file_url));
    }
    const directUrl = resolveDirectDownloadUrl(book.file_url);
    const upstream = await axios.get(directUrl, {
      responseType: 'stream',
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    res.setHeader('Content-Type', 'application/pdf');
    upstream.data.pipe(res);
  } catch (err) {
    console.error('Loi tai file sach doc online:', err.message);
    res.status(502).send('Không tải được file sách từ link đã lưu. Vui lòng kiểm tra lại link (đảm bảo đã bật chia sẻ công khai) hoặc upload lại file.');
  }
};

exports.newsList = async (req, res) => {
  const news = await News.published();
  res.render('news-list', { news });
};

exports.newsDetail = async (req, res) => {
  const article = await News.findBySlug(req.params.slug);
  if (!article) return res.status(404).render('404');
  res.render('news-detail', { article });
};
