const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const auth = require('./middleware/auth');
const User = require('./models/User');
const Todo = require('./models/Todo');

// Middleware
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(passport.initialize());

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB Atlas');
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

// Passport configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:5000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        avatar: profile.photos[0].value
      });
    }
    done(null, user);
  } catch (error) {
    done(error, null);
  }
}));

// Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/auth/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

app.get('/auth/google/callback', 
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login` 
  }),
  (req, res) => {
    const token = jwt.sign({ userId: req.user._id }, process.env.JWT_SECRET);
    res.redirect(`${process.env.CLIENT_URL}?token=${token}`);
  }
);

// Todo routes
app.get('/api/todos', auth, async (req, res) => {
  try {
    const { search, status, priority, dueDate } = req.query;
    let query = { $or: [{ creator: req.userId }, { assignedTo: req.userId }] };
    
    if (search) {
      query.$and = [
        { $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]}
      ];
    }
    
    if (status === 'completed' || status === 'incomplete') {
      query.completed = status === 'completed';
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (dueDate === 'overdue') {
      query.dueDate = { $lt: new Date() };
    }
    
    const todos = await Todo.find(query)
      .populate('creator', 'name email avatar')
      .populate('assignedTo', 'name email avatar')
      .sort({ dueDate: 1, createdAt: -1 });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/todos', auth, async (req, res) => {
  try {
    const todo = new Todo({
      ...req.body,
      creator: req.userId
    });
    const newTodo = await todo.save();
    
    // Send email notifications to assigned users
    if (req.body.assignedTo && req.body.assignedTo.length > 0) {
      const assignedUsers = await User.find({ _id: { $in: req.body.assignedTo } });
      const creator = await User.findById(req.userId);
      
      for (const user of assignedUsers) {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: 'New Task Assignment',
          html: `
            <h2>New Task Assigned</h2>
            <p><strong>${creator.name}</strong> has assigned you a new task:</p>
            <h3>${todo.title}</h3>
            <p>${todo.description}</p>
            <p>Priority: ${todo.priority}</p>
            <p>Due Date: ${todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : 'No due date'}</p>
          `
        };
        await transporter.sendMail(mailOptions);
      }
    }
    
    const populatedTodo = await Todo.findById(newTodo._id)
      .populate('creator', 'name email avatar')
      .populate('assignedTo', 'name email avatar');
    res.status(201).json(populatedTodo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/todos/:id', auth, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, creator: req.userId });
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found or unauthorized' });
    }
    
    Object.assign(todo, req.body);
    const updatedTodo = await todo.save();
    
    const populatedTodo = await Todo.findById(updatedTodo._id)
      .populate('creator', 'name email avatar')
      .populate('assignedTo', 'name email avatar');
    res.json(populatedTodo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/todos/:id', auth, async (req, res) => {
  try {
    const todo = await Todo.findOneAndDelete({ _id: req.params.id, creator: req.userId });
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found or unauthorized' });
    }
    res.json({ message: 'Todo deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// User routes
app.get('/api/users', auth, async (req, res) => {
  try {
    const users = await User.find({}, 'name email avatar');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
