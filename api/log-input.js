// api/log-input.js
// This is a standard Node.js serverless function for Vercel.

// --- Discord Webhook URL ---
// This retrieves the Discord Webhook URL from Vercel Environment Variables.
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
if (!DISCORD_WEBHOOK_URL) {
    console.warn("DISCORD_WEBHOOK_URL environment variable is not set. Discord messages will NOT be sent.");
}
// --- End Discord Webhook URL ---


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
            const timestampLocal = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }); // Current time in Indonesia
            let definition = "No definition found."; // Default message if not found
            let definitionFetchSuccess = false; // Flag to track if definition was successfully fetched

            // --- 1. Fetch definition from Free Dictionary API ---
            try {
                const dictionaryApiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(input)}`;
                const dictionaryResponse = await fetch(dictionaryApiUrl);

                if (dictionaryResponse.ok) {
                    const data = await dictionaryResponse.json();

                    if (Array.isArray(data) && data.length > 0 &&
                        data[0].meanings && data[0].meanings.length > 0 &&
                        data[0].meanings[0].definitions && data[0].meanings[0].definitions.length > 0) {
                        
                        definition = data[0].meanings[0].definitions[0].definition;
                        definitionFetchSuccess = true;
                    } else if (data.title === "No Definitions Found") {
                        definition = `No definition found for "${input}".`;
                    } else {
                        definition = `Could not parse definition for "${input}".`;
                    }
                } else {
                    const errorDetails = await dictionaryResponse.text();
                    definition = `Failed to fetch definition (Status: ${dictionaryResponse.status}).`;
                    console.error(`Dictionary API error for "${input}": ${dictionaryResponse.status} - ${errorDetails}`);
                }
            } catch (dictionaryError) {
                definition = `Error accessing dictionary API: ${dictionaryError.message}`;
                console.error(`Error in dictionary API fetch for "${input}":`, dictionaryError);
            }
            // --- End Definition Fetching ---
            
            // --- 2. Log to Vercel Project Logs Dashboard ---
            console.log(`[${timestampLocal}] User Input: "${input}" | Definition: "${definition}"`);

            // --- 3. Send message to Discord Webhook (non-blocking) ---
            if (DISCORD_WEBHOOK_URL) {
                try {
                    const discordPayload = {
                        username: "Word Definition Bot", // Name that appears in Discord
                        avatar_url: "https://i.imgur.com/gK9yqf0.png", // Example: A book icon or dictionary icon
                        content: `A new word definition request has been processed!`, // Main message content
                        embeds: [ // Richer content with embeds
                            {
                                title: `📚 Definition for: "${input}"`, // The actual search query as title
                                description: definitionFetchSuccess
                                    ? `**Definition:** ${definition}`
                                    : `*Status:* ${definition}`, // Show the error/not found message
                                color: definitionFetchSuccess ? 3447003 : 15548997, // Blue if success, Red if error/not found
                                fields: [
                                    {
                                        name: "Requested At",
                                        value: timestampLocal,
                                        inline: true
                                    },
                                    {
                                        name: "User IP",
                                        value: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'N/A',
                                        inline: true
                                    }
                                ],
                                footer: {
                                    text: "Powered by Vercel Serverless & Free Dictionary API"
                                }
                            }
                        ]
                    };

                    // We don't await this to keep the response fast for the client
                    fetch(DISCORD_WEBHOOK_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(discordPayload),
                        signal: AbortSignal.timeout(5000) // 5 second timeout
                    }).then(response => {
                        if (response.ok) {
                            console.log('Definition message successfully sent to Discord!');
                        } else {
                            response.text().then(errorText => {
                                console.error(`Failed to send definition message to Discord (${response.status}): ${errorText}`);
                            });
                        }
                    }).catch(discordError => {
                        if (discordError.name === 'AbortError') {
                            console.error(`Timeout when sending definition message to Discord: ${discordError.message}`);
                        } else {
                            console.error('Error sending definition message to Discord Webhook:', discordError);
                        }
                    });
                } else {
                    console.warn("Discord Webhook URL not set. Skipping Discord notification for this input.");
                }
            } catch (discordSendError) {
                console.error("Critical error during Discord message preparation/send:", discordSendError);
            }

            return res.status(200).json({ 
                message: 'Input logged and definition retrieved; Discord notification attempted!',
                input: input,
                definition: definition 
            });
        } else {
            return res.status(400).json({ message: 'No input provided.' });
        }
    } catch (error) {
        console.error('Error processing request:', error);

        // --- Handle main function errors and notify Discord ---
        if (DISCORD_WEBHOOK_URL) {
            try {
                const discordErrorPayload = {
                    username: "Error Notifier",
                    avatar_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Google_Chrome_error_icon.svg/1200px-Google_Chrome_error_icon.svg.png", // Red error icon
                    embeds: [
                        {
                            title: "🚨 Serverless Function Error 🚨",
                            description: `An error occurred while processing an input request: \`${error.message}\``,
                            color: 15548997, // Red color
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

        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
}
