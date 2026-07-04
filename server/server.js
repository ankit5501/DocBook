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

  socket.on('disconnect', () => {
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

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
