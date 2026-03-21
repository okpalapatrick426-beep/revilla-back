// routes/products.js
const express = require('express');
const r = express.Router();
const { auth } = require('../middleware/auth');
const { User } = require('../models');
const { Op } = require('sequelize');

// Safely load Product model — server won't crash if not defined yet
let Product;
try { Product = require('../models').Product; } catch (e) { Product = null; }

const requireProduct = (req, res, next) => {
  if (!Product) return res.status(503).json({ error: 'Marketplace not available yet' });
  next();
};

// List products
r.get('/', auth, requireProduct, async (req, res) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;
    const where = { isAvailable: true };
    if (search) where.title = { [Op.like]: `%${search}%` };
    if (category) where.category = category;
    const { rows, count } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (page - 1) * parseInt(limit),
      include: [{ model: User, as: 'seller', attributes: ['id', 'username', 'displayName', 'avatar'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ products: rows, total: count });
  } catch (err) {
    console.error('GET /products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create product listing
r.post('/', auth, requireProduct, async (req, res) => {
  try {
    const { title, description, price, category, images, tags } = req.body;
    if (!title || !price) return res.status(400).json({ error: 'Title and price required' });
    const product = await Product.create({
      sellerId: req.user.id, title, description, price, category, images, tags,
    });
    res.status(201).json(product);
  } catch (err) {
    console.error('POST /products error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
r.put('/:id', auth, requireProduct, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.sellerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    await product.update(req.body);
    res.json(product);
  } catch (err) {
    console.error('PUT /products error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
r.delete('/:id', auth, requireProduct, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.sellerId !== req.user.id && req.user.role === 'user') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await product.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /products error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = r;
