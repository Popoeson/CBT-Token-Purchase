const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Environment Variables
const PORT = process.env.PORT || 5000;
const MONGO_URL = process.env.MONGO_URL;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// MongoDB Model
const tokenTransactionSchema = new mongoose.Schema({
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

const TokenTransaction = mongoose.model('TokenTransaction', tokenTransactionSchema);

// MongoDB Connection
mongoose.connect(MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Payment Initialization Route
app.post('/api/payment/initialize', async (req, res) => {
  const { studentName, studentEmail, amount } = req.body;

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: studentEmail,
        amount: amount * 100, // Convert Naira to Kobo
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const reference = response.data.data.reference;

    // Save transaction
    const transaction = new TokenTransaction({
      studentName,
      studentEmail,
      amount,
      reference,
    });

    await transaction.save();

    res.status(200).json({
      message: 'Payment initialized',
      authorization_url: response.data.data.authorization_url,
    });
  } catch (error) {
    console.error('Error initializing payment:', error.message);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// Payment Verification Route
app.get('/api/payment/verify/:reference', async (req, res) => {
  const reference = req.params.reference;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const status = response.data.data.status;

    const transaction = await TokenTransaction.findOneAndUpdate(
      { reference },
      { status },
      { new: true }
    );

    res.status(200).json({
      message: 'Payment verified',
      transaction,
    });
  } catch (error) {
    console.error('Error verifying payment:', error.message);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
