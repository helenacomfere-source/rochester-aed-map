/*
 * contact.js — the contact form, and a guard against shipping a placeholder address.
 *
 * Like the AED submission form, this has no backend of its own. FormSubmit
 * (formsubmit.co) accepts the POST and forwards it to the team inbox. Sending from
 * the page means a visitor never has to open a mail app, which most people on
 * phones do not have set up at all.
 *
 * ONE TIME ONLY: the first message sent through FormSubmit triggers a
 * confirmation email to the team inbox. Nothing is delivered until that link is
 * clicked. Send one test message and confirm it before launch.
 */

// FormSubmit's stand-in code for our address. Using this instead of the raw
// email keeps our address out of the page source, where spam crawlers
// harvest anything shaped like an address. Messages arrive exactly the same.
const FORM_TOKEN = 'cadcfa452e63b1e3636e383934523c12';
const FORM_ENDPOINT = 'https://formsubmit.co/ajax/' + FORM_TOKEN;

// Shown only if sending fails, so someone always has a way to reach us.
const AEDS_EMAIL = 'aedsteam1@gmail.com';

const PLACEHOLDER_MARKERS = ['REPLACE-ME', 'example.org', 'example.com'];

function checkContactPlaceholder() {
  const link = document.getElementById('contact-mailto');
  const warning = document.getElementById('contact-placeholder-warning');
  if (!link || !warning) return;

  const address = (link.getAttribute('href') || '') + ' ' + (link.textContent || '');
  warning.hidden = !PLACEHOLDER_MARKERS.some((m) =>
    address.toLowerCase().includes(m.toLowerCase())
  );
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function showResult(html, isError) {
  const out = document.getElementById('contact-result');
  out.className = 'form-result ' + (isError ? 'form-result-error' : 'form-result-ok');
  out.style.display = 'block';
  out.innerHTML = html;
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function handleContactSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('c-name').value.trim();
  const email = document.getElementById('c-email').value.trim();
  const topic = document.getElementById('c-topic').value;
  const message = document.getElementById('c-message').value.trim();

  // Bots fill in every field they find. Humans never see this one.
  if (document.getElementById('c-website').value) return;

  if (!name || !email || !message) {
    alert('Please fill in your name, email, and message.');
    return;
  }

  const button = document.querySelector('#contact-form button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Sending…';

  const payload = {
    _subject: `Contact form: ${topic}`,
    _template: 'table',
    _captcha: 'false',
    // FormSubmit uses this to set Reply-To, so replying goes to the sender.
    _replyto: email,
    Name: name,
    Email: email,
    Topic: topic,
    Message: message,
  };

  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    showResult(
      `<h3>Message sent</h3>
       <p>Thank you, ${escapeHTML(name)} — we have your message and will reply to
       <strong>${escapeHTML(email)}</strong>, usually within a few days.</p>
       <p>If this is about an emergency happening right now, call
       <a href="tel:911">911</a> instead. This inbox is not monitored around the clock.</p>`,
      false
    );
    document.getElementById('contact-form').reset();
  } catch (err) {
    // Don't let someone lose what they wrote. Show it, and give them the address.
    showResult(
      `<h3>That didn't send</h3>
       <p>Something went wrong reaching our form service. Please email us directly at
       <a href="mailto:${AEDS_EMAIL}?subject=${encodeURIComponent(topic)}">${AEDS_EMAIL}</a>
       and paste your message below so nothing is lost.</p>
       <pre>${escapeHTML(message)}</pre>`,
      true
    );
  } finally {
    button.disabled = false;
    button.textContent = 'Send message';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkContactPlaceholder();
  const form = document.getElementById('contact-form');
  if (form) form.addEventListener('submit', handleContactSubmit);
});
