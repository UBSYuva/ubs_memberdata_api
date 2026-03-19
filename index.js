const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
require('dotenv').config();

const memberDataRoutes = require('./routes/memberDataRoutes');

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
const allowedOrigins = [
    "https://localhost:4200",
    "http://localhost:4200",
    "https://localhost:51087",
    "http://localhost:51087",
    "https://ubs-admin.netlify.app"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost') || origin.startsWith('https://localhost')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/MemberData', memberDataRoutes);
app.use('/api/memberdata', memberDataRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK' }));

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

module.exports = app;
