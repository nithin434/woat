const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const MONITOR_CONTACTS = ["Mom", "+918897230748", "+919347632259", "Meee", "ALL"]; // Add "ALL" to respond to everyone
const USE_AI_RESPONSES = true; // Set to false for simple auto-replies
const SIMPLE_REPLY = "Hi! I'm busy right now, will get back to you soon! 😊";

// Enhanced file storage
const CHAT_HISTORY_FILE = 'chat_history.json';
const CONTACT_PROFILES_FILE = 'contact_profiles.json';
const BOT_ANALYTICS_FILE = 'bot_analytics.json';

class SmartWhatsAppBot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: './whatsapp_session'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        this.chatHistory = this.loadChatHistory();
        this.contactProfiles = this.loadContactProfiles();
        this.botAnalytics = this.loadBotAnalytics();
        this.processedMessages = new Set();
        this.setupEventHandlers();
    }

    // Load chat history from file
    loadChatHistory() {
        try {
            if (fs.existsSync(CHAT_HISTORY_FILE)) {
                const data = fs.readFileSync(CHAT_HISTORY_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.log('No previous chat history found, starting fresh.');
        }
        return {};
    }

    // Save chat history to file
    saveChatHistory() {
        try {
            fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(this.chatHistory, null, 2));
        } catch (error) {
            console.error('Error saving chat history:', error);
        }
    }

    // Load contact profiles
    loadContactProfiles() {
        try {
            if (fs.existsSync(CONTACT_PROFILES_FILE)) {
                const data = fs.readFileSync(CONTACT_PROFILES_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.log('No contact profiles found, starting fresh.');
        }
        return {};
    }

    // Load bot analytics
    loadBotAnalytics() {
        try {
            if (fs.existsSync(BOT_ANALYTICS_FILE)) {
                const data = fs.readFileSync(BOT_ANALYTICS_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.log('No analytics data found, starting fresh.');
        }
        return {
            totalMessages: 0,
            totalResponses: 0,
            contactInteractions: {},
            responseTypes: {},
            dailyStats: {}
        };
    }

    // Save contact profiles
    saveContactProfiles() {
        try {
            fs.writeFileSync(CONTACT_PROFILES_FILE, JSON.stringify(this.contactProfiles, null, 2));
        } catch (error) {
            console.error('Error saving contact profiles:', error);
        }
    }

    // Save analytics
    saveBotAnalytics() {
        try {
            fs.writeFileSync(BOT_ANALYTICS_FILE, JSON.stringify(this.botAnalytics, null, 2));
        } catch (error) {
            console.error('Error saving analytics:', error);
        }
    }

    // Store message in history
    storeMessage(contactId, contactName, message, isFromMe, messageType = 'text') {
        if (!this.chatHistory[contactId]) {
            this.chatHistory[contactId] = {
                name: contactName,
                messages: [],
                firstInteraction: new Date().toISOString(),
                lastInteraction: new Date().toISOString()
            };
        }

        // Update last interaction
        this.chatHistory[contactId].lastInteraction = new Date().toISOString();

        // Store message with enhanced metadata
        this.chatHistory[contactId].messages.push({
            text: message,
            fromMe: isFromMe,
            timestamp: new Date().toISOString(),
            messageType: messageType,
            wordCount: message.split(' ').length,
            hasEmoji: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0]-\u{1F1FF}]/gu.test(message),
            hasQuestion: message.includes('?'),
            isShort: message.length <= 20
        });

        // Keep only last 50 messages per contact for better context
        if (this.chatHistory[contactId].messages.length > 50) {
            this.chatHistory[contactId].messages = this.chatHistory[contactId].messages.slice(-50);
        }

        // Update analytics
        this.updateAnalytics(contactId, contactName, message, isFromMe);

        this.saveChatHistory();
    }

    // Update analytics data
    updateAnalytics(contactId, contactName, message, isFromMe) {
        const today = new Date().toISOString().split('T')[0];
        
        // Update total counters
        this.botAnalytics.totalMessages++;
        if (isFromMe) {
            this.botAnalytics.totalResponses++;
        }

        // Update contact interactions
        if (!this.botAnalytics.contactInteractions[contactId]) {
            this.botAnalytics.contactInteractions[contactId] = {
                name: contactName,
                messageCount: 0,
                responseCount: 0,
                avgResponseTime: 0
            };
        }
        
        this.botAnalytics.contactInteractions[contactId].messageCount++;
        if (isFromMe) {
            this.botAnalytics.contactInteractions[contactId].responseCount++;
        }

        // Update daily stats
        if (!this.botAnalytics.dailyStats[today]) {
            this.botAnalytics.dailyStats[today] = {
                messages: 0,
                responses: 0,
                uniqueContacts: new Set()
            };
        }
        
        this.botAnalytics.dailyStats[today].messages++;
        if (isFromMe) {
            this.botAnalytics.dailyStats[today].responses++;
        }
        this.botAnalytics.dailyStats[today].uniqueContacts.add(contactId);

        this.saveBotAnalytics();
    }

    // Build contact profile
    buildContactProfile(contactId, contactName, contactNumber) {
        if (!this.contactProfiles[contactId]) {
            this.contactProfiles[contactId] = {
                name: contactName,
                number: contactNumber,
                relationshipLevel: 'acquaintance',
                communicationStyle: {},
                preferences: {},
                lastUpdated: new Date().toISOString()
            };
        }

        const messages = this.getRecentMessages(contactId, 20);
        if (messages.length > 0) {
            // Analyze communication patterns
            const userMessages = messages.filter(m => !m.fromMe);
            const myMessages = messages.filter(m => m.fromMe);

            // Update relationship level based on interaction frequency and content
            const totalInteractions = messages.length;
            const avgMessageLength = userMessages.reduce((sum, msg) => sum + msg.text.length, 0) / userMessages.length;
            const hasPersonalContent = messages.some(msg => 
                /\b(family|work|home|feeling|love|miss|tired|busy|personal)\b/i.test(msg.text)
            );

            let relationshipLevel = 'acquaintance';
            if (totalInteractions > 30 && hasPersonalContent) {
                relationshipLevel = 'close_friend';
            } else if (totalInteractions > 15) {
                relationshipLevel = 'friend';
            }

            // Special handling for family keywords
            if (/\b(mom|dad|mother|father|sister|brother|family)\b/i.test(contactName)) {
                relationshipLevel = 'family';
            }

            this.contactProfiles[contactId] = {
                ...this.contactProfiles[contactId],
                relationshipLevel,
                communicationStyle: {
                    avgMessageLength,
                    usesEmojis: userMessages.some(msg => msg.hasEmoji),
                    asksQuestions: userMessages.some(msg => msg.hasQuestion),
                    preferredGreeting: this.extractCommonGreeting(userMessages),
                    formalityLevel: this.analyzeFormalityLevel(userMessages)
                },
                preferences: {
                    responseSpeed: this.analyzePreferredResponseSpeed(messages),
                    responseLength: this.analyzePreferredResponseLength(myMessages)
                },
                lastUpdated: new Date().toISOString()
            };
        }

        this.saveContactProfiles();
        return this.contactProfiles[contactId];
    }

    // Extract common greeting patterns
    extractCommonGreeting(messages) {
        const greetings = [];
        const greetingPatterns = /\b(hi|hello|hey|good morning|good evening|sup|wassup)\b/gi;
        
        messages.forEach(msg => {
            const matches = msg.text.match(greetingPatterns);
            if (matches) {
                greetings.push(matches[0].toLowerCase());
            }
        });

        // Return most common greeting
        const greetingCounts = {};
        greetings.forEach(greeting => {
            greetingCounts[greeting] = (greetingCounts[greeting] || 0) + 1;
        });

        return Object.keys(greetingCounts).reduce((a, b) => 
            greetingCounts[a] > greetingCounts[b] ? a : b, 'hi'
        );
    }

    // Analyze formality level
    analyzeFormalityLevel(messages) {
        const formalWords = ['please', 'thank you', 'thanks', 'appreciate', 'sincerely'];
        const informalWords = ['gonna', 'wanna', 'yeah', 'yep', 'lol', 'haha', 'sup'];
        
        let formalScore = 0;
        let informalScore = 0;
        
        messages.forEach(msg => {
            const text = msg.text.toLowerCase();
            formalWords.forEach(word => {
                if (text.includes(word)) formalScore++;
            });
            informalWords.forEach(word => {
                if (text.includes(word)) informalScore++;
            });
        });

        if (formalScore > informalScore) return 'formal';
        if (informalScore > formalScore) return 'informal';
        return 'neutral';
    }

    // Analyze preferred response speed
    analyzePreferredResponseSpeed(messages) {
        // This is a simplified version - in practice, you'd analyze time gaps
        const hasUrgentKeywords = messages.some(msg => 
            /\b(urgent|asap|quickly|immediately|hurry)\b/i.test(msg.text)
        );
        return hasUrgentKeywords ? 'fast' : 'normal';
    }

    // Analyze preferred response length
    analyzePreferredResponseLength(myMessages) {
        if (myMessages.length === 0) return 'medium';
        
        const avgLength = myMessages.reduce((sum, msg) => sum + msg.text.length, 0) / myMessages.length;
        
        if (avgLength < 30) return 'short';
        if (avgLength > 80) return 'long';
        return 'medium';
    }

    // Get AI response from Python script
    async getGeminiResponse(message, contactName, contactId) {
        if (!USE_AI_RESPONSES) {
            return SIMPLE_REPLY;
        }

        try {
            // Build or update contact profile
            const contact = await this.client.getContactById(contactId);
            const contactProfile = this.buildContactProfile(contactId, contactName, contact.number);
            
            // Get extended context for better relationships
            const contextLimit = contactProfile.relationshipLevel === 'family' ? 10 : 
                               contactProfile.relationshipLevel === 'close_friend' ? 8 : 5;
            const recentMessages = this.getRecentMessages(contactId, contextLimit);
            
            return new Promise((resolve, reject) => {
                const pythonScript = path.join(__dirname, 'gemini_bot.py');
                
                // Check if Python script exists
                if (!fs.existsSync(pythonScript)) {
                    console.log('Python script not found, using simple reply');
                    resolve(this.getContextualFallback(message, contactName, contactProfile));
                    return;
                }

                // Enhanced message data with profile information
                const enhancedMessages = recentMessages.map(msg => ({
                    ...msg,
                    contactProfile: contactProfile
                }));

                const python = spawn('python', [
                    pythonScript,
                    message,
                    contactName,
                    JSON.stringify(enhancedMessages)
                ]);
                
                let result = '';
                let error = '';
                
                python.stdout.on('data', (data) => {
                    result += data.toString();
                });
                
                python.stderr.on('data', (data) => {
                    error += data.toString();
                });
                
                python.on('close', (code) => {
                    if (code === 0 && result.trim()) {
                        resolve(result.trim());
                    } else {
                        console.error('Python script error:', error);
                        resolve(this.getContextualFallback(message, contactName, contactProfile));
                    }
                });

                // Timeout after 15 seconds for better responses
                setTimeout(() => {
                    python.kill();
                    resolve(this.getContextualFallback(message, contactName, contactProfile));
                }, 15000);
            });
        } catch (error) {
            console.error('Error getting AI response:', error);
            return SIMPLE_REPLY;
        }
    }

    // Contextual fallback based on contact profile
    getContextualFallback(message, contactName, contactProfile) {
        const relationship = contactProfile?.relationshipLevel || 'acquaintance';
        const style = contactProfile?.communicationStyle || {};
        
        // Customize response based on relationship and communication style
        if (relationship === 'family') {
            return style.usesEmojis ? 
                "Hey! Busy right now but will get back to you soon ❤️" :
                "Hi! I'm busy at the moment but will respond soon.";
        } else if (relationship === 'close_friend') {
            return style.formalityLevel === 'informal' ?
                "Hey! Can't chat rn but will hit you up soon! 😊" :
                "Hi! I'm busy right now but will respond soon.";
        } else {
            return style.formalityLevel === 'formal' ?
                "Thank you for your message. I'm currently busy but will respond as soon as possible." :
                "Hi! I'm busy right now but will get back to you soon.";
        }
    }

    // Setup event handlers
    setupEventHandlers() {
        // QR Code for authentication
        this.client.on('qr', (qr) => {
            console.log('🔗 Scan this QR code with your WhatsApp:');
            qrcode.generate(qr, { small: true });
        });

        // Bot ready
        this.client.on('ready', () => {
            console.log('✅ Smart WhatsApp Bot is ready!');
            console.log('📋 Monitoring contacts:', MONITOR_CONTACTS);
            console.log('🤖 AI Responses:', USE_AI_RESPONSES ? 'Enabled' : 'Disabled');
            console.log('💾 Chat history will be saved to:', CHAT_HISTORY_FILE);
        });

        // Authentication success
        this.client.on('authenticated', () => {
            console.log('🔐 Authentication successful!');
        });

        // Authentication failure
        this.client.on('auth_failure', (msg) => {
            console.error('❌ Authentication failed:', msg);
        });

        // Handle incoming messages
        this.client.on('message', async (message) => {
            // Skip outgoing messages and status updates
            if (message.fromMe || message.isStatus) return;

            // Skip if already processed (to avoid duplicate responses)
            if (this.processedMessages.has(message.id._serialized)) return;

            try {
                console.log('📥 New message received!');
                
                // Get contact and chat info
                const contact = await message.getContact();
                const chat = await message.getChat();
                
                const contactName = contact.pushname || contact.name || 'Unknown';
                const contactNumber = contact.number;
                const contactId = contactNumber;
                
                console.log(`👤 From: ${contactName} (${contactNumber})`);
                console.log(`💬 Message: ${message.body}`);
                console.log(`📱 Chat type: ${chat.isGroup ? 'Group' : 'Individual'}`);

                // Skip group messages
                if (chat.isGroup) {
                    console.log('👥 Group message - skipping auto-reply');
                    return;
                }

                // Check if we should respond to this contact
                const shouldRespond = this.shouldMonitorContact(contactName, contactNumber);
                console.log(`🎯 Should respond: ${shouldRespond}`);

                if (!shouldRespond) {
                    console.log('❌ Contact not in monitoring list');
                    return;
                }

                // Store incoming message with enhanced metadata
                this.storeMessage(contactId, contactName, message.body, false, message.type);

                console.log('🤖 Generating context-aware response...');

                // Get AI response with profile awareness
                const aiResponse = await this.getGeminiResponse(
                    message.body,
                    contactName,
                    contactId
                );

                console.log(`💭 Response: ${aiResponse}`);

                // Send reply
                await message.reply(aiResponse);
                console.log(`✅ Reply sent to ${contactName}`);

                // Store outgoing message
                this.storeMessage(contactId, contactName, aiResponse, true);

                // Mark as processed
                this.processedMessages.add(message.id._serialized);

                // Add delay based on relationship (closer contacts get faster responses)
                const contactProfile = this.contactProfiles[contactId];
                const delay = contactProfile?.relationshipLevel === 'family' ? 2000 :
                             contactProfile?.relationshipLevel === 'close_friend' ? 3000 : 4000;
                
                await new Promise(resolve => setTimeout(resolve, delay));

            } catch (error) {
                console.error('❌ Error handling message:', error);
                console.error('Error details:', error.message);
            }
        });

        // Handle errors
        this.client.on('error', (error) => {
            console.error('❌ Client error:', error);
        });

        // Handle disconnection
        this.client.on('disconnected', (reason) => {
            console.log('🔌 Client disconnected:', reason);
        });
    }

    // Start the bot
    start() {
        console.log('🚀 Starting Smart WhatsApp Bot...');
        console.log('📋 Configuration:');
        console.log('   - Monitored contacts:', MONITOR_CONTACTS);
        console.log('   - AI responses:', USE_AI_RESPONSES ? 'Enabled' : 'Disabled');
        console.log('   - Simple reply:', SIMPLE_REPLY);
        
        this.client.initialize();
    }

    // Stop the bot gracefully
    async stop() {
        console.log('🛑 Stopping bot...');
        this.saveChatHistory();
        await this.client.destroy();
    }

    // Get chat statistics
    getChatStats() {
        const stats = {
            contacts: {},
            relationships: {},
            totalContacts: 0,
            totalMessages: this.botAnalytics.totalMessages,
            totalResponses: this.botAnalytics.totalResponses
        };

        // Contact-specific stats
        for (const [contactId, data] of Object.entries(this.chatHistory)) {
            const profile = this.contactProfiles[contactId] || {};
            stats.contacts[data.name] = {
                totalMessages: data.messages.length,
                myMessages: data.messages.filter(m => m.fromMe).length,
                theirMessages: data.messages.filter(m => !m.fromMe).length,
                relationshipLevel: profile.relationshipLevel || 'unknown',
                lastInteraction: data.lastInteraction,
                communicationStyle: profile.communicationStyle || {}
            };
        }

        // Relationship distribution
        for (const profile of Object.values(this.contactProfiles)) {
            const level = profile.relationshipLevel || 'unknown';
            stats.relationships[level] = (stats.relationships[level] || 0) + 1;
        }

        stats.totalContacts = Object.keys(this.chatHistory).length;

        return stats;
    }

    // Export contact profile
    exportContactProfile(contactId) {
        return {
            chatHistory: this.chatHistory[contactId] || null,
            profile: this.contactProfiles[contactId] || null,
            analytics: this.botAnalytics.contactInteractions[contactId] || null
        };
    }
}

// Create and start the bot
const bot = new SmartWhatsAppBot();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received interrupt signal...');
    await bot.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received terminate signal...');
    await bot.stop();
    process.exit(0);
});

// Start the bot
bot.start();

// Export for external use
module.exports = SmartWhatsAppBot;