const Quiz = require('../models/Quiz');
const Lesson = require('../models/Lesson');
const Category = require('../models/Category');
const User = require('../models/User');

// Xac dinh trang "quay lai" phu hop: de gan bai hoc thi ve trang noi dung bai hoc do,
// de doc lap (Thuc chien phong thi) thi ve trang quan ly cau hoi cua chinh no
async function manageUrlForQuiz(quiz) {
  if (quiz && quiz.lesson_id) return `/admin/bai-hoc/${quiz.lesson_id}/bai-kiem-tra`;
  if (quiz) return `/admin/bai-kiem-tra/${quiz.id}/cau-hoi`;
  return '/admin';
}

// Trang quan ly bai kiem tra cua 1 bai hoc: tao bai KT (neu chua co) + them cau hoi
exports.manage = async (req, res) => {
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson) return res.redirect('/admin/khoa-hoc');
  let quiz = await Quiz.findByLesson(lesson.id);
  let questions = [];
  if (quiz) questions = await Quiz.fullQuestions(quiz.id);
  res.render('admin/quizzes/manage', { lesson, quiz, questions, totalPoints: Quiz.totalPoints(questions), backLink: null });
};

// Trang quan ly 1 de thi doc lap (Thuc chien phong thi), khong gan voi bai hoc nao
exports.manageStandalone = async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz || !quiz.is_standalone) return res.redirect('/admin/phong-thi');
  const questions = await Quiz.fullQuestions(quiz.id);
  res.render('admin/quizzes/manage', { lesson: null, quiz, questions, totalPoints: Quiz.totalPoints(questions), backLink: '/admin/phong-thi' });
};

exports.create = async (req, res) => {
  const { lesson_id, title, pass_score } = req.body;
  await Quiz.create({ lesson_id, title, pass_score });
  res.redirect(`/admin/bai-hoc/${lesson_id}/bai-kiem-tra`);
};

exports.delete = async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  await Quiz.delete(req.params.id);
  if (quiz && quiz.is_standalone) return res.redirect('/admin/phong-thi');
  res.redirect(`/admin/bai-hoc/${req.body.lesson_id}/bai-kiem-tra`);
};

// Them 1 cau hoi - dang cau hoi (type) quyet dinh xu ly du lieu nao
exports.addQuestion = async (req, res) => {
  const { quiz_id, question, type, points } = req.body;
  const p = parseFloat(points) || 0.25;

  if (type === 'single_choice') {
    const options = req.body.options || [];
    const correctIndex = parseInt(req.body.correct_index);
    await Quiz.addSingleChoiceQuestion({ quiz_id, question, points: p, options, correctIndex });

  } else if (type === 'true_false') {
    const contents = req.body.tf_content || [];
    const corrects = req.body.tf_correct || []; // gom cac index duoc tick la "Dung"
    const items = contents.map((content, i) => ({ content, is_correct: corrects.includes(String(i)) }));
    await Quiz.addTrueFalseQuestion({ quiz_id, question, points: p, items });

  } else if (type === 'short_answer') {
    await Quiz.addShortAnswerQuestion({ quiz_id, question, points: p, correct_answer: req.body.correct_answer });

  } else if (type === 'essay') {
    await Quiz.addEssayQuestion({ quiz_id, question, points: p });
  }

  const quiz = await Quiz.findById(quiz_id);
  res.redirect(await manageUrlForQuiz(quiz));
};

exports.deleteQuestion = async (req, res) => {
  const quiz = req.body.quiz_id ? await Quiz.findById(req.body.quiz_id) : null;
  await Quiz.deleteQuestion(req.params.id);
  if (quiz) return res.redirect(await manageUrlForQuiz(quiz));
  res.redirect(`/admin/bai-hoc/${req.body.lesson_id}/bai-kiem-tra`);
};

// Bang diem: xem toan bo luot lam bai cua hoc vien + danh sach cau tu luan can cham tay
exports.results = async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) return res.redirect('/admin/khoa-hoc');
  const attempts = await Quiz.attemptsByQuiz(quiz.id);
  const pending = await Quiz.pendingManualGrading(quiz.id);
  const questionStats = await Quiz.questionStats(quiz.id);
  res.render('admin/quizzes/results', { quiz, attempts, pending, questionStats });
};

// Cham diem 1 cau tu luan/tra loi ngan can cham tay
exports.gradeManual = async (req, res) => {
  const { answer_id, points, quiz_id } = req.body;
  await Quiz.gradeManualAnswer(answer_id, parseFloat(points) || 0, req.session.adminUser.id);
  res.redirect(`/admin/bai-kiem-tra/${quiz_id}/ket-qua`);
};

// ---- "Thuc chien phong thi": thu vien de thi doc lap, khong gan voi khoa hoc/bai hoc nao ----
exports.examRoomList = async (req, res) => {
  const exams = await Quiz.standaloneAll();
  res.render('admin/quizzes/exam-room-list', { exams });
};

exports.examRoomNewForm = async (req, res) => {
  const categories = await Category.tree();
  res.render('admin/quizzes/exam-room-form', { categories });
};

exports.examRoomCreate = async (req, res) => {
  const { title, pass_score, category_id, time_limit_minutes, shuffle_questions, shuffle_answers, visibility } = req.body;
  const quiz = await Quiz.create({
    title, pass_score, category_id, is_standalone: true,
    time_limit_minutes: time_limit_minutes || null,
    shuffle_questions: shuffle_questions === 'on', shuffle_answers: shuffle_answers === 'on',
    visibility: visibility || 'public'
  });
  if (visibility === 'assigned') return res.redirect(`/admin/bai-kiem-tra/${quiz.id}/giao-de`);
  res.redirect(`/admin/bai-kiem-tra/${quiz.id}/cau-hoi`);
};

// ---- Giao de rieng cho hoc vien cu the kem han nop ----
exports.assignForm = async (req, res) => {
  const quiz = await Quiz.findById(req.params.quizId);
  if (!quiz) return res.redirect('/admin/phong-thi');
  const students = await User.listStudents();
  const assignedUsers = await Quiz.assignedUsers(quiz.id);
  const assignedIds = assignedUsers.map(a => a.user_id);
  res.render('admin/quizzes/assign', { quiz, students, assignedUsers, assignedIds });
};

exports.assignSubmit = async (req, res) => {
  const quizId = req.params.quizId;
  const userIds = req.body.user_ids ? [].concat(req.body.user_ids) : [];
  await Quiz.assignTo(quizId, userIds, req.body.due_at || null);
  res.redirect(`/admin/bai-kiem-tra/${quizId}/giao-de`);
};

exports.unassign = async (req, res) => {
  await Quiz.unassign(req.params.quizId, req.params.userId);
  res.redirect(`/admin/bai-kiem-tra/${req.params.quizId}/giao-de`);
};
