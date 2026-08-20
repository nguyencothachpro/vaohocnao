const fs = require('fs');
const Quiz = require('../models/Quiz');
const Settings = require('../models/Settings');
const { extractText, downloadFromDriveLink } = require('../services/examImport/extractText');
const { parseExamText } = require('../services/examImport/regexParser');
const { parseWithAI } = require('../services/ai/examAiParser');

// Dung chung cho ca 2 truong hop: de gan voi 1 bai hoc (co lesson) hoac de doc lap trong Thuc chien phong thi
exports.uploadForm = async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) return res.redirect('/admin');
  const config = await Settings.getAll();
  res.render('admin/quizzes/import-upload', { quiz, aiConfigured: !!(config.ai_api_key && config.ai_api_key.trim()), error: null });
};

exports.upload = async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) return res.redirect('/admin');
  const config = await Settings.getAll();

  let filePath = null;
  try {
    if (req.file) {
      filePath = req.file.path;
    } else if (req.body.drive_link && req.body.drive_link.trim()) {
      const uploadDir = require('path').join(__dirname, '..', 'public', 'uploads', 'exam-imports');
      filePath = await downloadFromDriveLink(req.body.drive_link.trim(), uploadDir);
    } else {
      return res.render('admin/quizzes/import-upload', {
        quiz, aiConfigured: !!(config.ai_api_key || '').trim(),
        error: 'Vui lòng chọn file Word (.docx)/PDF hoặc dán link Google Drive.'
      });
    }

    const { text: rawText, images } = await extractText(filePath);
    fs.unlink(filePath, () => {}); // xoa file tam ngay sau khi doc xong, khong luu lai

    if (!rawText || rawText.trim().length < 20) {
      return res.render('admin/quizzes/import-upload', {
        quiz, aiConfigured: !!(config.ai_api_key || '').trim(),
        error: 'Không đọc được nội dung chữ nào từ file này. Có thể đây là file scan dạng ảnh, hoặc file bị lỗi.'
      });
    }

    let questions = [];
    let usedAI = false;
    let aiError = null;
    const wantAI = req.body.use_ai === 'on' && (config.ai_api_key || '').trim();

    if (wantAI) {
      try {
        questions = await parseWithAI(rawText, config, images);
        usedAI = true;
      } catch (err) {
        console.error('Loi AI parse de thi:', err.message);
        aiError = err.message;
        questions = parseExamText(rawText, images);
      }
    } else {
      questions = parseExamText(rawText, images);
    }

    res.render('admin/quizzes/import-review', { quiz, questions, usedAI, aiError });
  } catch (err) {
    console.error('Loi doc file de thi:', err);
    if (filePath) fs.unlink(filePath, () => {});
    res.render('admin/quizzes/import-upload', {
      quiz, aiConfigured: !!(config.ai_api_key || '').trim(),
      error: 'Không đọc được file: ' + err.message
    });
  }
};

// Luu cac cau hoi da duoc xem/sua tren man hinh review vao database
exports.save = async (req, res) => {
  const { quiz_id, redirect_to } = req.body;
  const rows = req.body.questions ? Object.values(req.body.questions) : [];

  for (const row of rows) {
    if (row.include !== 'on') continue;
    const points = parseFloat(row.points) || 0.25;
    const question = (row.question || '').trim();
    if (!question) continue;

    if (row.type === 'single_choice') {
      const options = row.options || [];
      const correctIndex = parseInt(row.correct_index);
      await Quiz.addSingleChoiceQuestion({ quiz_id, question, points, options, correctIndex: isNaN(correctIndex) ? 0 : correctIndex });

    } else if (row.type === 'true_false') {
      const contents = row.tf_content || [];
      const corrects = row.tf_correct || [];
      const items = contents.map((content, i) => ({ content, is_correct: corrects.includes(String(i)) }));
      await Quiz.addTrueFalseQuestion({ quiz_id, question, points, items });

    } else if (row.type === 'short_answer') {
      await Quiz.addShortAnswerQuestion({ quiz_id, question, points, correct_answer: row.correct_answer || '' });

    } else if (row.type === 'essay') {
      await Quiz.addEssayQuestion({ quiz_id, question, points });
    }
  }

  res.redirect(redirect_to || `/admin/bai-kiem-tra/${quiz_id}/cau-hoi`);
};
