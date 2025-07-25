// api/log-input.js
// This is a standard Node.js serverless function for Vercel.

// --- Discord Webhook URL ---
// This retrieves the Discord Webhook URL from Vercel Environment Variables.
// Make sure you have DISCORD_WEBHOOK_URL set in your Vercel project settings.
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
if (!DISCORD_WEBHOOK_URL) {
    console.warn("DISCORD_WEBHOOK_URL environment variable is not set. Discord messages will NOT be sent.");
}
// --- End Discord Webhook URL ---


export default async function handler(req, res) {
    // Set CORS headers to allow requests from your frontend
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allows any origin to send requests
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request (sent by browsers before actual POST)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests for actual data submission
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // Vercel's Node.js runtime automatically parses JSON bodies from req.body
        const { input } = req.body;

        // Ensure an input was provided
        if (!input || typeof input !== 'string' || input.trim() === '') {
            return res.status(400).json({ message: 'No valid input provided.' });
        }

        const trimmedInput = input.trim();
        const timestampLocal = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }); // Current time in Indonesia
        let definition = "No definition found."; // Default message if not found
        let definitionFetchSuccess = false; // Flag to track if definition was successfully fetched

        // --- 1. Fetch definition from Free Dictionary API ---
        try {
            const dictionaryApiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(trimmedInput)}`;
            const dictionaryResponse = await fetch(dictionaryApiUrl);

            if (dictionaryResponse.ok) {
                const data = await dictionaryResponse.json();

                // Parse the response to get the definition
                if (Array.isArray(data) && data.length > 0 &&
                    data[0].meanings && data[0].meanings.length > 0 &&
                    data[0].meanings[0].definitions && data[0].meanings[0].definitions.length > 0) {
                    
                    definition = data[0].meanings[0].definitions[0].definition;
                    definitionFetchSuccess = true;
                } else if (data.title === "No Definitions Found") {
                    definition = `No definition found for "${trimmedInput}".`;
                } else {
                    definition = `Could not parse definition for "${trimmedInput}".`;
                }
            } else {
                // Handle API errors (e.g., 404 for word not found, 500 for server error)
                const errorDetails = await dictionaryResponse.text();
                definition = `Failed to fetch definition (Status: ${dictionaryResponse.status}).`;
                console.error(`Dictionary API error for "${trimmedInput}": ${dictionaryResponse.status} - ${errorDetails}`);
            }
        } catch (dictionaryError) {
            definition = `Error accessing dictionary API: ${dictionaryError.message}`;
            console.error(`Error in dictionary API fetch for "${trimmedInput}":`, dictionaryError);
        }
        // --- End Definition Fetching ---
        
        // --- Prepare common data for all logging methods ---
        // This makes it easy to reuse dynamic information.
        const commonLogData = {
            searchQuery: trimmedInput,
            definition: definition,
            definitionStatus: definitionFetchSuccess ? 'Success' : 'Failed',
            userAgent: req.headers['user-agent'] || 'unknown',
            ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'N/A', // Get user's IP address
            origin: req.headers['origin'] || 'N/A', // Get the origin domain of the request
            timestampLocal: timestampLocal,
            timestampISO: new Date().toISOString() // ISO 8601 for consistent machine parsing
        };
        // --- End common data preparation ---


        // --- 2. Log to Vercel Project Logs Dashboard ---
        // This console.log will appear in your Vercel dashboard for debugging.
        console.log(`[${commonLogData.timestampLocal}] User Input: "${commonLogData.searchQuery}" | Definition: "${commonLogData.definition}"`);


        // --- 3. Send message to Discord Webhook (non-blocking) ---
        // This part sends the rich message to your Discord channel.
        if (DISCORD_WEBHOOK_URL) {
            try {
                const discordPayload = {
                    username: "Word Definition Bot", // Name that appears in Discord for the message
                    avatar_url: "https://i.imgur.com/gK9yqf0.png", // Optional: Custom avatar for the bot in Discord
                    content: `A new word definition request has been processed!`, // Main message content above the embed
                    embeds: [ // Array of embeds for richer content
                        {
                            title: `📚 Definition for: "${commonLogData.searchQuery}"`, // Title of the embed
                            description: commonLogData.definitionStatus === 'Success'
                                ? `**Definition:** ${commonLogData.definition}`
                                : `*Status:* ${commonLogData.definition}`, // Show error/not found message if definition failed
                            color: commonLogData.definitionStatus === 'Success' ? 3447003 : 15548997, // Blue for success, Red for error/not found
                            fields: [ // Inline fields within the embed
                                {
                                    name: "Requested At (ID)",
                                    value: commonLogData.timestampLocal,
                                    inline: true
                                },
                                {
                                    name: "User IP",
                                    value: commonLogData.ipAddress,
                                    inline: true
                                },
                                {
                                    name: "Source Origin",
                                    value: commonLogData.origin,
                                    inline: false // This field takes up a full line
                                }
                            ],
                            footer: { // Footer text at the bottom of the embed
                                text: "Powered by Vercel Serverless & Free Dictionary API"
                            },
                            timestamp: commonLogData.timestampISO // Add timestamp to embed
                        }
                    ]
                };

                // Send the POST request to the Discord Webhook URL.
                // We don't 'await' this fetch call so the serverless function can
                // respond to the frontend quickly, without waiting for Discord's API.
                fetch(DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(discordPayload),
                    signal: AbortSignal.timeout(5000) // Timeout after 5 seconds to prevent hanging
                }).then(response => {
                    if (response.ok) {
                        console.log('Definition message successfully sent to Discord!');
                    } else {
                        // Log Discord API error details if the response was not OK
                        response.text().then(errorText => {
                            console.error(`Failed to send definition message to Discord (${response.status}): ${errorText}`);
                        });
                    }
                }).catch(discordError => {
                    // Catch network errors or timeout errors
                    if (discordError.name === 'AbortError') {
                        console.error(`Timeout when sending definition message to Discord: ${discordError.message}`);
                    } else {
                        console.error('Error sending definition message to Discord Webhook:', discordError);
                    }
                });
            } catch (discordSendError) {
                console.error("Critical error during Discord message preparation/send:", discordSendError);
            }
        } else {
            console.warn("Discord Webhook URL not set. Skipping Discord notification for this input.");
        }
        // --- End Discord Webhook Sending ---

        // Send a success response back to your frontend
        return res.status(200).json({ 
            message: 'Input logged and definition retrieved; Discord notification attempted!',
            input: trimmedInput,
            definition: definition 
        });

    } catch (error) {
        // --- General Error Handling ---
        console.error('Error processing request:', error);

        // Attempt to send an error notification to Discord if possible
        if (DISCORD_WEBHOOK_URL) {
            try {
                const discordErrorPayload = {
                    username: "Error Notifier",
                    avatar_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Google_Chrome_error_icon.svg/1200px-Google_Chrome_error_icon.svg.png", // Red error icon
                    embeds: [
                        {
                            title: "🚨 Serverless Function Error 🚨",
                            description: `An error occurred while processing an input request: \`${error.message}\``,
                            color: 15548997, // Red color (decimal for #ED4245)
                            fields: [
                                { name: "Timestamp (ID)", value: new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }), inline: true },
                                { name: "Input Received", value: req.body.input ? `\`${req.body.input}\`` : 'N/A', inline: false },
                                { name: "Stack Trace (partial)", value: `\`\`\`${error.stack ? error.stack.substring(0, 1000) + '...' : 'N/A'}\`\`\``, inline: false }
                            ],
                            footer: { text: "Check Vercel logs for full details" }
                        }
                    ]
                };
                fetch(DISCORD_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(discordErrorPayload),
                    signal: AbortSignal.timeout(5000)
                }).then(response => {
                    if (!response.ok) response.text().then(text => console.error(`Failed to send error alert to Discord (${response.status}): ${text}`));
                }).catch(alertError => console.error("Error sending error alert to Discord:", alertError));
            } catch (alertPrepError) {
                console.error("Failed to prepare Discord error alert:", alertPrepError);
            }
        }
        // --- End Discord error notification ---

        // Send an error response back to your frontend
        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
