const express = require('express');
const router = express.Router();

// All routes here are assumed to be behind authMiddleware (mounted in index.js)
router.get('/me', (req, res) => {
  return res.json({ success: true, data: { user: req.user } });
});

module.exports = router;
