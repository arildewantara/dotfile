// api/log-input.js
// This is a standard Node.js serverless function for Vercel.

// --- Discord Webhook URL ---
// This retrieves the Discord Webhook URL from Vercel Environment Variables.
// Make sure you have DISCORD_WEBHOOK_URL set in your Vercel project settings.
const DISCORD_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1398392776240005222/s3ae1Ek8XzLVePGjpwfWWuh8OOjybJCP116QUFw9MX7MLGclifdoKZhVSjlWoYWEbE2f";
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
        // Current time in Indonesia for logging
        const timestampLocal = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }); 
        // ISO 8601 for consistent machine parsing (good for Discord embed timestamp)
        const timestampISO = new Date().toISOString(); 

        // --- Prepare common data ---
        const commonLogData = {
            searchQuery: trimmedInput,
            userAgent: req.headers['user-agent'] || 'unknown',
            ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'N/A', // Get user's IP address
            origin: req.headers['origin'] || 'N/A', // Get the origin domain of the request
            timestampLocal: timestampLocal,
            timestampISO: timestampISO
        };
        // --- End common data preparation ---


        // --- 1. Log to Vercel Project Logs Dashboard ---
        // This console.log will appear in your Vercel dashboard for debugging.
        console.log(`[${commonLogData.timestampLocal}] User Input Logged (from Image Search): "${commonLogData.searchQuery}"`);


        // --- 2. Send message to Discord Webhook (non-blocking) ---
        // This part sends the rich message to your Discord channel.
        if (DISCORD_WEBHOOK_URL) {
            try {
                const discordPayload = {
                    username: "User Input Logger", // Name that appears in Discord for the message
                    avatar_url: "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png", // Optional: Custom avatar for the bot in Discord
                    content: `A new user input has been logged!`, // Main message content above the embed
                    embeds: [ // Array of embeds for richer content
                        {
                            title: `📝 New Input: "${commonLogData.searchQuery}"`, // Title of the embed
                            description: `The user entered the following query: \`${commonLogData.searchQuery}\``,
                            color: 3447003, // A blue color (decimal for #3498db)
                            fields: [ // Inline fields within the embed
                                {
                                    name: "Logged At (ID)",
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
                                text: "Powered by Vercel Serverless"
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
                        console.log('User input message successfully sent to Discord!');
                    } else {
                        // Log Discord API error details if the response was not OK
                        response.text().then(errorText => {
                            console.error(`Failed to send user input message to Discord (${response.status}): ${errorText}`);
                        });
                    }
                }).catch(discordError => {
                    // Catch network errors or timeout errors
                    if (discordError.name === 'AbortError') {
                        console.error(`Timeout when sending user input message to Discord: ${discordError.message}`);
                    } else {
                        console.error('Error sending user input message to Discord Webhook:', discordError);
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
            message: 'Input logged successfully; Discord notification attempted!',
            input: trimmedInput
        });

    } catch (error) {
        // --- General Error Handling for the Serverless Function Itself ---
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
