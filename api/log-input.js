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
            let definition = "No definition found."; // Default message if not found

            try {
                // Fetch definition from Free Dictionary API
                const dictionaryApiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(input)}`;
                const dictionaryResponse = await fetch(dictionaryApiUrl);

                if (dictionaryResponse.ok) {
                    const data = await dictionaryResponse.json();

                    // The API returns an array. The first element usually contains the primary info.
                    // Look for the first meaning's first definition.
                    if (Array.isArray(data) && data.length > 0 &&
                        data[0].meanings && data[0].meanings.length > 0 &&
                        data[0].meanings[0].definitions && data[0].meanings[0].definitions.length > 0) {
                        
                        definition = data[0].meanings[0].definitions[0].definition;
                    } else if (data.title === "No Definitions Found") {
                        definition = `No definition found for "${input}".`;
                    } else {
                        definition = `Could not parse definition for "${input}".`;
                    }
                } else {
                    // Handle non-OK responses from the dictionary API (e.g., 404 for word not found)
                    const errorDetails = await dictionaryResponse.text();
                    definition = `Failed to fetch definition (Status: ${dictionaryResponse.status}). Details: ${errorDetails.substring(0, 100)}`; // Truncate details
                    console.error(`Dictionary API error for "${input}": ${dictionaryResponse.status} - ${errorDetails}`);
                }
            } catch (dictionaryError) {
                definition = `Error accessing dictionary API: ${dictionaryError.message}`;
                console.error(`Error in dictionary API fetch for "${input}":`, dictionaryError);
            }
            
            // This console.log will now include the definition
            console.log(`[${timestamp}] User Input: "${input}" | Definition: "${definition}"`);

            // You can also include the definition in the response to the frontend if needed
            return res.status(200).json({ 
                message: 'Input logged and definition retrieved successfully!',
                input: input,
                definition: definition 
            });
        } else {
            return res.status(400).json({ message: 'No input provided.' });
        }
    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
