console.log('đźš€ Starting minimal server test...');

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Server is working!' });
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`âś… Minimal server running on port ${PORT}`);
  console.log(`đźŚ Test URL: http://localhost:${PORT}`);
}); 
