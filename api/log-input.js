// api/log-input.js
// This is a standard Node.js serverless function for Vercel.

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        // Log preflight requests too, as they are part of browser interaction
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
        console.log(`[${timestamp}] OPTIONS Request Logged: Method: ${req.method}, Headers: ${JSON.stringify(req.headers)}`);
        return;
    }

    // --- Core Logging for POST requests (or any other method) ---
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    
    // Extract general request details
    const requestDetails = {
        method: req.method,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'N/A',
        userAgent: req.headers['user-agent'] || 'N/A',
        origin: req.headers['origin'] || 'N/A',
        referer: req.headers['referer'] || 'N/A', // Where the request came from
        contentType: req.headers['content-type'] || 'N/A',
        // Log the entire parsed body. If it's not JSON, it might be empty or a different type.
        // For debugging, it's good to see the raw body if parsing fails.
        // req.body is already parsed by Vercel for JSON/form-urlencoded.
        body: req.body 
    };

    // Log the general request details first
    console.log(`\n--- Request Details ---`);
    console.log(`[${timestamp}] Incoming ${requestDetails.method} Request from IP: ${requestDetails.ipAddress}`);
    console.log(`User-Agent: ${requestDetails.userAgent}`);
    console.log(`Origin: ${requestDetails.origin}`);
    console.log(`Referer: ${requestDetails.referer}`);
    console.log(`Content-Type: ${requestDetails.contentType}`);
    console.log(`Full Body: ${JSON.stringify(requestDetails.body, null, 2)}`); // Pretty print body for readability
    console.log(`-------------------------\n`);

    // --- Now, handle the specific POST request logic for 'input' ---
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed. Only POST requests are processed for logging.' });
    }

    try {
        const { input } = req.body; // Try to extract 'input' from the body

        if (input) {
            // Log the specific 'input' value if found
            console.log(`[${timestamp}] Specific User Input Found: "${input}"`);
            return res.status(200).json({ message: 'Input found and logged successfully!', receivedInput: input });
        } else {
            // Log that no 'input' field was provided, but we've already logged general details
            console.warn(`[${timestamp}] No 'input' field provided in the request body.`);
            return res.status(400).json({ message: 'No "input" field provided in the request body, but request details were logged.' });
        }
    } catch (error) {
        console.error(`[${timestamp}] Error processing request after initial logging:`, error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
