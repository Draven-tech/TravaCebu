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

// Add Google Directions API endpoint
app.get('/api/directions', async (req, res) => {
  try {
    const { origin, destination, waypoints, mode, alternatives, transit_mode, key } = req.query;
    const params = { origin, destination, key };
    
    if (waypoints) params.waypoints = waypoints;
    if (mode) params.mode = mode;
    if (alternatives) params.alternatives = alternatives;
    if (transit_mode) params.transit_mode = transit_mode;
    
    console.log('Directions API request params:', params);
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params
    });
    console.log('Directions API response status:', response.status);
    res.json(response.data);
  } catch (error) {
    console.error('Directions API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch directions', message: error.message });
  }
});

// Add Google Routes API endpoint
app.post('/api/routes', async (req, res) => {
  try {
    const { key } = req.query;
    const requestBody = req.body;
    
    const response = await axios.post('https://routes.googleapis.com/directions/v2:computeRoutes', requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps,routes.legs.staticDuration,routes.legs.polyline,routes.legs.startLocation,routes.legs.endLocation,routes.legs.steps.transitDetails,routes.legs.steps.travelMode'
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to compute routes', message: error.message });
  }
});

// Add OSRM endpoint for road snapping (backup)
app.get('/api/osrm', async (req, res) => {
  try {
    const { coordinates, profile } = req.query;
    const response = await axios.get(`https://router.project-osrm.org/route/v1/${profile || 'driving'}/${coordinates}`, {
      params: { overview: 'full', geometries: 'geojson' }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch OSRM route', message: error.message });
  }
});

// Add OSRM nearest endpoint for road snapping
app.get('/api/osrm/nearest/:coordinates', async (req, res) => {
  try {
    const { coordinates } = req.params;
    const { profile } = req.query;
    const response = await axios.get(`https://router.project-osrm.org/nearest/v1/${profile || 'driving'}/${coordinates}`, {
      params: { number: 1 }
    });
    res.json(response.data);
  } catch (error) {
    console.error('OSRM nearest error:', error.message);
    res.status(500).json({ error: 'Failed to fetch nearest road', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  - GET /test');
  console.log('  - GET /api/places (Nearby Search)');
  console.log('  - GET /api/place/textsearch (Text Search)');
  console.log('  - GET /api/place/details (Place Details)');
  console.log('  - GET /api/directions (Google Directions API)');
  console.log('  - POST /api/routes (Google Routes API)');
  console.log('  - GET /api/osrm (OSRM Routing)');
  console.log('  - GET /api/osrm/nearest/:coordinates (OSRM Road Snapping)');
}); 