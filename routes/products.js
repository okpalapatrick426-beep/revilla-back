const express = require('express');
const r = express.Router();
const { auth } = require('../middleware/auth');
const { Product, User } = require('../models');
const { Op } = require('sequelize');

r.get('/', auth, async (req, res) => {
  const { search, category, page = 1, limit = 20 } = req.query;
  const where = { isAvailable: true };
  if (search) where.title = { [Op.like]: `%${search}%` };
  if (category) where.category = category;
  const { rows, count } = await Product.findAndCountAll({
    where, limit: parseInt(limit), offset: (page - 1) * parseInt(limit),
    include: [{ model: User, as: 'seller', attributes: ['id', 'username', 'displayName', 'avatar'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json({ products: rows, total: count });
});

r.post('/', auth, async (req, res) => {
  const { title, description, price, category, images, tags } = req.body;
  const product = await Product.create({ sellerId: req.user.id, title, description, price, category, images, tags });
  res.status(201).json(product);
});

r.put('/:id', auth, async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product || product.sellerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  await product.update(req.body);
  res.json(product);
});

r.delete('/:id', auth, async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product || (product.sellerId !== req.user.id && req.user.role === 'user')) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  await product.destroy();
  res.json({ success: true });
});

module.exports = r;
