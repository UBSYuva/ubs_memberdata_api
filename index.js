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
    "http://localhost:1234",
    "https://ubs-admin.netlify.app",
    "https://ubs-member-data.vercel.app",
    "https://ubs-member-data-ui.vercel.app"
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin) return callback(null, true);
        
        const isAllowed = allowedOrigins.indexOf(origin) !== -1 || 
                          /localhost/.test(origin) ||
                          /127\.0\.0\.1/.test(origin) ||
                          /\.vercel\.app$/.test(origin) ||
                          /\.netlify\.app$/.test(origin);
                          
        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('Origin not allowed by CORS:', origin);
            // Instead of error, we can pass null, true if we want to be very lax, 
            // but for now let's just use standard true/false
            callback(null, true); // Temporarily allow all to debug if it's a pattern issue
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Allow-Origin'],
    credentials: true,
    optionsSuccessStatus: 200
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
