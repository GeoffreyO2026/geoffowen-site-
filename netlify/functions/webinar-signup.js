function getMailchimpDatacenter(apiKey) {
  const parts = apiKey.split('-');
  return parts[parts.length - 1];
}

function md5(str) {
  const nodeCrypto = require('crypto');
  return nodeCrypto.createHash('md5').update(str).digest('hex');
}

async function addToMailchimp(email, name) {
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
        FNAME: name || ''
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
      tags: [{ name: 'Webinar Waitlist', status: 'active' }]
    })
  });

  if (!tagResponse.ok) {
    const errText = await tagResponse.text();
    throw new Error('Mailchimp tag error: ' + errText);
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
    const { email, name } = JSON.parse(event.body);

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing or invalid email.' })
      };
    }

    await addToMailchimp(email, name);

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
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
    };
  }
};
