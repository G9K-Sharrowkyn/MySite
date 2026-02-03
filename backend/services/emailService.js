import nodemailer from 'nodemailer';

const APP_NAME = 'VersusVerseVault';

const createTransporter = () => {
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  return {
    sendMail: async (mailOptions) => {
      console.log('[email:dev] to:', mailOptions.to);
      console.log('[email:dev] subject:', mailOptions.subject);
      console.log('[email:dev] html:', mailOptions.html);
      return { messageId: `dev-${Date.now()}` };
    }
  };
};

const buildBaseHtml = ({ title, intro, body, ctaLabel, ctaHref, footer }) => `
  <div style="font-family:Arial,sans-serif;background:#0f1220;color:#f4f6ff;padding:24px">
    <div style="max-width:640px;margin:0 auto;background:#171b2e;border:1px solid #2f375b;border-radius:12px;padding:24px">
      <h1 style="margin:0 0 8px;color:#ff7b2f;font-size:28px">${APP_NAME}</h1>
      <h2 style="margin:0 0 18px;font-size:20px;color:#ffffff">${title}</h2>
      <p style="margin:0 0 12px;line-height:1.5">${intro}</p>
      <div style="line-height:1.6;color:#d2d8ef">${body}</div>
      ${
        ctaLabel && ctaHref
          ? `<p style="margin:22px 0 0"><a href="${ctaHref}" style="display:inline-block;background:#ff7b2f;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">${ctaLabel}</a></p>`
          : ''
      }
      <p style="margin:24px 0 0;font-size:12px;color:#94a0ce">${footer}</p>
    </div>
  </div>
`;

const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || `"${APP_NAME}" <noreply@versusversevault.com>`;
  return transporter.sendMail({ from, to, subject, html });
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const html = buildBaseHtml({
    title: 'Password reset',
    intro: 'We received a request to reset your password.',
    body: `
      <p>Use the button below to set a new password.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p>This link expires in 1 hour.</p>
      <p style="word-break:break-all"><strong>Direct link:</strong> ${resetUrl}</p>
    `,
    ctaLabel: 'Reset password',
    ctaHref: resetUrl,
    footer: 'This is an automated message.'
  });

  const info = await sendEmail({
    to: email,
    subject: `${APP_NAME} - Password reset request`,
    html
  });
  console.log('Password reset email sent:', info.messageId);
};

export const sendEmailVerificationEmail = async (email, verificationToken) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
  const html = buildBaseHtml({
    title: 'Verify your email',
    intro: 'Please verify your email address to activate your account.',
    body: `
      <p>After verification, you can log in normally and use all features.</p>
      <p>This verification link expires in 24 hours.</p>
      <p style="word-break:break-all"><strong>Direct link:</strong> ${verifyUrl}</p>
    `,
    ctaLabel: 'Verify email',
    ctaHref: verifyUrl,
    footer: 'If you did not create this account, please ignore this email.'
  });

  const info = await sendEmail({
    to: email,
    subject: `${APP_NAME} - Verify your email`,
    html
  });
  console.log('Email verification sent:', info.messageId);
};

export const sendTwoFactorCodeEmail = async (email, code) => {
  const html = buildBaseHtml({
    title: 'Security code',
    intro: 'A sign-in attempt requires additional verification.',
    body: `
      <p>Your one-time security code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#ffb267">${code}</p>
      <p>The code expires in 10 minutes.</p>
    `,
    footer: 'If this was not you, change your password immediately.'
  });

  const info = await sendEmail({
    to: email,
    subject: `${APP_NAME} - Security code`,
    html
  });
  console.log('2FA code email sent:', info.messageId);
};
