const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Proxy endpoint for Google Maps Places API
app.get('/api/places', async (req, res) => {
  try {
    const { location, radius, type, key } = req.query;
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: {
        location,
        radius,
        type,
        key
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch places',
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log('Use this URL in your Angular app to avoid CORS issues');
}); 