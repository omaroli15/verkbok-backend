const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { initDatabase } = require('./src/config/db');

const authRoutes = require('./src/routes/auth');
const jobsRoutes = require('./src/routes/jobs');
const documentsRoutes = require('./src/routes/documents');
const timeRoutes = require('./src/routes/time');
const diaryRoutes = require('./src/routes/diary');
const timeoffRoutes = require('./src/routes/timeoff');
const staffRoutes = require('./src/routes/staff');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'verkbok-backend',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/time', timeRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/timeoff', timeoffRoutes);
app.use('/api/staff', staffRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: err.message
  });
});

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Verkbók backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
