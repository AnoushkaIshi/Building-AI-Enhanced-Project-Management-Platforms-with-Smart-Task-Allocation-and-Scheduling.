require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-projectflow', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.connection.on('connected', () => console.log('Connected to MongoDB'));

// Email transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// Models
const User = require('./models/User');
const Project = require('./models/Project');
const Task = require('./models/Task');

// JWT middleware
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).send('Access denied');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).send('Invalid token');
  }
};

// Routes
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Check if user exists
    if (await User.findOne({ email })) {
      return res.status(400).send('Email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      skills: role === 'admin' ? ['leadership', 'strategy'] : 
             role === 'manager' ? ['project-management', 'coordination'] : 
             ['development', 'implementation'],
      avatar: name.split(' ').map(n => n[0]).join('').toUpperCase()
    });

    await user.save();

    // Generate token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    // Send welcome email
  const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "your-mailtrap-user",
    pass: "your-mailtrap-pass"
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).send('Invalid credentials');
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.send({ user, token });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Projects CRUD
app.post('/api/projects', authenticate, async (req, res) => {
  try {
    const project = new Project({
      ...req.body,
      managerId: req.user.id,
      progress: 0,
      status: 'active'
    });
    await project.save();
    
    // Notify team members
    const users = await User.find({ role: 'member' });
    users.forEach(async user => {
      const msg = {
        from: process.env.GMAIL_USER,
        to: user.email,
        subject: `New Project: ${project.name}`,
        html: `<p>A new project "${project.name}" has been created.</p>`
      };
      await transporter.sendMail(msg);
    });

    res.status(201).send(project);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Tasks CRUD
app.post('/api/tasks', authenticate, async (req, res) => {
  try {
    const { title, projectId, priority, dueDate } = req.body;
    
    // AI task assignment
    let assigneeId = req.body.assigneeId;
    if (!assigneeId) {
      assigneeId = await aiAssignTask(title, priority, projectId);
    }

    const task = new Task({
      title,
      projectId,
      assigneeId,
      priority,
      dueDate,
      status: 'pending',
      estimatedHours: Math.floor(Math.random() * 20) + 5,
      completedHours: 0
    });
    await task.save();

    // Notify assignee
    const assignee = await User.findById(assigneeId);
    const msg = {
      from: process.env.GMAIL_USER,
      to: assignee.email,
      subject: `New Task Assigned: ${task.title}`,
      html: `<p>You have been assigned a new task: "${task.title}"</p>`
    };
    await transporter.sendMail(msg);

    res.status(201).send(task);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// AI Task Assignment
async function aiAssignTask(title, priority, projectId) {
  // Get all team members
  const users = await User.find({ role: 'member' });
  const tasks = await Task.find();
  
  // Simple scoring system for assignment
  const userScores = await Promise.all(users.map(async user => {
    let score = 0;
    
    // Skills matching
    const taskKeywords = title.toLowerCase();
    user.skills.forEach(skill => {
      if (taskKeywords.includes(skill.toLowerCase())) {
        score += 10;
      }
    });
    
    // Workload consideration
    const userTasks = tasks.filter(t => t.assigneeId.equals(user._id) && t.status !== 'completed');
    score += Math.max(0, 5 - userTasks.length);
    
    // Priority boost for high priority tasks
    if (priority === 'high') score += 5;
    
    return { userId: user._id, score };
  }));
  
  // Return user with highest score
  userScores.sort((a, b) => b.score - a.score);
  return userScores[0].userId;
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));