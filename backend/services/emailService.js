import nodemailer from 'nodemailer';

// Create reusable transporter
const createTransporter = () => {
  // For development, use ethereal.email (fake SMTP)
  // For production, use real SMTP credentials from environment variables
  
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  
  // Fallback to console logging in development
  return {
    sendMail: async (mailOptions) => {
      console.log('📧 Email would be sent:');
      console.log('To:', mailOptions.to);
      console.log('Subject:', mailOptions.subject);
      console.log('HTML:', mailOptions.html);
      console.log('---');
      return { messageId: 'dev-mode-' + Date.now() };
    }
  };
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const transporter = createTransporter();
  
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"GeekFights" <noreply@geekfights.com>',
    to: email,
    subject: 'Password Reset Request - GeekFights',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #0a0a0a;
            color: #ffffff;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
            border-radius: 16px;
            padding: 40px;
            border: 2px solid #ff6b00;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            color: #ff6b00;
          }
          .content {
            line-height: 1.8;
            color: #cccccc;
          }
          .button {
            display: inline-block;
            margin: 30px 0;
            padding: 15px 40px;
            background: linear-gradient(135deg, #ff6b00, #ff9900);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
          }
          .button:hover {
            background: linear-gradient(135deg, #ff7700, #ffaa00);
          }
          .warning {
            margin-top: 30px;
            padding: 15px;
            background: rgba(255, 107, 0, 0.1);
            border-left: 4px solid #ff6b00;
            font-size: 14px;
            color: #aaaaaa;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #333;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🥊 GeekFights</div>
          </div>
          
          <div class="content">
            <h2 style="color: #ff6b00;">Password Reset Request</h2>
            
            <p>Hello,</p>
            
            <p>We received a request to reset the password for your GeekFights account associated with this email address.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #ff6b00;">${resetUrl}</p>
            
            <div class="warning">
              <strong>⚠️ Important:</strong><br>
              • This link will expire in 1 hour<br>
              • If you didn't request this, please ignore this email<br>
              • Your password will remain unchanged unless you click the link
            </div>
          </div>
          
          <div class="footer">
            <p>© 2026 GeekFights. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};
