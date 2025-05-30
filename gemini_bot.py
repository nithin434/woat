import google.generativeai as genai
import sys
import json
import os
from datetime import datetime
import logging
import re
from collections import Counter

# Configure logging
logging.basicConfig(level=logging.ERROR, format='%(asctime)s - %(levelname)s - %(message)s')

# Configuration
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"  # Replace with your actual API key
MODEL_NAME = "gemini-pro"

# Communication style file
STYLE_PROFILE_FILE = "communication_style.json"

# Enhanced personality settings
BOT_PERSONALITY = """
You are responding as the owner of this WhatsApp account. Your responses should be:
- Natural and conversational, matching the user's established communication style
- Brief (1-2 sentences usually, max 3) unless the context requires longer responses
- Appropriate to the relationship level with the contact
- In the same language as the incoming message
- Sound like a real person, not an AI assistant
- Maintain consistency with your past communication patterns
"""

def setup_gemini():
    try:
        if GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
            raise ValueError("Please set your actual Gemini API key in the script")
        
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(MODEL_NAME)
        return model
    except Exception as e:
        logging.error(f"Failed to setup Gemini: {e}")
        return None

def analyze_communication_style(messages):
    """Analyze communication patterns from past messages"""
    if not messages:
        return {}
    
    # Filter only user's own messages
    user_messages = [msg['text'] for msg in messages if msg.get('fromMe', False)]
    
    if not user_messages:
        return {}
    
    style_analysis = {
        'avg_message_length': sum(len(msg) for msg in user_messages) / len(user_messages),
        'uses_emojis': bool(re.search(r'[😀-🙏]', ' '.join(user_messages))),
        'uses_abbreviations': bool(re.search(r'\b(u|ur|r|n|y|k|lol|brb|ttyl|omg|btw)\b', ' '.join(user_messages).lower())),
        'punctuation_style': analyze_punctuation(user_messages),
        'greeting_style': analyze_greetings(user_messages),
        'formality_level': analyze_formality(user_messages),
        'response_patterns': analyze_response_patterns(user_messages)
    }
    
    return style_analysis

def analyze_punctuation(messages):
    """Analyze punctuation usage patterns"""
    all_text = ' '.join(messages)
    
    patterns = {
        'uses_periods': '.' in all_text,
        'uses_exclamation': '!' in all_text,
        'uses_question_marks': '?' in all_text,
        'uses_multiple_punctuation': bool(re.search(r'[.!?]{2,}', all_text)),
        'uses_ellipsis': '...' in all_text or '…' in all_text
    }
    
    return patterns

def analyze_greetings(messages):
    """Analyze greeting patterns"""
    greetings = []
    greeting_patterns = [
        r'\b(hi|hello|hey|hiya|sup|wassup|yo)\b',
        r'\b(good morning|good afternoon|good evening|good night)\b',
        r'\b(how are you|how r u|what\'s up|how\'s it going)\b'
    ]
    
    for msg in messages:
        for pattern in greeting_patterns:
            if re.search(pattern, msg.lower()):
                greetings.append(msg.lower())
                break
    
    return {
        'common_greetings': list(set(greetings))[:5],
        'greeting_frequency': len(greetings) / len(messages) if messages else 0
    }

def analyze_formality(messages):
    """Analyze formality level"""
    formal_indicators = ['please', 'thank you', 'thanks', 'appreciate', 'sincerely', 'regards']
    informal_indicators = ['gonna', 'wanna', 'gotta', 'yeah', 'yep', 'nah', 'lol', 'haha']
    
    all_text = ' '.join(messages).lower()
    
    formal_count = sum(1 for word in formal_indicators if word in all_text)
    informal_count = sum(1 for word in informal_indicators if word in all_text)
    
    if formal_count > informal_count:
        return 'formal'
    elif informal_count > formal_count:
        return 'informal'
    else:
        return 'neutral'

def analyze_response_patterns(messages):
    """Analyze response patterns and preferences"""
    patterns = {
        'asks_questions': sum(1 for msg in messages if '?' in msg) / len(messages) if messages else 0,
        'gives_explanations': sum(1 for msg in messages if len(msg) > 50) / len(messages) if messages else 0,
        'uses_short_responses': sum(1 for msg in messages if len(msg) <= 10) / len(messages) if messages else 0
    }
    
    return patterns

def load_communication_style():
    """Load saved communication style profile"""
    try:
        if os.path.exists(STYLE_PROFILE_FILE):
            with open(STYLE_PROFILE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logging.error(f"Error loading communication style: {e}")
    
    return {}

def save_communication_style(style_data):
    """Save communication style profile"""
    try:
        with open(STYLE_PROFILE_FILE, 'w', encoding='utf-8') as f:
            json.dump(style_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logging.error(f"Error saving communication style: {e}")

def determine_relationship_level(contact_name, previous_messages):
    """Determine relationship level based on conversation history"""
    if not previous_messages:
        return 'acquaintance'
    
    message_count = len(previous_messages)
    avg_length = sum(len(msg.get('text', '')) for msg in previous_messages) / message_count
    
    # Analyze conversation patterns
    personal_indicators = ['love', 'miss', 'family', 'home', 'work', 'feeling', 'tired', 'busy']
    casual_indicators = ['lol', 'haha', 'dude', 'bro', 'hey', 'sup']
    
    all_text = ' '.join([msg.get('text', '') for msg in previous_messages]).lower()
    
    personal_score = sum(1 for word in personal_indicators if word in all_text)
    casual_score = sum(1 for word in casual_indicators if word in all_text)
    
    # Determine relationship level
    if message_count > 50 and (personal_score > 3 or 'mom' in contact_name.lower() or 'dad' in contact_name.lower()):
        return 'close_family'
    elif message_count > 20 and (personal_score > 2 or casual_score > 3):
        return 'close_friend'
    elif message_count > 10:
        return 'friend'
    else:
        return 'acquaintance'

def build_enhanced_context(contact_name, previous_messages):
    """Build enhanced context with tone and relationship analysis"""
    context = f"You are chatting with {contact_name}."
    
    if previous_messages and len(previous_messages) > 0:
        # Analyze communication style
        style_analysis = analyze_communication_style(previous_messages)
        relationship_level = determine_relationship_level(contact_name, previous_messages)
        
        # Load global communication style
        global_style = load_communication_style()
        
        # Update global style with new analysis
        if style_analysis:
            global_style.update(style_analysis)
            save_communication_style(global_style)
        
        context += f"\n\nRelationship level: {relationship_level}"
        
        # Add style guidance
        if style_analysis:
            context += "\n\nYour communication style analysis:"
            if style_analysis.get('formality_level'):
                context += f"\n- Formality: {style_analysis['formality_level']}"
            if style_analysis.get('uses_emojis'):
                context += f"\n- Emoji usage: {'Yes' if style_analysis['uses_emojis'] else 'No'}"
            if style_analysis.get('uses_abbreviations'):
                context += f"\n- Abbreviations: {'Yes' if style_analysis['uses_abbreviations'] else 'No'}"
            if style_analysis.get('avg_message_length'):
                context += f"\n- Average message length: {style_analysis['avg_message_length']:.0f} characters"
        
        context += "\n\nRecent conversation:\n"
        # Show more context for close relationships
        msg_limit = 8 if relationship_level in ['close_family', 'close_friend'] else 5
        recent_messages = previous_messages[-msg_limit:]
        
        for msg in recent_messages:
            sender = "You" if msg.get('fromMe', False) else contact_name
            message_text = msg.get('text', '')
            
            # Add message to context
            if len(message_text) > 150:
                message_text = message_text[:150] + "..."
            
            context += f"{sender}: {message_text}\n"
    else:
        context += " This is the start of your conversation."
    
    return context

def generate_response(user_message, contact_name, previous_messages=None):
    """Generate contextual response with tone matching"""
    try:
        # Setup Gemini
        model = setup_gemini()
        if not model:
            return "Sorry, I'm having trouble right now. Will get back to you soon!"
        
        # Build enhanced context
        context = build_enhanced_context(contact_name, previous_messages or [])
        
        # Analyze current message sentiment and urgency
        message_analysis = analyze_current_message(user_message)
        
        # Create the enhanced prompt
        prompt = f"""
        {BOT_PERSONALITY}
        
        {context}
        
        Message analysis:
        - Urgency level: {message_analysis.get('urgency', 'normal')}
        - Sentiment: {message_analysis.get('sentiment', 'neutral')}
        - Question type: {message_analysis.get('question_type', 'none')}
        
        New message from {contact_name}: "{user_message}"
        
        Respond naturally as the phone owner, matching your established communication style:
        - Match the formality level of your past messages
        - Use similar punctuation patterns
        - Maintain consistency with emoji usage
        - Consider the relationship level with {contact_name}
        - Don't mention you're an AI or analyzing communication patterns
        - If asked about availability, respond based on the relationship level
        - Keep responses appropriate to the urgency and sentiment of their message
        """
        
        # Generate response
        response = model.generate_content(prompt)
        
        if response and response.text:
            return response.text.strip()
        else:
            return get_contextual_fallback_response(user_message, contact_name, previous_messages)
            
    except Exception as e:
        logging.error(f"Error generating response: {e}")
        return get_contextual_fallback_response(user_message, contact_name, previous_messages)

def analyze_current_message(message):
    """Analyze the current incoming message"""
    message_lower = message.lower()
    
    # Urgency analysis
    urgent_keywords = ['urgent', 'emergency', 'asap', 'immediately', 'help', 'problem', 'issue', 'quickly']
    urgency = 'high' if any(word in message_lower for word in urgent_keywords) else 'normal'
    
    # Sentiment analysis (basic)
    positive_words = ['good', 'great', 'awesome', 'happy', 'excited', 'love', 'thank']
    negative_words = ['bad', 'terrible', 'sad', 'angry', 'upset', 'disappointed', 'hate']
    
    positive_count = sum(1 for word in positive_words if word in message_lower)
    negative_count = sum(1 for word in negative_words if word in message_lower)
    
    if positive_count > negative_count:
        sentiment = 'positive'
    elif negative_count > positive_count:
        sentiment = 'negative'
    else:
        sentiment = 'neutral'
    
    # Question type analysis
    question_type = 'none'
    if '?' in message:
        if any(word in message_lower for word in ['when', 'what time', 'schedule']):
            question_type = 'timing'
        elif any(word in message_lower for word in ['where', 'location']):
            question_type = 'location'
        elif any(word in message_lower for word in ['how', 'why']):
            question_type = 'explanation'
        elif any(word in message_lower for word in ['can you', 'could you', 'will you']):
            question_type = 'request'
        else:
            question_type = 'general'
    
    return {
        'urgency': urgency,
        'sentiment': sentiment,
        'question_type': question_type
    }

def get_contextual_fallback_response(message, contact_name, previous_messages):
    """Enhanced fallback responses based on context"""
    message_lower = message.lower()
    relationship = determine_relationship_level(contact_name, previous_messages or [])
    
    # Relationship-based responses
    if relationship == 'close_family':
        greeting_responses = [
            f"Hi {contact_name}! Just busy with some work, will catch up soon! ❤️",
            f"Hey! Can't talk right now but will call you later today 😊"
        ]
        general_responses = [
            "I'm tied up right now but will get back to you soon!",
            "Give me a bit of time and I'll respond properly ❤️"
        ]
    elif relationship == 'close_friend':
        greeting_responses = [
            f"Hey {contact_name}! Busy rn but will hit you up soon! 😊",
            f"Sup! Can't chat now but will text you back soon"
        ]
        general_responses = [
            "Busy right now but will get back to you!",
            "Give me a sec, will respond soon! 😊"
        ]
    else:
        greeting_responses = [
            f"Hi {contact_name}! I'm busy at the moment but will respond soon.",
            f"Hello! Can't talk right now but will get back to you."
        ]
        general_responses = [
            "Thanks for your message! I'll respond when I'm free.",
            "I'm busy right now but will get back to you soon."
        ]
    
    # Context-based responses
    if any(word in message_lower for word in ['hello', 'hi', 'hey', 'good morning', 'good evening']):
        return greeting_responses[0]
    
    elif any(word in message_lower for word in ['how are you', 'how r u', 'what\'s up', 'wassup']):
        return "I'm doing well, thanks! Just caught up with work right now. How about you?"
    
    elif any(word in message_lower for word in ['call', 'phone', 'ring']):
        if relationship == 'close_family':
            return "Can't take calls right now but will call you back soon! ❤️"
        else:
            return "Can't take calls at the moment, but will call you back later!"
    
    elif any(word in message_lower for word in ['urgent', 'important', 'emergency']):
        return "Got your message! If it's really urgent, please call. Otherwise I'll respond soon."
    
    elif '?' in message:
        return "Thanks for your question! I'll get back to you with an answer soon."
    
    else:
        return general_responses[0]

def main():
    """Main function to handle command line arguments"""
    try:
        if len(sys.argv) < 3:
            print("Error: Insufficient arguments")
            print("Usage: python gemini_bot.py <message> <contact_name> [previous_messages_json]")
            sys.exit(1)
        
        user_message = sys.argv[1]
        contact_name = sys.argv[2]
        previous_messages = []
        
        # Parse previous messages if provided
        if len(sys.argv) > 3:
            try:
                previous_messages = json.loads(sys.argv[3])
            except json.JSONDecodeError:
                logging.error("Invalid JSON for previous messages")
                previous_messages = []
        
        # Generate and print response
        response = generate_response(user_message, contact_name, previous_messages)
        print(response)
        
    except KeyboardInterrupt:
        logging.info("Script interrupted by user")
        sys.exit(0)
    except Exception as e:
        logging.error(f"Unexpected error: {e}")
        print("Sorry, I'm having trouble responding right now. Will get back to you soon!")
        sys.exit(1)

if __name__ == "__main__":
    main()