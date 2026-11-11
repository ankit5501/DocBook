require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./config/db');

const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Run DB Schema automatically
const runSchema = async () => {
  try {
    const schemaPath = path.join(__dirname, 'models', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('Database schema ensured.');
  } catch (err) {
    console.error('Error running schema:', err.message);
  }
};
runSchema();

const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// Map to store connected users: userId -> socketId
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', (userId) => {
    connectedUsers.set(userId.toString(), socket.id);
  });

  // --- CONSULTATION CHAT SOCKET EVENTS ---
  socket.on('join_consultation_chat', ({ appointmentId }) => {
    const roomName = `chat_${appointmentId}`;
    socket.join(roomName);
    console.log(`Socket ${socket.id} joined consultation chat room ${roomName}`);
  });

  socket.on('leave_consultation_chat', ({ appointmentId }) => {
    const roomName = `chat_${appointmentId}`;
    socket.leave(roomName);
  });

  // --- 1-ON-1 WEBRTC VIDEO CONSULTATION ROOM EVENTS ---
  socket.on('join_video_room', ({ roomId, userId, userName, userRole }) => {
    const videoRoom = `video_${roomId}`;
    socket.join(videoRoom);
    socket.data.videoRoom = videoRoom;
    socket.data.userId = userId;
    socket.data.userName = userName;

    console.log(`User ${userName} (${userRole}) joined video room: ${videoRoom}`);

    // Notify other participant in the room that a peer has joined
    socket.to(videoRoom).emit('user_joined_video', {
      socketId: socket.id,
      userId,
      userName,
      userRole
    });
  });

  socket.on('video_offer', ({ roomId, offer }) => {
    const videoRoom = `video_${roomId}`;
    socket.to(videoRoom).emit('video_offer', {
      offer,
      senderSocketId: socket.id
    });
  });

  socket.on('video_answer', ({ roomId, answer }) => {
    const videoRoom = `video_${roomId}`;
    socket.to(videoRoom).emit('video_answer', {
      answer,
      senderSocketId: socket.id
    });
  });

  socket.on('ice_candidate', ({ roomId, candidate }) => {
    const videoRoom = `video_${roomId}`;
    socket.to(videoRoom).emit('ice_candidate', {
      candidate,
      senderSocketId: socket.id
    });
  });

  socket.on('leave_video_room', ({ roomId }) => {
    const videoRoom = `video_${roomId}`;
    socket.leave(videoRoom);
    socket.to(videoRoom).emit('user_left_video', {
      socketId: socket.id,
      userName: socket.data.userName
    });
  });

  socket.on('disconnect', () => {
    if (socket.data.videoRoom) {
      socket.to(socket.data.videoRoom).emit('user_left_video', {
        socketId: socket.id,
        userName: socket.data.userName
      });
    }

    for (const [key, value] of connectedUsers.entries()) {
      if (value === socket.id) {
        connectedUsers.delete(key);
        break;
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

app.set('io', io);
app.set('connectedUsers', connectedUsers);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route to test server
app.get('/', (req, res) => {
  res.send('Doctor Appointment Booking System API is running...');
});

// We will require and use our routes here
app.use('/api/auth', require('./routes/auth'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/patient', require('./routes/patient'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/waitlist', require('./routes/waitlist'));
app.use('/api/clinic-queue', require('./routes/clinicQueue'));

const { expireUnclaimedOffers } = require('./services/waitlistService');
// Auto-expire unclaimed waitlist offers every 30 seconds and roll over to next waiting patient
setInterval(() => {
  expireUnclaimedOffers(app).catch(err => console.error('Auto expire waitlist error:', err.message));
}, 30000);



const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
