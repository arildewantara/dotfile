// netlify/functions/log-search.js
const express = require('express');
const serverless = require('serverless-http'); // For wrapping Express
const app = express();

// Middleware to parse JSON body
app.use(express.json());

// This is your logging endpoint, adapted for a serverless function
app.post('/', (req, res) => { // The root path '/' within the function context
    const searchQuery = req.body.query;
    if (searchQuery) {
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
        // This log will appear in your Netlify function logs (dashboard)
        console.log(`[${timestamp}] Search Query from Client: "${searchQuery}"`);
        res.json({ message: 'Query logged successfully!' });
    } else {
        res.status(400).json({ message: 'No search query provided.' });
    }
});

// Export the Express app wrapped by serverless-http
exports.handler = serverless(app);
