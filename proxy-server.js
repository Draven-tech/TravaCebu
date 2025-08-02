const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/test', (req, res) => {
  res.json({ message: 'Test route works!' });
});

app.get('/api/places', async (req, res) => {
  try {
    const { location, radius, type, key } = req.query;
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: { location, radius, type, key }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch places', message: error.message });
  }
});

// Add Text Search endpoint
app.get('/api/place/textsearch', async (req, res) => {
  try {
    const { query, location, radius, key } = req.query;
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: { query, location, radius, key }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search places', message: error.message });
  }
});

// Add Place Details endpoint
app.get('/api/place/details', async (req, res) => {
  try {
    const { place_id, fields, key } = req.query;
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: { place_id, fields, key }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch place details', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  - GET /test');
  console.log('  - GET /api/places (Nearby Search)');
  console.log('  - GET /api/place/textsearch (Text Search)');
  console.log('  - GET /api/place/details (Place Details)');
}); 