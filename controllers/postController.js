const db = require('../config/db');
const { embedVideoInfo } = require('../utils');

exports.feed = async (req, res) => {
  const posts = (await db.query(`
    SELECT p.*, u.name AS user_name, u.avatar_url,
      (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id) AS like_count,
      (SELECT COUNT(*) FROM post_likes WHERE post_id=p.id AND user_id=$1) AS liked_by_me
    FROM posts p JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC LIMIT 50`, [req.session.user.id])).rows;

  for (const p of posts) {
    p.embed = embedVideoInfo(p.video_url);
    p.comments = (await db.query(`
      SELECT c.*, u.name AS user_name, u.avatar_url FROM post_comments c
      JOIN users u ON u.id = c.user_id WHERE c.post_id=$1 ORDER BY c.created_at`, [p.id])).rows;
  }

  res.render('community', { posts });
};

exports.create = async (req, res) => {
  const { content, image_url, video_url, video_orientation } = req.body;
  if (!content && !image_url && !video_url) return res.redirect('/cong-dong');
  await db.query(
    `INSERT INTO posts (user_id, content, image_url, video_url, video_orientation) VALUES ($1,$2,$3,$4,$5)`,
    [req.session.user.id, content || '', image_url || null, video_url || null, video_orientation || 'ngang']
  );
  res.redirect('/cong-dong');
};

exports.deletePost = async (req, res) => {
  // Chi chu bai viet hoac admin/giao vien moi xoa duoc
  const post = (await db.query('SELECT * FROM posts WHERE id=$1', [req.params.id])).rows[0];
  if (post && (post.user_id === req.session.user.id)) {
    await db.query('DELETE FROM posts WHERE id=$1', [req.params.id]);
  }
  res.redirect('/cong-dong');
};

exports.toggleLike = async (req, res) => {
  const existing = await db.query('SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.session.user.id]);
  if (existing.rows.length > 0) {
    await db.query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [req.params.id, req.session.user.id]);
  } else {
    await db.query('INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2)', [req.params.id, req.session.user.id]);
  }
  res.redirect('/cong-dong');
};

exports.addComment = async (req, res) => {
  if (req.body.content && req.body.content.trim()) {
    await db.query('INSERT INTO post_comments (post_id, user_id, content) VALUES ($1,$2,$3)',
      [req.params.id, req.session.user.id, req.body.content.trim()]);
  }
  res.redirect('/cong-dong');
};
