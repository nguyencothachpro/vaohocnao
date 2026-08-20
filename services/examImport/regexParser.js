// Bo phan tich de thi theo mau thuong gap (Cau X: ... A. B. C. D. ... + bang dap an cuoi bai)
// Day la phuong an du phong mien phi, chay truoc AI. Ket qua chi la GOI Y BAN DAU,
// nguoi dung luon can xem lai va sua truoc khi luu (do do khong the chinh xac 100%).

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

// Tim bang dap an dang "1. A  2. C  3-B ..." hoac "Cau 1: A" o cuoi van ban
function extractAnswerKey(text) {
  const key = {};
  const keySectionMatch = text.match(/(đáp\s*án|answer\s*key)[\s\S]{0,3000}$/i);
  const searchText = keySectionMatch ? keySectionMatch[0] : text;
  const regex = /(?:câu\s*)?(\d{1,3})[\.\-:\)]\s*([A-D])\b/gi;
  let m;
  while ((m = regex.exec(searchText)) !== null) {
    key[parseInt(m[1])] = m[2].toUpperCase();
  }
  return key;
}

function parseExamText(rawText, images = []) {
  const { restoreImages } = require('./extractText');
  const text = normalizeText(rawText);
  const answerKey = extractAnswerKey(text);

  // Tach theo tung "Cau N" hoac "N)" o dau dong
  const blocks = text.split(/\n(?=(?:Câu|Bài|Question)\s*\d{1,3}[\.\:\)])/i);
  const questions = [];
  let qNumber = 0;

  for (const block of blocks) {
    const headerMatch = block.match(/^(?:Câu|Bài|Question)\s*(\d{1,3})[\.\:\)]\s*/i);
    if (!headerMatch) continue;
    qNumber = parseInt(headerMatch[1]);
    let body = block.slice(headerMatch[0].length).trim();

    // Tim cac phuong an A. B. C. D.
    const optionRegex = /\n?\s*([A-D])[\.\)]\s*(.+?)(?=\n\s*[A-D][\.\)]|$)/gs;
    const options = [];
    let om;
    while ((om = optionRegex.exec(body)) !== null) {
      options.push({ letter: om[1].toUpperCase(), text: restoreImages(om[2].trim().replace(/\n+/g, ' '), images) });
    }

    // Phan noi dung cau hoi la doan truoc phuong an dau tien
    const firstOptionIdx = body.search(/\n?\s*[A-D][\.\)]\s*/);
    const questionText = restoreImages((firstOptionIdx > -1 ? body.slice(0, firstOptionIdx) : body).trim().replace(/\n+/g, ' '), images);

    if (options.length >= 2) {
      const correctLetter = answerKey[qNumber] || null;
      const correctIndex = correctLetter ? options.findIndex(o => o.letter === correctLetter) : -1;
      questions.push({
        type: 'single_choice',
        question: questionText || `(Câu ${qNumber} — chưa nhận diện được nội dung, vui lòng sửa lại)`,
        points: 0.25,
        options: options.map(o => o.text),
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
        needsReview: correctIndex < 0 // khong tim thay dap an trong de -> can nguoi dung tu chon lai
      });
    } else {
      // Khong tim thay cau tra loi A/B/C/D -> co the la tu luan / dang khac, dua vao dang "tu luan" de nguoi dung tu phan loai lai
      questions.push({
        type: 'essay',
        question: questionText || restoreImages(body.trim().replace(/\n+/g, ' '), images) || `(Câu ${qNumber} — chưa nhận diện được nội dung)`,
        points: 1,
        needsReview: true
      });
    }
  }

  return questions;
}

module.exports = { parseExamText };
