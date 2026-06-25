export const metadata = {
  title: "Privacy Policy — Linear Mail",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '64px 32px', fontFamily: 'Inter, sans-serif', lineHeight: '1.7', color: '#111827' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>Privacy Policy</h1>
      <p style={{ color: '#6b7280', marginBottom: '40px' }}>Last updated: June 2026</p>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '12px' }}>What is Linear Mail?</h2>
        <p>Linear Mail is a personal email client that connects to your Google Gmail account. It lets you read, send, organise, and search your email, and optionally uses Google Gemini AI to summarise emails and suggest replies.</p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '12px' }}>What data we access</h2>
        <p>When you sign in with Google, Linear Mail requests permission to:</p>
        <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
          <li>Read, compose, send, and permanently delete your emails (<code>gmail.modify</code>)</li>
          <li>Manage your Gmail labels and filters (<code>gmail.settings.basic</code>)</li>
          <li>Manage your Send-As aliases (<code>gmail.settings.sharing</code>)</li>
          <li>Access your basic Google profile (name, email address, profile picture)</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '12px' }}>How we use your data</h2>
        <ul style={{ paddingLeft: '24px' }}>
          <li>Your OAuth tokens are stored in our database solely to authenticate API requests to Gmail on your behalf.</li>
          <li>Email content is never stored on our servers. It is fetched from Gmail in real time and displayed to you.</li>
          <li>We store minimal metadata (email subject, recipient, sent timestamp) only for the email open-tracking feature, and only for emails you choose to send.</li>
          <li>Your email signature and organisation rules are stored to apply your preferences across sessions.</li>
          <li>If you use the AI features, the email text is sent to Google Gemini API. No email content is stored by us for AI purposes.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '12px' }}>Data sharing</h2>
        <p>We do not sell, rent, or share your personal data or email content with any third party, except:</p>
        <ul style={{ paddingLeft: '24px', marginTop: '8px' }}>
          <li><strong>Google Gmail API</strong> — to read and send your email</li>
          <li><strong>Google Gemini API</strong> — only when you explicitly click Summarise or Smart Reply</li>
        </ul>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '12px' }}>Data retention and deletion</h2>
        <p>You can disconnect your account at any time by clicking Sign Out and then revoking Linear Mail&apos;s access from your <a href="https://myaccount.google.com/permissions" style={{ color: '#4f46e5' }}>Google account permissions page</a>. This removes all stored OAuth tokens. Any tracking metadata associated with your account is deleted on request — email us to request deletion.</p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '12px' }}>Security</h2>
        <p>OAuth tokens are stored encrypted at rest in a managed PostgreSQL database. We use HTTPS for all communication. We never store your Google password.</p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '12px' }}>Google API Limited Use disclosure</h2>
        <p>Linear Mail&apos;s use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" style={{ color: '#4f46e5' }}>Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '12px' }}>Contact</h2>
        <p>Questions about this policy? Email <a href="mailto:shool007@gmail.com" style={{ color: '#4f46e5' }}>shool007@gmail.com</a>.</p>
      </section>

      <p style={{ marginTop: '48px', fontSize: '0.85rem', color: '#9ca3af' }}>Linear Mail is operated by Linear Ventures, India.</p>
    </div>
  );
}

