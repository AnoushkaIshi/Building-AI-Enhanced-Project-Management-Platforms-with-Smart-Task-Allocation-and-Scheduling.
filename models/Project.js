const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['active', 'pending', 'completed'], default: 'active' },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  deadline: Date,
  priority: { type: String, enum: ['high', 'medium', 'low'] },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', projectSchema);