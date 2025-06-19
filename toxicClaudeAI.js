const axios = require('axios');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
const CHATLOG_ENDPOINT = 'https://cursor.style/chatlogs';

const openrouterEnabled = !!OPENROUTER_KEY;

async function toxicClaudeAI(text) {
  if (!openrouterEnabled) { 
    console.log('NO API KEY');
    return false;
  }

  try {
    const payload = {
      model: 'anthropic/claude-3-haiku',
      temperature: 0.0,
      max_tokens: 30,
      seed: Date.now(),
      messages: [
        {
          role: 'system',
          content:
            "You are a content moderation filter for a children's app (ages 4–15). Mark a message toxic ONLY if it contains clear profanity, hate speech, insults, or explicit content. Do NOT mark educational mentions like 'bad words' or polite questions. Reply ONLY with 'wonchoe' if toxic or '1' if clean."
        },
        {
          role: 'user',
          content: `Message: "${text}"`
        }
      ]
    };

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'User-Agent': 'OpenRouter/1.0'
      },
      timeout: 7000
    });

    const reply = response.data.choices[0].message.content.trim().toLowerCase();
    const isToxic = reply.startsWith('wonch');
    
    console.log('[🧠 CLAUDE DEBUG]', text, '=>', reply, '| toxic:', isToxic);

    if (isToxic) {
      console.log('[🚫 CLAUDE MARKED TOXIC]', text);

      try {
        await axios.post(CHATLOG_ENDPOINT, {
          toxic: true,
          source: 'openrouter-check',
          fullText: text
        });
      } catch (logErr) {
        console.warn('[⚠️ Claude log post failed]', logErr.message);
      }
    }

    return isToxic;
  } catch (err) {
    try {
      console.error('[chatlogs failed]', err.message);
      await axios.post(CHATLOG_ENDPOINT, {
        error: true,
        source: 'openrouter-check',
        message: err.message || 'Unknown error',
        fullText: text
      });
    } catch (e) {
      console.error('[chatlogs fallback failed]', e.message);
    }
    return false;
  }
}

module.exports = {
  toxicClaudeAI
};
