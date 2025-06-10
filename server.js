const express = require('express');
const axios = require('axios');
const router = express.Router();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// Initialize transaction
router.post('/initialize', async (req, res) => {
  const { email, amount } = req.body;

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100, // Paystack uses kobo
        callback_url: 'http://localhost:5001/api/pay/verify'
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

// Verify transaction
router.get('/verify/:reference', async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
    });

    if (response.data.data.status === 'success') {
      // Save to DB or issue token (not shown here)
      res.json({ success: true, message: 'Payment verified', data: response.data.data });
    } else {
      res.status(400).json({ success: false, message: 'Payment not successful' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
