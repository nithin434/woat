const fs = require('fs');
const path = require('path');

class ConfigLoader {
    constructor() {
        this.configFile = path.join(__dirname, 'config.json');
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const data = fs.readFileSync(this.configFile, 'utf8');
                const config = JSON.parse(data);
                
                // Validate required fields
                this.validateConfig(config);
                
                return config;
            } else {
                console.log('⚠️ config.json not found, using default values');
                return this.getDefaultConfig();
            }
        } catch (error) {
            console.error('❌ Error loading config.json:', error.message);
            console.log('Using default configuration...');
            return this.getDefaultConfig();
        }
    }

    validateConfig(config) {
        const required = ['MONITOR_CONTACTS', 'USE_AI_RESPONSES', 'SIMPLE_REPLY'];
        
        for (const field of required) {
            if (!(field in config)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!Array.isArray(config.MONITOR_CONTACTS)) {
            throw new Error('MONITOR_CONTACTS must be an array');
        }

        if (typeof config.USE_AI_RESPONSES !== 'boolean') {
            throw new Error('USE_AI_RESPONSES must be a boolean');
        }
    }

    getDefaultConfig() {
        return {
            MONITOR_CONTACTS: ["Mom", "Dad", "Friend"],
            USE_AI_RESPONSES: true,
            SIMPLE_REPLY: "Hi! I'm busy right now, will get back to you soon! 😊",
            GEMINI_API_KEY: "YOUR_API_KEY_HERE"
        };
    }

    get(key) {
        return this.config[key];
    }

    set(key, value) {
        this.config[key] = value;
        this.saveConfig();
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('❌ Error saving config:', error.message);
        }
    }

    // Add method to check if distribution is ready
    isDistributionReady() {
        const apiKey = this.config.GEMINI_API_KEY;
        const contacts = this.config.MONITOR_CONTACTS;
        
        const hasValidApiKey = apiKey && apiKey !== "YOUR_API_KEY_HERE" && apiKey.length > 10;
        const hasValidContacts = Array.isArray(contacts) && contacts.length > 0 && 
                                !contacts.includes("Mom") && !contacts.includes("Dad");
        
        return {
            ready: hasValidApiKey && hasValidContacts,
            issues: {
                apiKey: !hasValidApiKey,
                contacts: !hasValidContacts
            }
        };
    }
}

module.exports = new ConfigLoader();
