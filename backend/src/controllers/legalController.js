const User = require('../models/userModel');

// GET /api/legal/privacy-policy
const getPrivacyPolicy = (req, res) => {
  res.json({
    title: 'Privacy Policy',
    lastUpdated: '2024-01-01',
    content: `
# Privacy Policy

## 1. Information We Collect

We collect information you provide directly to us, such as when you create an account, post content, or communicate with us.

### Personal Information:
- Username and email address
- Profile information and preferences
- Content you post (fights, comments, messages)
- Activity data (votes, bets, achievements)

### Technical Information:
- IP address and device information
- Usage data and analytics
- Cookies and similar technologies

## 2. How We Use Your Information

We use the information we collect to:
- Provide and maintain our services
- Process your votes, bets, and transactions
- Send notifications and updates
- Improve our platform and user experience
- Ensure compliance with our terms and policies

## 3. Information Sharing

We do not sell, trade, or rent your personal information to third parties. We may share information:
- With your consent
- To comply with legal obligations
- To protect our rights and safety
- With service providers who assist in our operations

## 4. Data Retention

We retain your information for as long as your account is active or as needed to provide services. You may request deletion of your data at any time.

## 5. Your Rights

Under GDPR and other privacy laws, you have the right to:
- Access your personal data
- Correct inaccurate data
- Request deletion of your data
- Withdraw consent
- Export your data
- Object to processing

## 6. Contact Us

For privacy-related questions, contact us at privacy@site.local

## 7. Changes to This Policy

We may update this policy from time to time. We will notify you of any material changes.
    `,
    version: '1.0'
  });
};

// GET /api/legal/terms-of-service
const getTermsOfService = (req, res) => {
  res.json({
    title: 'Terms of Service',
    lastUpdated: '2024-01-01',
    content: `
# Terms of Service

## 1. Acceptance of Terms

By accessing and using this platform, you accept and agree to be bound by these terms.

## 2. User Accounts

### Registration:
- You must provide accurate information
- You are responsible for maintaining account security
- You must be at least 13 years old to use this service

### Prohibited Activities:
- Creating multiple accounts
- Impersonating others
- Harassment or hate speech
- Spam or commercial solicitation
- Attempting to manipulate voting systems

## 3. Content Guidelines

### User-Generated Content:
- You retain ownership of your content
- You grant us license to display and distribute your content
- Content must be appropriate and not violate others' rights

### Prohibited Content:
- Copyrighted material without permission
- Explicit or inappropriate content
- Personal information of others
- Malicious code or links

## 4. Virtual Currency and Betting

### Virtual Coins:
- Coins have no real-world value
- Coins are earned through participation
- Coins can be used for betting and purchases
- We reserve the right to adjust coin values

### Betting System:
- Betting is for entertainment only
- No real money is involved
- Betting results are final
- We are not responsible for betting losses

## 5. Division System

### Official Fights:
- Moderators create official division matches
- Official fights affect user records
- Voting is locked after 72 hours
- Results are final and binding

### Team Selection:
- Users select teams when joining divisions
- Teams are locked and cannot be changed
- Teams are unique per division
- Violations may result in penalties

## 6. Termination

We may terminate or suspend your account for:
- Violation of these terms
- Inappropriate behavior
- Extended inactivity
- At our discretion

## 7. Disclaimers

- Service is provided "as is"
- We are not liable for damages
- We do not guarantee service availability
- User content is not endorsed by us

## 8. Contact

For questions about these terms, contact us at legal@site.local
    `,
    version: '1.0'
  });
};

// GET /api/legal/cookies
const getCookiePolicy = (req, res) => {
  res.json({
    title: 'Cookie Policy',
    lastUpdated: '2024-01-01',
    content: `
# Cookie Policy

## 1. What Are Cookies

Cookies are small text files stored on your device when you visit our website.

## 2. How We Use Cookies

### Essential Cookies:
- Authentication and security
- Session management
- Basic functionality

### Functional Cookies:
- User preferences
- Language settings
- Theme preferences

### Analytics Cookies:
- Usage statistics
- Performance monitoring
- Service improvement

### Marketing Cookies:
- Personalized content
- Advertising preferences
- Social media integration

## 3. Cookie Types

### Session Cookies:
- Temporary, deleted when browser closes
- Used for login sessions and security

### Persistent Cookies:
- Remain on device for set period
- Store preferences and settings

### Third-Party Cookies:
- Set by external services
- Analytics and social media

## 4. Managing Cookies

### Browser Settings:
- Most browsers allow cookie control
- You can block or delete cookies
- Some features may not work without cookies

### Our Cookie Consent:
- We ask for consent before setting non-essential cookies
- You can change preferences anytime
- Essential cookies are always active

## 5. Specific Cookies We Use

### Authentication:
- session_id: User login session
- csrf_token: Security protection

### Preferences:
- theme: Dark/light mode preference
- language: Language selection
- notifications: Notification settings

### Analytics:
- _ga: Google Analytics
- _gid: Google Analytics
- _gat: Google Analytics

## 6. Third-Party Services

We use third-party services that may set cookies:
- Google Analytics
- Social media platforms
- Payment processors

## 7. Updates

This policy may be updated. Check regularly for changes.

## 8. Contact

For cookie-related questions, contact us at privacy@site.local
    `,
    version: '1.0'
  });
};

// POST /api/legal/consent - Update user consent
const updateConsent = async (req, res) => {
  try {
    const { privacyPolicy, termsOfService, cookies, marketingEmails } = req.body;
    
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        consent: {
          privacyPolicy: privacyPolicy || false,
          termsOfService: termsOfService || false,
          cookies: cookies || false,
          marketingEmails: marketingEmails || false
        }
      },
      { new: true }
    );
    
    res.json({ 
      message: 'Consent updated successfully',
      consent: updatedUser.consent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/legal/data-export - Export user data (GDPR)
const exportUserData = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const user = await User.findById(req.user._id)
      .populate('posts')
      .populate('comments')
      .populate('fights')
      .populate('votes')
      .populate('messages')
      .populate('notifications');
    
    const userData = {
      profile: {
        username: user.username,
        email: user.email,
        profile: user.profile,
        stats: user.stats,
        activity: user.activity,
        badges: user.badges,
        consent: user.consent
      },
      content: {
        posts: user.posts,
        comments: user.comments,
        fights: user.fights,
        votes: user.votes,
        messages: user.messages,
        notifications: user.notifications
      },
      exportDate: new Date().toISOString()
    };
    
    res.json(userData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/legal/delete-account - Delete user account (GDPR)
const deleteAccount = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const { confirmPassword } = req.body;
    
    // Verify password before deletion
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(confirmPassword);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }
    
    // Delete user and all associated data
    await User.findByIdAndDelete(req.user._id);
    
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPrivacyPolicy,
  getTermsOfService,
  getCookiePolicy,
  updateConsent,
  exportUserData,
  deleteAccount
}; 