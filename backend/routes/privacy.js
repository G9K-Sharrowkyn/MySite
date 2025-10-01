import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * Get Privacy Policy
 * @route GET /api/privacy/policy
 * @access Public
 */
router.get('/policy', (req, res) => {
  const privacyPolicy = {
    lastUpdated: new Date('2025-01-01'),
    content: `
# Privacy Policy

## 1. Information We Collect
We collect information you provide directly to us, including:
- Email address and password (encrypted)
- Username and profile information
- User-generated content (posts, comments, votes)
- Usage data and analytics

## 2. How We Use Your Information
We use the information we collect to:
- Provide, maintain, and improve our services
- Process your transactions and manage your account
- Send you technical notices and support messages
- Monitor and analyze trends and usage
- Detect and prevent fraud and abuse

## 3. Data Sharing and Disclosure
We do not sell your personal information. We may share your information:
- With your consent
- To comply with legal obligations
- To protect our rights and prevent fraud

## 4. Your Rights (GDPR & CCPA)
You have the right to:
- Access your personal data
- Correct inaccurate data
- Request deletion of your data
- Object to processing of your data
- Export your data in a portable format
- Withdraw consent at any time

## 5. Data Retention
We retain your information for as long as your account is active or as needed to provide services.

## 6. Security
We implement appropriate security measures to protect your data.

## 7. Cookies
We use cookies to improve your experience. You can control cookie preferences in your browser.

## 8. International Data Transfers
Your data may be transferred to and processed in countries other than your own.

## 9. Changes to This Policy
We may update this policy from time to time. We will notify you of significant changes.

## 10. Contact Us
For privacy-related inquiries, contact us at privacy@example.com
    `.trim()
  };

  res.json(privacyPolicy);
});

/**
 * Get Terms of Service
 * @route GET /api/privacy/terms
 * @access Public
 */
router.get('/terms', (req, res) => {
  const termsOfService = {
    lastUpdated: new Date('2025-01-01'),
    content: `
# Terms of Service

## 1. Acceptance of Terms
By accessing and using this service, you accept and agree to be bound by these Terms of Service.

## 2. User Accounts
- You must be at least 13 years old to use this service
- You are responsible for maintaining the security of your account
- You must not share your account credentials
- One person may not maintain multiple accounts

## 3. User Content
- You retain ownership of content you create
- You grant us a license to use, display, and distribute your content
- You must not post illegal, harmful, or offensive content
- We reserve the right to remove content that violates these terms

## 4. Acceptable Use
You agree not to:
- Violate any laws or regulations
- Infringe on intellectual property rights
- Harass, abuse, or harm others
- Spam or engage in unauthorized advertising
- Attempt to gain unauthorized access to the service

## 5. Intellectual Property
- The service and its content are protected by copyright and other laws
- You may not copy, modify, or distribute our content without permission

## 6. Termination
We reserve the right to suspend or terminate your account for violations of these terms.

## 7. Disclaimers
- The service is provided "as is" without warranties
- We are not liable for user-generated content
- We do not guarantee uninterrupted or error-free service

## 8. Limitation of Liability
We are not liable for any indirect, incidental, or consequential damages.

## 9. Governing Law
These terms are governed by applicable international laws.

## 10. Changes to Terms
We may modify these terms at any time. Continued use constitutes acceptance.

## 11. Contact
For questions about these terms, contact us at support@example.com
    `.trim()
  };

  res.json(termsOfService);
});

/**
 * Get Cookie Policy
 * @route GET /api/privacy/cookies
 * @access Public
 */
router.get('/cookies', (req, res) => {
  const cookiePolicy = {
    lastUpdated: new Date('2025-01-01'),
    content: `
# Cookie Policy

## What Are Cookies?
Cookies are small text files stored on your device when you visit our website.

## Types of Cookies We Use

### Essential Cookies
Required for the website to function properly:
- Authentication tokens
- Session management
- Security features

### Analytics Cookies
Help us understand how visitors use our site:
- Page views and navigation
- User interactions
- Performance metrics

### Preference Cookies
Remember your settings and preferences:
- Language preferences
- Theme selections
- Display settings

## Third-Party Cookies
We may use third-party services that set cookies:
- Analytics providers
- Payment processors

## Managing Cookies
You can control cookies through your browser settings:
- Block all cookies
- Delete existing cookies
- Allow cookies from specific sites

## Consent
By using our website, you consent to our use of cookies as described in this policy.

## Updates
We may update this cookie policy. Check this page periodically for changes.

## Contact
Questions about cookies? Contact us at privacy@example.com
    `.trim()
  };

  res.json(cookiePolicy);
});

/**
 * Update cookie consent
 * @route POST /api/privacy/cookie-consent
 * @access Private
 */
router.post('/cookie-consent', auth, async (req, res) => {
  try {
    const { analytics, marketing, functional } = req.body;

    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        'privacy.cookieConsent': {
          given: true,
          date: new Date(),
          analytics: analytics || false,
          marketing: marketing || false,
          functional: functional !== false // Default true
        }
      }
    });

    res.json({ msg: 'Cookie consent updated successfully' });
  } catch (error) {
    console.error('Error updating cookie consent:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * Request data export (GDPR Right to Data Portability)
 * @route POST /api/privacy/export-data
 * @access Private
 */
router.post('/export-data', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .lean();

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Gather all user data
    const userData = {
      profile: user,
      exportDate: new Date(),
      format: 'JSON',
      gdprCompliant: true
    };

    res.json({
      msg: 'Data export prepared',
      data: userData
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * Request account deletion (GDPR Right to Erasure)
 * @route DELETE /api/privacy/delete-account
 * @access Private
 */
router.delete('/delete-account', auth, async (req, res) => {
  try {
    const { password, confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({ msg: 'Please type DELETE to confirm account deletion' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Verify password
    const bcrypt = (await import('bcryptjs')).default;
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Incorrect password' });
    }

    // Mark account for deletion (soft delete) or delete immediately
    // For GDPR compliance, it's better to anonymize rather than delete
    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        email: `deleted_${req.user.id}@deleted.local`,
        username: `deleted_user_${req.user.id}`,
        'privacy.accountDeleted': true,
        'privacy.deletionDate': new Date(),
        password: 'DELETED',
        profile: {}
      }
    });

    res.json({
      msg: 'Account deletion request processed. Your account has been anonymized.',
      deletionDate: new Date()
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * Get user's privacy settings
 * @route GET /api/privacy/settings
 * @access Private
 */
router.get('/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('privacy notificationSettings');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json({
      cookieConsent: user.privacy?.cookieConsent || {},
      notifications: user.notificationSettings || {},
      accountStatus: {
        deleted: user.privacy?.accountDeleted || false
      }
    });
  } catch (error) {
    console.error('Error getting privacy settings:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * Update privacy settings
 * @route PUT /api/privacy/settings
 * @access Private
 */
router.put('/settings', auth, async (req, res) => {
  try {
    const { dataProcessing, marketing, profiling } = req.body;

    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        'privacy.settings': {
          dataProcessing: dataProcessing !== false,
          marketing: marketing || false,
          profiling: profiling || false,
          updatedAt: new Date()
        }
      }
    });

    res.json({ msg: 'Privacy settings updated successfully' });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
