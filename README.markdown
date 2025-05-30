# Woat: WhatsApp Auto-Reply Bot

Woat is a WhatsApp bot that automatically responds to messages with intelligent, context-aware replies powered by the Gemini API. It leverages tone recognition and conversation history to generate responses that mimic your communication style, ensuring replies feel personal and natural.

## Features

- **Tone Recognition**: Analyzes past messages to match your unique communication style.
- **Conversation Memory**: Stores chat history in a JSON file to maintain context across conversations.
- **Gemini API Integration**: Uses Google's Gemini API for generating intelligent responses.
- **Customizable Contacts**: Configures which contacts receive auto-replies, with support for specific names, numbers, or all contacts.
- **WhatsApp Web Support**: Integrates with `whatsapp-web.js` for seamless WhatsApp connectivity.

## Setup Guide

### Step 1: Install Dependencies

Install the required Node.js and Python packages:

```bash
# Node.js dependencies
npm install whatsapp-web.js qrcode-terminal

# Python dependencies
pip install google-generativeai
```

### Step 2: Obtain Gemini API Key

1. Visit Google AI Studio(https://aistudio.google.com/app/apikey).
2. Click "Create API Key".
3. Copy the generated API key.
4. Replace `YOUR_GEMINI_API_KEY_HERE` in `gemini_bot.py` with your key.

### Step 3: Project Structure

Ensure your project directory is organized as follows:

```
echo-nerd/
├── package.json              # Node.js configuration
├── smart_whatsapp_bot.js     # Main bot logic
├── gemini_bot.py            # Gemini API response generator
├── chat_history.json        # Stores conversation history (auto-generated)
└── whatsapp_session/         # Stores session data (auto-generated)
```

### Step 4: Configuration

Edit `smart_whatsapp_bot.js` to customize the bot's behavior:

```javascript
// Contacts to monitor for auto-replies
const MONITOR_CONTACTS = ["Mom", "+919347632xx", "ALL"];

// Enable or disable AI-powered responses
const USE_AI_RESPONSES = true; // Set to false for static replies

// Fallback message when AI is disabled
const SIMPLE_REPLY = "Hi, I'm busy right now, will reply soon!";
```

### Step 5: Run the Bot

Start the bot and scan the displayed QR code with your WhatsApp app to authenticate:

```bash
node smart_whatsapp_bot.js
```

## How It Works

EchoNerd processes incoming WhatsApp messages as follows:

1. **Message Detection**: The JavaScript layer (`whatsapp-web.js`) captures incoming messages.
2. **Contact Filtering**: Checks if the sender is in `MONITOR_CONTACTS`. Non-matching messages are ignored.
3. **History Storage**: Saves the message to `chat_history.json` for context.
4. **AI Response Generation**: Passes the message and context to `gemini_bot.py`, which queries the Gemini API.
5. **Tone Mimicry**: The API generates a response tailored to your communication style based on historical messages.
6. **Reply Delivery**: Sends the response via WhatsApp Web and updates the conversation history.

## Customization

- **Tone Adjustment**: Provide more message history to refine the bot's mimicry of your style.
- **Contact Selection**: Modify `MONITOR_CONTACTS` to target specific contacts or enable replies for all.
- **AI Toggle**: Set `USE_AI_RESPONSES` to `false` for simple, static replies.
- **History Management**: Adjust the depth of `chat_history.json` to control context retention.

## Notes

- **Authentication**: On first run, scan the QR code in the terminal to link WhatsApp.
- **API Key Security**: Store your Gemini API key securely, preferably in a `.env` file, and avoid committing it to version control.
- **Rate Limits**: Be mindful of Gemini API usage quotas to avoid restrictions.
- **History File**: Periodically clear `chat_history.json` to manage file size and performance.

## Tags

- WhatsApp
- Chatbot
- Gemini API
- Node.js
- Python
- AI
- Automation
- Tone Recognition

## Contact

For questions, suggestions, or contributions, open an issue on this repository or reach out via GitHub.
`Email: nithinjambula89@gmail.com`

## License

MIT License. See the LICENSE file for details.
