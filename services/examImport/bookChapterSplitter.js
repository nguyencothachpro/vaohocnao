// Tach noi dung sach/truyen thanh tung chuong dua theo cac dau hieu thuong gap
// (Chuong 1, CHUONG I, Phan 1, Hoi 1...). Day la GOI Y BAN DAU, admin luon can xem lai truoc khi luu.

function textToHtml(text, images = []) {
  const { restoreImages } = require('./extractText');
  return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${restoreImages(p.replace(/\n/g, '<br>'), images)}</p>`).join('');
}

function splitIntoChapters(rawText, images = []) {
  const text = rawText.replace(/\r\n/g, '\n').trim();
  const regex = /\n(?=(?:Chương|CHƯƠNG|Phần|PHẦN|Hồi|HỒI)\s+[\dIVXLCM]+[\.\:\-\s])/;
  const parts = text.split(regex);

  if (parts.length <= 1) {
    // Khong tim thay dau hieu chia chuong -> coi ca file la 1 chuong duy nhat de admin tu tach tay
    return [{ title: 'Toàn bộ nội dung (chưa nhận diện được chương)', content: textToHtml(text, images), needsReview: true }];
  }

  return parts.map((part, i) => {
    const trimmed = part.trim();
    const firstLineEnd = trimmed.indexOf('\n');
    const titleLine = firstLineEnd > -1 ? trimmed.slice(0, firstLineEnd) : trimmed.slice(0, 80);
    const rest = firstLineEnd > -1 ? trimmed.slice(firstLineEnd + 1) : '';
    return {
      title: titleLine.trim().slice(0, 150) || `Chương ${i + 1}`,
      content: textToHtml(rest || trimmed, images),
      needsReview: false
    };
  });
}

module.exports = { splitIntoChapters };
