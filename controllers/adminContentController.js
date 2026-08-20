const Chapter = require('../models/Chapter');
const Lesson = require('../models/Lesson');
const LessonVideo = require('../models/LessonVideo');
const LessonFile = require('../models/LessonFile');

function parentRedirect(req, parentType, parentId) {
  return parentType === 'book' ? `/admin/sach/${parentId}/noi-dung` : `/admin/khoa-hoc/${parentId}/noi-dung`;
}
function parentFromBody(req){ return { parentType:req.body.parent_type==='book'?'book':'course', parentId:req.body.parent_id || req.body.course_id || req.body.book_id }; }
function youtubeId(input){ const m=(input||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/); return m?m[1]:(input||'').trim(); }
function vimeoId(input){ const m=(input||'').match(/vimeo\.com\/(\d+)/); return m?m[1]:(input||'').trim(); }

exports.createChapter = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); await Chapter.create({course_id:parentType==='course'?parentId:null,book_id:parentType==='book'?parentId:null,title:req.body.title}); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.updateChapter = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); await Chapter.update(req.params.id,{title:req.body.title}); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.deleteChapter = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); await Chapter.delete(req.params.id); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.reorderChapters = async (req,res)=>{ await Chapter.reorder(req.body.ids||[]); res.json({ok:true}); };
exports.createLesson = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); await Lesson.create({chapter_id:req.body.chapter_id,title:req.body.title,content:req.body.content,is_preview:req.body.is_preview==='on'}); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.updateLesson = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); await Lesson.update(req.params.id,{title:req.body.title,content:req.body.content,is_preview:req.body.is_preview==='on'}); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.deleteLesson = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); await Lesson.delete(req.params.id); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.reorderLessons = async (req,res)=>{ await Lesson.reorder(req.body.ids||[]); res.json({ok:true}); };
exports.createVideo = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); let value=(req.body.source_value||'').trim(); if(req.body.source_type==='youtube') value=youtubeId(value); if(req.body.source_type==='vimeo') value=vimeoId(value); if(req.body.source_type==='upload' && req.file) value='/uploads/videos/'+req.file.filename; if(!value) return res.redirect(parentRedirect(req,parentType,parentId)); await LessonVideo.create({lesson_id:req.body.lesson_id,title:req.body.title,source_type:req.body.source_type,source_value:value,duration_seconds:req.body.duration_seconds,is_free:req.body.is_free==='on'}); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.updateVideo = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); let value=(req.body.source_value||'').trim(); if(req.body.source_type==='youtube') value=youtubeId(value); if(req.body.source_type==='vimeo') value=vimeoId(value); await LessonVideo.update(req.params.id,{title:req.body.title,source_type:req.body.source_type,source_value:value,duration_seconds:req.body.duration_seconds,is_free:req.body.is_free==='on'}); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.deleteVideo = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); await LessonVideo.delete(req.params.id); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.reorderVideos = async (req,res)=>{ await LessonVideo.reorder(req.body.ids||[]); res.json({ok:true}); };
exports.createFile = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); let file_url=null,file_source='link'; if(req.file){file_url='/uploads/files/'+req.file.filename;file_source='upload';} else file_url=(req.body.file_url||'').trim(); if(!file_url) return res.redirect(parentRedirect(req,parentType,parentId)); const ext=(req.file?.originalname || file_url).split('.').pop().toLowerCase().split('?')[0]; await LessonFile.create({lesson_id:req.body.lesson_id,title:req.body.title,file_url,file_type:ext,file_source,is_free:req.body.is_free==='on'}); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.updateFile = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); let file_url=(req.body.file_url||'').trim(); let source='link'; if(req.file){file_url='/uploads/files/'+req.file.filename;source='upload';} await LessonFile.update(req.params.id,{title:req.body.title,file_url,file_type:(file_url.split('.').pop()||'pdf').toLowerCase().split('?')[0],file_source:source,is_free:req.body.is_free==='on'}); res.redirect(parentRedirect(req,parentType,parentId)); };
exports.deleteFile = async (req,res)=>{ const {parentType,parentId}=parentFromBody(req); await LessonFile.delete(req.params.id); res.redirect(parentRedirect(req,parentType,parentId)); };
