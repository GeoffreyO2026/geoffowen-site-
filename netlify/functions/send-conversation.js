const CATEGORIES = [
  "Guilt and overwhelm",
  "Specific behaviour and not listening",
  "Diagnosis and labels",
  "Teens and older children",
  "Founders and high achievers",
  "Anger, defiance and rudeness"
];

function getMailchimpDatacenter(apiKey) {
  const parts = apiKey.split('-');
  return parts[parts.length - 1];
}

function md5(str) {
  const nodeCrypto = require('crypto');
  return nodeCrypto.createHash('md5').update(str).digest('hex');
}

function formatConversationForEmail(messages) {
  const ctaPattern = /If you'd like to talk through your question in more detail without any obligation, you're welcome to book a free 45-minute call with me here: https:\/\/calendly\.com\/geoffreyowen\/45mins\.?/g;

  return messages.map(m => {
    const speaker = m.role === 'user' ? 'You' : 'The Biologically Aligned Parenting Agent';
    let cleanContent = m.content.replace(/\{\{([^}]+)\}\}/g, '"$1"');
    cleanContent = cleanContent.replace(ctaPattern, '').trim();
    return `${speaker}:\n${cleanContent}`;
  }).join('\n\n---\n\n');
}

async function generatePersonalizedNote(messages) {
  const transcript = messages.map(m => `${m.role === 'user' ? 'Parent' : 'Agent'}: ${m.content}`).join('\n\n');

  const prompt = `Below is a conversation between a parent and an AI agent trained on Geoff Owen's Biologically Aligned Parenting framework. Based on this conversation, do three things and respond with ONLY valid JSON, no other text:

1. Pick exactly one category from this list that best fits what the parent was asking about: ${CATEGORIES.map(c => `"${c}"`).join(', ')}
2. Write a short, warm note (3-4 sentences, in Geoff's measured, non-salesy voice) that will appear at the top of an email to this parent, above the full conversation transcript. Reference what they actually discussed, specifically, not generically. Do not mention or offer a call, Calendly, or a consultation, that is not part of this email. This note will sit in front of a follow-up email that also contains general, non-personalized content reinforcing a key idea from the framework. Read the conversation carefully first: if the Agent already made a similar core point or reframe during the live conversation, do not have this note simply restate it in different words. Instead, either build on it, add a layer of nuance the live conversation did not reach, or reference it briefly as something already said ("as we touched on") rather than presenting it as new.
3. Write a short situation summary (3-4 sentences) for Geoff's own internal use, not seen by the parent, to help him write personalized follow-up emails later. Follow the framework's own diagnostic shape: the ineffective action the parent is taking or leaning toward, what is actually missing underneath the behaviour they described, and what the needed shift or action looks like for their specific situation. Write it plainly, as raw material Geoff can draw on, not as something polished or complete in itself. Use circumspect, qualifying language, not absolute claims. If the conversation was too general or brief to identify all three parts clearly, write what can genuinely be drawn from it rather than inventing detail that is not there.

In both the note and the summary: never assume the sex of the parent or of the child. Refer to the parent as "the parent" (or "you" in the note), and use a pronoun for the child only if the parent used one. Use Geoff's language of "settled" and "unsettled"; do not use clinical terms such as regulation, dysregulation or nervous system. British English. No dashes of any kind used as punctuation and no Oxford commas.

Conversation:
${transcript}

Respond with ONLY this JSON structure: {"category": "...", "note": "...", "summary": "..."}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  const text = data.content[0].text.trim();
  const cleaned = text.replace(/^```json\s*|\s*```$/g, '');
  return JSON.parse(cleaned);
}

function eveningLine() {
  const link = '<a href="https://whyismychildsoangry.co.uk" style="color:#B8972A;">whyismychildsoangry.co.uk</a>';
  if (Date.now() < Date.UTC(2026, 10, 13)) {
    return `If you'd like to go deeper, I'm running an online evening, Behind the Anger, on Thursday 12 November at 8pm. It's 75 minutes, cameras off, and I'll show what a child's anger is really asking for: ${link}`;
  }
  return `If you'd like to go deeper, my evening Behind the Anger is available to watch whenever suits you: ${link}`;
}

async function sendViaResend(email, note, transcriptText) {
  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; line-height: 1.7;">
      <p style="color:#B8972A; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 24px;">The Biologically Aligned Parenting Agent</p>
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; color: #1a1a1a; margin-bottom: 24px;">${note.replace(/\n/g, '<br>')}</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 28px 0;">
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">Your full conversation</p>
      <div style="white-space: pre-wrap; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.7; color: #1a1a1a;">${transcriptText.replace(/\n/g, '<br>')}</div>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 28px 0;">
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; color: #1a1a1a; margin-bottom: 16px;">${eveningLine()}</p>
      <p style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; color: #1a1a1a; margin-bottom: 16px;">You may also find my free guide helpful: <a href="https://geoffreyowen.com/guide/download" style="color:#B8972A;">https://geoffreyowen.com/guide/download</a></p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_KEY}`
    },
    body: JSON.stringify({
      from: 'Geoff Owen <geoff@geoffreyowen.com>',
      to: [email],
      subject: 'Your conversation, plus the guide link',
      html: html
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Resend error: ' + errText);
  }
}

function truncateForMailchimp(text) {
  if (!text) return '';
  if (text.length <= 255) return text;
  return text.slice(0, 252).trim() + '...';
}

async function addToMailchimp(email, category, note, summary) {
  const apiKey = process.env.BAP_BOT_EMAIL_KEY;
  const dc = getMailchimpDatacenter(apiKey);
  const listId = 'a14cc081db';
  const hash = md5(email.toLowerCase());

  const memberResponse = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members/${hash}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      email_address: email,
      status_if_new: 'subscribed',
      merge_fields: {
        MMERGE6: truncateForMailchimp(note),
        MMERGE5: truncateForMailchimp(summary)
      }
    })
  });

  if (!memberResponse.ok) {
    const errText = await memberResponse.text();
    throw new Error('Mailchimp member error: ' + errText);
  }

  const tagResponse = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members/${hash}/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      tags: [{ name: category, status: 'active' }]
    })
  });

  if (!tagResponse.ok) {
    const errText = await tagResponse.text();
    throw new Error('Mailchimp tag error: ' + errText);
  }
}

async function addToRevRepeat(email, category, note, summary) {
  const url = process.env.REVREPEAT_WEBHOOK_URL;
  if (!url) throw new Error('REVREPEAT_WEBHOOK_URL is not set');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, category, note, summary, source: 'BAP Agent' })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error('RevRepeat webhook error: ' + errText);
  }
}

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { email, messages } = JSON.parse(event.body);

    if (!email || !email.includes('@') || !messages || !messages.length) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing or invalid email or conversation.' })
      };
    }

    const { category, note, summary } = await generatePersonalizedNote(messages);
    const transcriptText = formatConversationForEmail(messages);

    await sendViaResend(email, note, transcriptText);
    try {
      await addToRevRepeat(email, category, note, summary);
    } catch (crmErr) {
      console.error('RevRepeat error:', crmErr);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Something went wrong sending that. Please try again.' })
    };
  }
};
