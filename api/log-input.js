// api/log-input.js
// This is a standard Node.js serverless function for Vercel.

// --- External REST API Logging Endpoint ---
const LOGGING_REST_API_ENDPOINT = process.env.LOGGING_REST_API_ENDPOINT;
if (!LOGGING_REST_API_ENDPOINT) {
    console.warn("LOGGING_REST_API_ENDPOINT environment variable is not set. Logs will NOT be sent to an external API.");
}

/**
 * Sends log data to a specified external REST API endpoint.
 * This function runs asynchronously and does not block the main request flow.
 * @param {object} logData - The data to send as a log entry.
 */
async function sendLogToRestApi(logData) {
    if (!LOGGING_REST_API_ENDPOINT) {
        return; // Do nothing if endpoint is not configured
    }

    try {
        const response = await fetch(LOGGING_REST_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add any other headers your API might require, e.g., an API key
                // 'Authorization': `Bearer ${process.env.YOUR_API_KEY}`
            },
            body: JSON.stringify(logData),
            // Add a timeout for the fetch request to prevent it from hanging
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (response.ok) {
            console.log(`Log successfully sent to REST API: ${JSON.stringify(logData)}`);
        } else {
            const errorText = await response.text();
            console.error(`Failed to send log to REST API (${response.status}): ${errorText}`);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error(`Timeout when sending log to REST API: ${error.message}`);
        } else {
            console.error(`Error sending log to REST API: ${error.message}`);
        }
    }
}
// --- End External REST API Logging ---


export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { input } = req.body; // Vercel's Node.js runtime automatically parses JSON bodies

        if (input) {
            const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }); // Current time in Indonesia
            
            // Prepare the log data payload for the REST API
            const logDataPayload = {
                level: 'INFO', // e.g., INFO, WARN, ERROR
                timestamp: new Date().toISOString(), // ISO 8601 format is good for APIs
                message: `User Input Logged (from Image Search): "${input}"`,
                data: {
                    searchQuery: input,
                    userAgent: req.headers['user-agent'] || 'unknown',
                    ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'N/A',
                    origin: req.headers['origin'] || 'N/A'
                }
            };

            // 1. Log to Vercel Project Logs (for local debugging/Vercel dashboard)
            console.log(`[${timestamp}] User Input Logged (from Image Search): "${input}"`);

            // 2. Send the log to the external REST API (non-blocking)
            // We don't await this so the main response isn't delayed if the logging API is slow.
            sendLogToRestApi(logDataPayload); 

            return res.status(200).json({ message: 'Input logged successfully!' });
        } else {
            return res.status(400).json({ message: 'No input provided.' });
        }
    } catch (error) {
        console.error('Error processing request:', error);
        // If an error occurs during the main request processing, also try to log it to the API
        const errorLogPayload = {
            level: 'ERROR',
            timestamp: new Date().toISOString(),
            message: `Error processing request: ${error.message}`,
            data: {
                stack: error.stack,
                requestBody: req.body
            }
        };
        sendLogToRestApi(errorLogPayload); // Send error to API
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
