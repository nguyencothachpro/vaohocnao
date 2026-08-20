// Trich xuat van ban tho tu file Word (.docx), PDF, Excel (.xlsx), hoac anh (OCR) de dua vao bo phan tich de thi
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function extractFromDocx(filePath) {
  // Uu tien doc "day du" (giu dung vi tri cong thuc Equation lan anh nhung) —
  // neu buoc nay loi vi ly do gi (file qua la, cau truc khong chuan...), tu dong quay ve
  // cach doc chu thuong (an toan, da chay on dinh) de KHONG lam hong tinh nang dang co.
  try {
    const { extractDocxRich } = require('./docxRichExtractor');
    const result = await extractDocxRich(filePath);
    if (result && result.text && result.text.trim().length > 0) return result;
  } catch (err) {
    console.error('Doc docx "day du" that bai, quay ve cach doc chu thuong:', err.message);
  }

  const images = [];
  const result = await mammoth.convertToHtml({ path: filePath }, {
    convertImage: mammoth.images.imgElement(async (image) => {
      const b64 = await image.read('base64');
      const idx = images.length;
      images.push(`data:${image.contentType};base64,${b64}`);
      return { src: `__IMGPLACEHOLDER_${idx}__` };
    })
  });
  let text = result.value
    .replace(/<img[^>]*src="__IMGPLACEHOLDER_(\d+)__"[^>]*>/g, '[[IMG:$1]]')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return { text, images };
}

async function extractFromPdf(filePath) {
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  // Luu y: chi doc duoc PDF co chu thuc (van ban), KHONG doc duoc PDF dang anh scan
  return data.text;
}

// Doc file Excel: gom het noi dung cac o theo tung dong, moi dong 1 dong van ban,
// giup bo phan tich cau hoi (regex/AI) xu ly duoc y nhu doc file docx/pdf
async function extractFromExcel(filePath) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);
  let lines = [];
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    rows.forEach(row => {
      const line = row.map(cell => (cell === undefined || cell === null) ? '' : String(cell).trim()).filter(Boolean).join(' ');
      if (line) lines.push(line);
    });
  });
  return lines.join('\n');
}

// Doc chu trong anh bang OCR (Tesseract, mien phi, chay ngay tren server, ho tro tieng Viet).
// Luu y: do chinh xac THAP HON nhieu so voi doc file docx/pdf that su, dac biet voi cong thuc Toan/Ly/Hoa
// va anh chup nghieng/mo/thieu sang - chi nen dung khi khong co san file goc.
async function extractFromImage(filePath) {
  const Tesseract = require('tesseract.js');
  const { data } = await Tesseract.recognize(filePath, 'vie+eng');
  return data.text;
}

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.docx') return extractFromDocx(filePath); // { text, images }
  if (ext === '.pdf') return { text: await extractFromPdf(filePath), images: [] };
  if (ext === '.xlsx' || ext === '.xls') return { text: await extractFromExcel(filePath), images: [] };
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return { text: await extractFromImage(filePath), images: [] };
  throw new Error('Chỉ hỗ trợ file .docx, .pdf, .xlsx hoặc ảnh (.jpg/.png)');
}

// Thay cac token [[IMG:n]] bang the <img> that su, dung o buoc cuoi sau khi da tach xong tung cau/dap an
function restoreImages(text, images) {
  if (!text) return text;
  return text.replace(/\[\[IMG:(\d+)\]\]/g, (m, idx) => {
    const src = images[parseInt(idx)];
    return src ? `<img src="${src}" style="max-width:100%;display:block;margin:6px 0">` : '';
  });
}

// Tai file tu link Google Drive (dang chia se cong khai) ve thu muc tam, tra ve duong dan file da tai
async function downloadFromDriveLink(driveUrl, destDir) {
  const idMatch = driveUrl.match(/\/d\/([\w-]+)/) || driveUrl.match(/[?&]id=([\w-]+)/);
  if (!idMatch) throw new Error('Không nhận diện được ID file từ link Google Drive. Đảm bảo link dạng .../file/d/XXXX/view và đã bật chia sẻ công khai.');
  const fileId = idMatch[1];
  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  const response = await axios.get(directUrl, {
    responseType: 'arraybuffer',
    maxRedirects: 5,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const contentType = (response.headers['content-type'] || '').toLowerCase();

  if (contentType.includes('text/html')) {
    throw new Error('Google Drive trả về trang xác nhận thay vì file thật — thường xảy ra với file dung lượng lớn (>25MB) hoặc link chưa bật chia sẻ công khai ("Bất kỳ ai có đường liên kết"). Hãy thử tải file về máy rồi upload trực tiếp thay vì dùng link.');
  }

  let ext = '.pdf';
  if (contentType.includes('wordprocessingml') || contentType.includes('msword')) ext = '.docx';
  else if (contentType.includes('spreadsheetml') || contentType.includes('ms-excel')) ext = '.xlsx';
  else if (contentType.includes('image/png')) ext = '.png';
  else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) ext = '.jpg';
  else if (contentType.includes('pdf')) ext = '.pdf';

  // Tu tao thu muc neu chua co, khong phu thuoc vao viec thu muc rong da duoc dua len GitHub hay chua
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, uuidv4() + ext);
  fs.writeFileSync(destPath, response.data);
  return destPath;
}

module.exports = { extractText, downloadFromDriveLink, restoreImages };
