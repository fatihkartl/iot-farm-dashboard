const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(8080, () => {
  console.log('Backend listening on 8080');
});
