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
      max_tokens: 2,
      messages: [
        {
          role: 'system',
          content:
            "You are a strict content moderation filter for a children's app (ages 4–15). If a message contains profanity, hate speech, insults, sexual or erotic content, even implied or in slang or hidden form (such as double meaning, innuendo, sexual puns, suggestive phrases), or anything inappropriate — reply: wonchoe. Otherwise reply '1'. You must reply only with wonchoe or 1 — no explanation, no punctuation, no quotes, no reasoning."
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
