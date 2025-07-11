console.log('🚀 Starting minimal server test...');

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Server is working!' });
});

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`✅ Minimal server running on port ${PORT}`);
  console.log(`🌐 Test URL: http://localhost:${PORT}`);
}); 