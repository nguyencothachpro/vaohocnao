const BookQuiz=require('../models/BookQuiz');
const BookLearning=require('../models/BookLearning');
exports.manage=async(req,res)=>{const lesson=await BookLearning.getLesson(req.params.lessonId);if(!lesson)return res.status(404).render('404');let quiz=await BookQuiz.findByLesson(lesson.id);res.render('admin/books/quiz',{lesson,quiz});};
exports.create=async(req,res)=>{const lesson=await BookLearning.getLesson(req.body.lesson_id);if(!lesson)return res.status(404).render('404');const old=await BookQuiz.findByLesson(lesson.id);if(!old)await BookQuiz.create(lesson.id,req.body.title||'Bài tự luyện',req.body.pass_score||5);res.redirect('/admin/sach/bai-hoc/'+lesson.id+'/bai-tu-luyen');};
exports.delete=async(req,res)=>{await BookQuiz.delete(req.params.id);res.redirect('/admin/sach/bai-hoc/'+req.body.lesson_id+'/bai-tu-luyen');};
exports.addQuestion=async(req,res)=>{const options=[req.body.option_a,req.body.option_b,req.body.option_c,req.body.option_d].filter(Boolean);await BookQuiz.addQuestion(req.body.quiz_id,req.body.question,options,req.body.correct_index);res.redirect('/admin/sach/bai-hoc/'+req.body.lesson_id+'/bai-tu-luyen');};
