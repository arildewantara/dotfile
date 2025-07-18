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
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { input } = req.body; // Vercel's Node.js runtime automatically parses JSON bodies

        if (input) {
            const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }); // Current time in Indonesia
            
            // This console.log will appear in your Vercel project's logs (dashboard)
            console.log(`[${timestamp}] User Input Logged (from Image Search): "${input}"`);

            return res.status(200).json({ message: 'Input logged successfully!' });
        } else {
            return res.status(400).json({ message: 'No input provided.' });
        }
    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
