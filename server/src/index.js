require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');

const sequelize = require('./models');
const User = require('./models/User');
const Message = require('./models/Message');

const uploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
const io = new Server(server, { cors: { origin: corsOrigin } });

app.use(cors({ origin: corsOrigin }));
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// Auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findByPk(decoded.id);
    if (!req.user) return res.status(401).json({ error: 'Invalid token' });
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.create({ username, password });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username, avatar: user.avatar } });
  } catch (error) {
    res.status(400).json({ error: error.errors?.[0]?.message || 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    if (!user || !(await user.validPassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    await user.update({ online: true, lastSeen: new Date() });
    res.json({ token, user: { id: user.id, username, avatar: user.avatar } });
  } catch (error) {
    res.status(401).json({ error: 'Login failed' });
  }
});

app.get('/api/users', auth, async (req, res) => {
  const users = await User.findAll({ 
    where: { id: { [require('sequelize').Op.ne]: req.user.id } },
    attributes: ['id', 'username', 'avatar', 'online', 'lastSeen']
  });
  res.json(users);
});

app.get('/api/chats/:userId', auth, async (req, res) => {
  const { userId } = req.params;
  const messages = await Message.findAll({
    where: {
      [require('sequelize').Op.or]: [
        { senderId: req.user.id, receiverId: userId },
        { senderId: userId, receiverId: req.user.id },
      ],
    },
    include: [
      { model: User, as: 'sender', attributes: ['id', 'username', 'avatar'] },
      { model: Message, as: 'replyTo', attributes: ['id', 'content'] }
    ],
    order: [['createdAt', 'ASC']]
  });
  res.json(messages);
});

// Socket.io
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user) return next(new Error('Authentication error'));
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user_${socket.user.id}`);
  socket.user.update({ online: true, lastSeen: new Date() });
  
  socket.on('sendMessage', async ({ receiverId, content, replyToId }) => {
    const message = await Message.create({
      content, senderId: socket.user.id, receiverId, replyToId: replyToId || null
    });
    const populated = await Message.findByPk(message.id, {
      include: [
        { model: User, as: 'sender', attributes: ['username', 'avatar'] },
        { model: Message, as: 'replyTo', attributes: ['id', 'content'] }
      ]
    });
    io.to(`user_${receiverId}`).emit('message', populated);
    socket.emit('message', populated);
  });

  socket.on('editMessage', async ({ messageId, content }) => {
    const msg = await Message.findByPk(messageId);
    if (!msg || msg.senderId !== socket.user.id) return;
    const fifteenMinutes = 15 * 60 * 1000;
    const age = Date.now() - new Date(msg.createdAt).getTime();
    if (age > fifteenMinutes) return;
    await msg.update({ content, edited: true });
    const populated = await Message.findByPk(messageId, {
      include: [
        { model: User, as: 'sender', attributes: ['username', 'avatar'] },
        { model: Message, as: 'replyTo', attributes: ['id', 'content'] }
      ]
    });
    const peerId = populated.receiverId;
    io.to(`user_${peerId}`).emit('messageEdited', populated);
    socket.emit('messageEdited', populated);
  });

  // WebRTC signaling events
  socket.on('call:offer', ({ toUserId, sdp, callType }) => {
    io.to(`user_${toUserId}`).emit('call:offer', {
      fromUserId: socket.user.id,
      sdp,
      callType
    });
  });

  socket.on('call:answer', ({ toUserId, sdp }) => {
    io.to(`user_${toUserId}`).emit('call:answer', {
      fromUserId: socket.user.id,
      sdp
    });
  });

  socket.on('call:ice-candidate', ({ toUserId, candidate }) => {
    io.to(`user_${toUserId}`).emit('call:ice-candidate', {
      fromUserId: socket.user.id,
      candidate
    });
  });

  socket.on('call:hangup', ({ toUserId }) => {
    io.to(`user_${toUserId}`).emit('call:hangup', { fromUserId: socket.user.id });
  });

  socket.on('disconnect', () => {
    socket.user.update({ online: false });
  });
});

const PORT = process.env.PORT || 4000;
const RESET_DB = process.env.DB_RESET === '1';
// Initialize Sequelize (tries Postgres then falls back to SQLite), then sync and start server
sequelize.sync(RESET_DB ? { force: true } : { alter: true })
  .then(() => {
    const CLIENT_DIST = path.resolve(__dirname, '..', '..', 'client', 'dist');
    if (fs.existsSync(CLIENT_DIST)) {
      app.use(express.static(CLIENT_DIST));
      app.get('*', (req, res) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
          return res.status(404).end();
        }
        res.sendFile(path.join(CLIENT_DIST, 'index.html'));
      });
    }

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
    process.exit(1);
  });