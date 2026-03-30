// controllers/feedController.js  — NEW
const { Post, Comment, User, Friendship } = require('../models');
const { Op } = require('sequelize');
const path = require('path');

const mediaUrl = (f) => f ? `/uploads/${path.basename(f)}` : null;

// ── GET /feed ─────────────────────────────────────────────────
exports.getFeed = async (req, res) => {
  try {
    const me = req.user.id;

    // Get friend IDs
    const friendships = await Friendship.findAll({
      where: { status: 'accepted', [Op.or]: [{ requesterId: me }, { receiverId: me }] },
      attributes: ['requesterId', 'receiverId'],
    });
    const friendIds = friendships.map(f => f.requesterId === me ? f.receiverId : f.requesterId);

    const posts = await Post.findAll({
      where: { userId: [me, ...friendIds] },
      include: [
        { model: User,    as: 'Author',   attributes: ['id', 'username', 'displayName', 'avatar'] },
        { model: Comment, as: 'Comments', include: [
          { model: User, as: 'Author', attributes: ['id', 'username', 'displayName', 'avatar'] }
        ]},
      ],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    res.json(posts);
  } catch (err) {
    console.error('getFeed error:', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
};

// ── POST /feed ────────────────────────────────────────────────
exports.createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const file = req.file;

    const post = await Post.create({
      userId:   req.user.id,
      content:  content || '',
      mediaUrl: file ? mediaUrl(file.filename) : null,
      likes:    [],
    });

    const full = await Post.findByPk(post.id, {
      include: [
        { model: User,    as: 'Author',   attributes: ['id', 'username', 'displayName', 'avatar'] },
        { model: Comment, as: 'Comments', include: [{ model: User, as: 'Author', attributes: ['id', 'username', 'displayName', 'avatar'] }] },
      ],
    });

    res.status(201).json(full);
  } catch (err) {
    console.error('createPost error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
};

// ── POST /feed/:id/like ───────────────────────────────────────
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });

    const likes = Array.isArray(post.likes) ? post.likes : [];
    const idx   = likes.indexOf(req.user.id);
    const next  = idx > -1 ? likes.filter(id => id !== req.user.id) : [...likes, req.user.id];

    await post.update({ likes: next });
    res.json({ likes: next });
  } catch (err) {
    console.error('toggleLike error:', err);
    res.status(500).json({ error: 'Failed to like' });
  }
};

// ── POST /feed/:id/comment ────────────────────────────────────
exports.addComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Comment is empty' });

    const comment = await Comment.create({ postId: req.params.id, userId: req.user.id, content });
    const full    = await Comment.findByPk(comment.id, {
      include: [{ model: User, as: 'Author', attributes: ['id', 'username', 'displayName', 'avatar'] }],
    });
    res.status(201).json(full);
  } catch (err) {
    console.error('addComment error:', err);
    res.status(500).json({ error: 'Failed to comment' });
  }
};

// ── DELETE /feed/:id ──────────────────────────────────────────
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    await post.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
};
