const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

function makeStorage(subfolder) {
  const dir = path.join(__dirname, '..', 'public', 'uploads', subfolder);
  return multer.diskStorage({
    destination: (req, file, cb) => {
      // Tu tao thu muc neu chua co, tranh loi ENOENT khi thu muc rong bi thieu luc dua code len GitHub
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, uuidv4() + ext);
    }
  });
}

const uploadAvatar = multer({ storage: makeStorage('avatars'), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadThumbnail = multer({ storage: makeStorage('thumbnails'), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadVideo = multer({ storage: makeStorage('videos'), limits: { fileSize: 500 * 1024 * 1024 } });
const uploadFile = multer({ storage: makeStorage('files'), limits: { fileSize: 50 * 1024 * 1024 } });
const uploadExamDoc = multer({
  storage: makeStorage('exam-imports'),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(docx|pdf|doc|xlsx|xls|jpg|jpeg|png|webp)$/i.test(file.originalname);
    cb(null, ok);
  }
});
// File PDF cua sach doc online (kieu lat trang) - chi can 1 file PDF duy nhat, khong tach chuong
const uploadBookFile = multer({
  storage: makeStorage('online-books'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.pdf$/i.test(file.originalname);
    cb(null, ok);
  }
});

// Form "Them/Sua sach doc online" gui cung luc anh bia (cover) + file PDF cua sach (book_file)
// trong 1 multipart/form-data duy nhat -> can 1 multer instance duy nhat, dinh tuyen theo fieldname
const onlineBookStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subfolder = file.fieldname === 'book_file' ? 'online-books' : 'thumbnails';
    const dir = path.join(__dirname, '..', 'public', 'uploads', subfolder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname))
});
const uploadOnlineBookForm = multer({
  storage: onlineBookStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'book_file') return cb(null, /\.pdf$/i.test(file.originalname));
    if (file.fieldname === 'cover') return cb(null, /\.(png|jpe?g|webp|gif)$/i.test(file.originalname));
    cb(null, false);
  }
}).fields([{ name: 'cover', maxCount: 1 }, { name: 'book_file', maxCount: 1 }]);

const uploadBackup = multer({storage:makeStorage('backups'),limits:{fileSize:100*1024*1024},fileFilter:(req,file,cb)=>cb(null,/\.json$/i.test(file.originalname))});
module.exports = { uploadAvatar, uploadThumbnail, uploadVideo, uploadFile, uploadExamDoc, uploadBookFile, uploadOnlineBookForm, uploadBackup };
