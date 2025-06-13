const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Environment Variables
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// MongoDB Schema
const transactionSchema = new mongoose.Schema({
  email: String,
  amount: Number,
  reference: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Token Schema
const tokenSchema = new mongoose.Schema({
  studentName: String,
  studentEmail: String,
  amount: Number,
  reference: String,
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Token = mongoose.model('Token', tokenSchema);

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection failed:", err));

// Initialize payment
app.post('/api/payment/initialize', async (req, res) => {
  const { email, amount } = req.body;

  try {
    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email,
      amount: amount * 100,
    }, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const { authorization_url, reference } = response.data.data;

    await Transaction.create({ email, amount, reference });
    res.json({ authorization_url });
  } catch (error) {
    console.error("Init error:", error.message);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// Verify payment

app.get('/api/payment/verify/:reference', async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const status = response.data.data.status;

    // Update transaction
    const transaction = await Transaction.findOneAndUpdate({ reference }, { status }, { new: true });

    if (status === 'success') {
      // Generate unique token
      const tokenCode = 'CBT-' + Math.floor(100000 + Math.random() * 900000);

      // Save to DB
      const newToken = new Token({
        token: tokenCode,
        reference: reference,
        createdAt: new Date()
      });
      await newToken.save();

      return res.json({
        message: 'Payment verified and token issued',
        token: tokenCode,
        transaction
      });
    } else {
      return res.status(400).json({ message: 'Payment not successful', status });
    }
  } catch (error) {
    console.error("Verify error:", error.message);
    return res.status(500).json({ error: 'Payment verification failed' });
  }
});

app.get('/', (req, res) => {
  res.send("CBT Token Payment API is running");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
