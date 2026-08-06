require('dotenv').config();
const express = require('express');
const { connect } = require('./config/database');
const authRouter = require('./routes/auth');

const app = express();
app.use(express.json());

// Connect to database
connect().catch(err => console.error('DB connection error:', err));

// Routes
app.use('/auth', authRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VexAccount service listening on port ${PORT}`);
});
