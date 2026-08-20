const db = require('../config/db');

const Quiz = {
  async findByLesson(lesson_id) {
    const r = await db.query('SELECT * FROM quizzes WHERE lesson_id=$1 LIMIT 1', [lesson_id]);
    return r.rows[0];
  },
  async findById(id) {
    const r = await db.query(`
      SELECT q.*, l.title AS lesson_title, ch.course_id, cat.name AS category_name
      FROM quizzes q
      LEFT JOIN lessons l ON l.id=q.lesson_id
      LEFT JOIN chapters ch ON ch.id=l.chapter_id
      LEFT JOIN categories cat ON cat.id = q.category_id
      WHERE q.id=$1`, [id]);
    return r.rows[0];
  },
  async create({ lesson_id, title, pass_score, category_id, is_standalone, time_limit_minutes, shuffle_questions, shuffle_answers, visibility }) {
    const r = await db.query(
      `INSERT INTO quizzes (lesson_id, title, pass_score, category_id, is_standalone, time_limit_minutes, shuffle_questions, shuffle_answers, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [lesson_id || null, title, pass_score || 5, category_id || null, is_standalone ? 1 : 0,
       time_limit_minutes || null, shuffle_questions ? 1 : 0, shuffle_answers ? 1 : 0, visibility || 'public']
    );
    return r.rows[0];
  },
  async updateSettings(id, { title, pass_score, category_id, time_limit_minutes, shuffle_questions, shuffle_answers, visibility }) {
    await db.query(
      `UPDATE quizzes SET title=$1, pass_score=$2, category_id=$3, time_limit_minutes=$4,
       shuffle_questions=$5, shuffle_answers=$6, visibility=$7 WHERE id=$8`,
      [title, pass_score || 5, category_id || null, time_limit_minutes || null,
       shuffle_questions ? 1 : 0, shuffle_answers ? 1 : 0, visibility || 'public', id]
    );
  },
  // Danh sach de thi doc lap (Thuc chien phong thi), khong gan voi bai hoc nao
  async standaloneAll() {
    const r = await db.query(`
      SELECT q.*, cat.name AS category_name,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=q.id) AS question_count
      FROM quizzes q LEFT JOIN categories cat ON cat.id = q.category_id
      WHERE q.is_standalone=1 ORDER BY q.created_at DESC`);
    return r.rows;
  },
  async standalonePublished(category_id) {
    const params = [];
    let where = 'q.is_standalone=1';
    if (category_id) { params.push(category_id); where += ` AND q.category_id=$${params.length}`; }
    const r = await db.query(`
      SELECT q.*, cat.name AS category_name,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id=q.id) AS question_count
      FROM quizzes q LEFT JOIN categories cat ON cat.id = q.category_id
      WHERE ${where} ORDER BY q.created_at DESC`, params);
    return r.rows;
  },
  // Tron thu tu cau hoi/dap an neu bai kiem tra bat tinh nang nay (chong quay cop giua cac hoc vien)
  shuffleForAttempt(questions, quiz) {
    const shuffleArr = arr => arr.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
    let qs = questions;
    if (quiz.shuffle_questions) qs = shuffleArr(qs);
    if (quiz.shuffle_answers) {
      qs = qs.map(q => {
        if (q.type === 'single_choice' && q.options) return { ...q, options: shuffleArr(q.options) };
        return q;
      });
    }
    return qs;
  },

  // ---- Dem gio lam bai: ghi lai thoi diem bat dau de tinh dem nguoc chinh xac ----
  async getOrCreateStart(quiz_id, user_id) {
    const existing = await db.query('SELECT * FROM quiz_starts WHERE quiz_id=$1 AND user_id=$2', [quiz_id, user_id]);
    if (existing.rows[0]) return existing.rows[0];
    const r = await db.query('INSERT INTO quiz_starts (quiz_id, user_id) VALUES ($1,$2) RETURNING *', [quiz_id, user_id]);
    return r.rows[0];
  },
  async clearStart(quiz_id, user_id) {
    await db.query('DELETE FROM quiz_starts WHERE quiz_id=$1 AND user_id=$2', [quiz_id, user_id]);
  },

  // ---- Bang xep hang theo tung de thi (diem cao nhat cua moi hoc vien, uu tien lam nhanh hon khi bang diem) ----
  async leaderboard(quiz_id, limit = 50) {
    const r = await db.query(`
      SELECT DISTINCT ON (qa.user_id) qa.*, u.name AS user_name, u.avatar_url
      FROM quiz_attempts qa JOIN users u ON u.id = qa.user_id
      WHERE qa.quiz_id=$1
      ORDER BY qa.user_id, qa.score DESC, qa.duration_seconds ASC NULLS LAST, qa.attempted_at ASC`, [quiz_id]);
    const ranked = r.rows.sort((a, b) => b.score - a.score || (a.duration_seconds || 999999) - (b.duration_seconds || 999999));
    return ranked.slice(0, limit);
  },

  // ---- Thong ke ty le dung/sai tung cau, giup giao vien biet cau nao hoc vien hay sai ----
  async questionStats(quiz_id) {
    const questions = await this.fullQuestions(quiz_id);
    const stats = [];
    for (const q of questions) {
      let correctCount = 0, totalCount = 0;
      if (q.type === 'single_choice') {
        const r = await db.query(`
          SELECT aa.answer_text FROM quiz_attempt_answers aa WHERE aa.question_id=$1`, [q.id]);
        totalCount = r.rows.length;
        const correctOpt = q.options.find(o => o.is_correct);
        correctCount = r.rows.filter(row => {
          let parsed; try { parsed = JSON.parse(row.answer_text); } catch (e) { parsed = row.answer_text; }
          return String(parsed) === String(correctOpt && correctOpt.id);
        }).length;
      } else {
        const r = await db.query(`SELECT awarded_points FROM quiz_attempt_answers WHERE question_id=$1 AND needs_manual_grading=0`, [q.id]);
        totalCount = r.rows.length;
        correctCount = r.rows.filter(row => Number(row.awarded_points) >= Number(q.points)).length;
      }
      stats.push({
        question: q.question, type: q.type, totalCount, correctCount,
        correctPercent: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : null
      });
    }
    return stats;
  },

  // ---- Giao de rieng cho hoc vien cu the kem han nop ----
  async assignTo(quiz_id, userIds, due_at) {
    for (const uid of userIds) {
      await db.query(
        `INSERT INTO quiz_assignments (quiz_id, user_id, due_at) VALUES ($1,$2,$3)
         ON CONFLICT (quiz_id, user_id) DO UPDATE SET due_at=$3`,
        [quiz_id, uid, due_at || null]
      );
    }
  },
  async unassign(quiz_id, user_id) {
    await db.query('DELETE FROM quiz_assignments WHERE quiz_id=$1 AND user_id=$2', [quiz_id, user_id]);
  },
  async assignedUsers(quiz_id) {
    const r = await db.query(`
      SELECT qas.*, u.name, u.email FROM quiz_assignments qas
      JOIN users u ON u.id = qas.user_id WHERE qas.quiz_id=$1 ORDER BY u.name`, [quiz_id]);
    return r.rows;
  },
  async isAssignedTo(quiz_id, user_id) {
    const r = await db.query('SELECT * FROM quiz_assignments WHERE quiz_id=$1 AND user_id=$2', [quiz_id, user_id]);
    return r.rows[0] || null;
  },
  async myAssignments(user_id) {
    const r = await db.query(`
      SELECT qas.*, q.title, q.pass_score,
        (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id=q.id AND user_id=$1) AS attempt_count
      FROM quiz_assignments qas JOIN quizzes q ON q.id = qas.quiz_id
      WHERE qas.user_id=$1 ORDER BY qas.due_at NULLS LAST, qas.assigned_at DESC`, [user_id]);
    return r.rows;
  },

  // Lay toan bo cau hoi (kem dap an/y dung-sai) cua 1 bai kiem tra
  async fullQuestions(quiz_id) {
    const questions = (await db.query('SELECT * FROM quiz_questions WHERE quiz_id=$1 ORDER BY position, id', [quiz_id])).rows;
    for (const q of questions) {
      if (q.type === 'true_false') {
        q.tfItems = (await db.query('SELECT * FROM quiz_tf_items WHERE question_id=$1 ORDER BY position, id', [q.id])).rows;
      } else if (q.type === 'single_choice') {
        q.options = (await db.query('SELECT * FROM quiz_options WHERE question_id=$1 ORDER BY id', [q.id])).rows;
      }
    }
    return questions;
  },

  // Tong diem toi da cua ca bai (dung de hien "X/Y diem")
  totalPoints(questions) {
    return questions.reduce((sum, q) => sum + Number(q.points), 0);
  },

  // ---- Them cau hoi theo tung dang ----
  async addSingleChoiceQuestion({ quiz_id, question, points, options, correctIndex, position }) {
    const q = await db.query(
      `INSERT INTO quiz_questions (quiz_id, question, type, points, position) VALUES ($1,$2,'single_choice',$3,$4) RETURNING *`,
      [quiz_id, question, points || 0.25, position || 0]
    );
    for (let i = 0; i < options.length; i++) {
      if (!options[i] || !options[i].trim()) continue;
      await db.query(
        `INSERT INTO quiz_options (question_id, option_text, is_correct) VALUES ($1,$2,$3)`,
        [q.rows[0].id, options[i], i === correctIndex ? 1 : 0]
      );
    }
    return q.rows[0];
  },
  async addTrueFalseQuestion({ quiz_id, question, points, items, position }) {
    // items: [{ content, is_correct }, ...] toi da 4 y (a,b,c,d)
    const q = await db.query(
      `INSERT INTO quiz_questions (quiz_id, question, type, points, position) VALUES ($1,$2,'true_false',$3,$4) RETURNING *`,
      [quiz_id, question, points || 1, position || 0]
    );
    for (const item of items) {
      if (!item.content || !item.content.trim()) continue;
      await db.query(
        `INSERT INTO quiz_tf_items (question_id, content, is_correct) VALUES ($1,$2,$3)`,
        [q.rows[0].id, item.content, item.is_correct ? 1 : 0]
      );
    }
    return q.rows[0];
  },
  async addShortAnswerQuestion({ quiz_id, question, points, correct_answer, position }) {
    const r = await db.query(
      `INSERT INTO quiz_questions (quiz_id, question, type, points, correct_answer, position) VALUES ($1,$2,'short_answer',$3,$4,$5) RETURNING *`,
      [quiz_id, question, points || 0.25, correct_answer, position || 0]
    );
    return r.rows[0];
  },
  async addEssayQuestion({ quiz_id, question, points, position }) {
    const r = await db.query(
      `INSERT INTO quiz_questions (quiz_id, question, type, points, position) VALUES ($1,$2,'essay',$3,$4) RETURNING *`,
      [quiz_id, question, points || 2, position || 0]
    );
    return r.rows[0];
  },
  async deleteQuestion(id) {
    await db.query('DELETE FROM quiz_questions WHERE id=$1', [id]);
  },

  // ---- Cham diem tu dong theo dung quy dinh cua Bo GD-DT (Quyet dinh 764/QD-BGDDT) ----
  // answers dang: { [questionId]: value }
  //   - single_choice: value la option_id da chon
  //   - true_false: value la object { [tfItemId]: 'true'|'false' }
  //   - short_answer: value la chuoi hoc vien go vao
  //   - essay: value la chuoi bai lam (khong tu cham, can giao vien cham tay)
  async grade(quiz_id, answers) {
    const questions = await this.fullQuestions(quiz_id);
    let score = 0;
    let needsManualGrading = false;
    const details = [];

    for (const q of questions) {
      const val = answers[q.id];
      let earned = 0;
      let detail = { questionId: q.id, question: q.question, type: q.type, maxPoints: Number(q.points) };

      if (q.type === 'single_choice') {
        const correctOption = q.options.find(o => o.is_correct);
        const isCorrect = val && correctOption && String(val) === String(correctOption.id);
        earned = isCorrect ? Number(q.points) : 0;
        detail.isCorrect = isCorrect;
        detail.chosenOptionId = val || null;
        detail.correctOptionId = correctOption ? correctOption.id : null;

      } else if (q.type === 'true_false') {
        const chosen = val || {};
        let correctCount = 0;
        const itemResults = q.tfItems.map(item => {
          const chosenVal = chosen[item.id]; // 'true' hoac 'false'
          const expected = item.is_correct ? 'true' : 'false';
          const ok = chosenVal === expected;
          if (ok) correctCount++;
          return { content: item.content, chosen: chosenVal || null, correct: item.is_correct ? true : false, isMatched: ok };
        });
        // Thang diem chinh thuc: 1 y = 0.1 diem tren thang 4 y = 1 diem toi da (ti le theo diem cau hoi)
        const tierRatio = correctCount === 4 ? 1 : correctCount === 3 ? 0.5 : correctCount === 2 ? 0.25 : correctCount === 1 ? 0.1 : 0;
        earned = Number(q.points) * tierRatio;
        detail.correctCount = correctCount;
        detail.items = itemResults;

      } else if (q.type === 'short_answer') {
        const normalize = s => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
        const isCorrect = normalize(val) !== '' && normalize(val) === normalize(q.correct_answer);
        earned = isCorrect ? Number(q.points) : 0;
        detail.isCorrect = isCorrect;
        detail.yourAnswer = val || '';
        detail.correctAnswer = q.correct_answer;

      } else if (q.type === 'essay') {
        earned = 0; // cham tay sau
        needsManualGrading = true;
        detail.needsManualGrading = true;
        detail.yourAnswer = val || '';
      }

      score += earned;
      detail.earned = earned;
      details.push(detail);
    }

    const total = this.totalPoints(questions);
    const quizR = await db.query('SELECT * FROM quizzes WHERE id=$1', [quiz_id]);
    const passScore = Number(quizR.rows[0].pass_score);
    const passed = !needsManualGrading && score >= passScore; // neu con cau cho cham tay thi chua the ket luan dat/rot

    return { score, total, passed, details, passScore, needsManualGrading };
  },

  async recordAttempt({ quiz_id, user_id, score, total, passed, duration_seconds }) {
    const r = await db.query(
      `INSERT INTO quiz_attempts (quiz_id, user_id, score, total, passed, duration_seconds) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [quiz_id, user_id, score, total, passed ? 1 : 0, duration_seconds || null]
    );
    return r.rows[0];
  },

  // Luu tung cau tra loi (dung cho viec cham tay cau tu luan sau nay)
  async saveAttemptAnswer({ attempt_id, question_id, answer_text, awarded_points, needs_manual_grading }) {
    await db.query(
      `INSERT INTO quiz_attempt_answers (attempt_id, question_id, answer_text, awarded_points, needs_manual_grading)
       VALUES ($1,$2,$3,$4,$5)`,
      [attempt_id, question_id, answer_text, awarded_points || 0, needs_manual_grading ? 1 : 0]
    );
  },

  async attemptsByQuiz(quiz_id) {
    const r = await db.query(`
      SELECT qa.*, u.name AS user_name, u.email FROM quiz_attempts qa
      JOIN users u ON u.id = qa.user_id
      WHERE qa.quiz_id=$1 ORDER BY qa.attempted_at DESC`, [quiz_id]);
    return r.rows;
  },
  async attemptsByUser(user_id, limit = 20) {
    const r = await db.query(`
      SELECT qa.*, qz.title AS quiz_title, l.title AS lesson_title
      FROM quiz_attempts qa
      JOIN quizzes qz ON qz.id = qa.quiz_id
      JOIN lessons l ON l.id = qz.lesson_id
      WHERE qa.user_id=$1 ORDER BY qa.attempted_at DESC LIMIT $2`, [user_id, limit]);
    return r.rows;
  },
  async bestAttempt(quiz_id, user_id) {
    const r = await db.query(`
      SELECT * FROM quiz_attempts WHERE quiz_id=$1 AND user_id=$2 ORDER BY score DESC LIMIT 1`, [quiz_id, user_id]);
    return r.rows[0];
  },

  // ---- Cham tay cac cau tu luan (Ngu Van...) ----
  async pendingManualGrading(quiz_id) {
    const r = await db.query(`
      SELECT aa.*, qa.user_id, u.name AS user_name, qq.question, qq.points AS max_points
      FROM quiz_attempt_answers aa
      JOIN quiz_attempts qa ON qa.id = aa.attempt_id
      JOIN quiz_questions qq ON qq.id = aa.question_id
      JOIN users u ON u.id = qa.user_id
      WHERE qq.quiz_id=$1 AND aa.needs_manual_grading=1 AND aa.graded_at IS NULL
      ORDER BY qa.attempted_at`, [quiz_id]);
    return r.rows;
  },
  async gradeManualAnswer(answerId, points, graderId) {
    const ansR = await db.query('SELECT * FROM quiz_attempt_answers WHERE id=$1', [answerId]);
    const ans = ansR.rows[0];
    if (!ans) return;
    await db.query(
      `UPDATE quiz_attempt_answers SET awarded_points=$1, needs_manual_grading=0, graded_by=$2, graded_at=now() WHERE id=$3`,
      [points, graderId, answerId]
    );
    // Cong diem vua cham vao tong diem cua luot lam bai, va kiem tra lai da du dieu kien dat chua
    const attemptR = await db.query('SELECT * FROM quiz_attempts WHERE id=$1', [ans.attempt_id]);
    const attempt = attemptR.rows[0];
    const newScore = Number(attempt.score) + Number(points);
    const stillPending = (await db.query(
      `SELECT COUNT(*) c FROM quiz_attempt_answers WHERE attempt_id=$1 AND needs_manual_grading=1`, [attempt.id]
    )).rows[0].c;
    const quizR = await db.query('SELECT * FROM quizzes WHERE id=$1', [attempt.quiz_id]);
    const passed = parseInt(stillPending) === 0 && newScore >= Number(quizR.rows[0].pass_score);
    await db.query('UPDATE quiz_attempts SET score=$1, passed=$2 WHERE id=$3', [newScore, passed ? 1 : 0, attempt.id]);
  }
};
module.exports = Quiz;
