const db=require('../config/db');
const BookQuiz={
 async findByLesson(lessonId){const q=(await db.query('SELECT * FROM book_quizzes WHERE lesson_id=$1 LIMIT 1',[lessonId])).rows[0];if(!q)return null;q.questions=(await db.query('SELECT * FROM book_quiz_questions WHERE quiz_id=$1 ORDER BY position,id',[q.id])).rows;for(const x of q.questions)x.options=(await db.query('SELECT * FROM book_quiz_options WHERE question_id=$1 ORDER BY id',[x.id])).rows;return q;},
 async create(lessonId,title,passScore){return(await db.query('INSERT INTO book_quizzes(lesson_id,title,pass_score) VALUES($1,$2,$3) RETURNING *',[lessonId,title,passScore||5])).rows[0]},
 async delete(id){await db.query('DELETE FROM book_quizzes WHERE id=$1',[id])},
 async addQuestion(quizId,question,options,correctIndex){const p=await db.query('SELECT COALESCE(MAX(position),0)+1 p FROM book_quiz_questions WHERE quiz_id=$1',[quizId]);const q=(await db.query('INSERT INTO book_quiz_questions(quiz_id,question,position) VALUES($1,$2,$3) RETURNING *',[quizId,question,p.rows[0].p])).rows[0];for(let i=0;i<options.length;i++)await db.query('INSERT INTO book_quiz_options(question_id,option_text,is_correct) VALUES($1,$2,$3)',[q.id,options[i],i===Number(correctIndex)?1:0]);return q;}
};module.exports=BookQuiz;
