const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise'); 
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;


app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    message: 'School Management API',
    endpoints: {
      addSchool: 'POST /addSchool',
      listSchools: 'GET /listSchools?latitude=NUM&longitude=NUM'
    }
  });
});

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'mysql',
  database: 'school_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}


app.post('/addSchool', async (req, res) => {
  try {
    const { name, address, latitude, longitude } = req.body;

  
    if (!name?.trim() || !address?.trim()) {
      return res.status(400).json({ error: 'Name and address are required' });
    }
    
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Coordinates out of range' });
    }

    const [result] = await pool.execute(
      'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)',
      [name.trim(), address.trim(), lat, lon]
    );

    res.status(201).json({
      message: 'School added successfully',
      schoolId: result.insertId
    });
  } catch (err) {
    console.error('Error adding school:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.get('/listSchools', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    
    // Validation
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Valid coordinates required' });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Coordinates out of range' });
    }

    const [schools] = await pool.query('SELECT * FROM schools');
    
    const schoolsWithDistance = schools.map(school => ({
      ...school,
      distance: parseFloat(calculateDistance(
        lat,
        lon,
        school.latitude,
        school.longitude
      ).toFixed(2))
    })).sort((a, b) => a.distance - b.distance);

    res.json(schoolsWithDistance);
  } catch (err) {
    console.error('Error fetching schools:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});