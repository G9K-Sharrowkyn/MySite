export const requestDataDeletion = async (req, res) => {
  // In a real app, this would trigger a process to delete user data.
  // For now, we'll just send a confirmation.
  res.json({ message: 'Data deletion request received. We will process it within 30 days.' });
};

export const requestDataModification = async (req, res) => {
  // In a real app, this would create a support ticket or similar.
  res.json({ message: 'Data modification request received. We will contact you shortly.' });
};

export const getPrivacyPolicy = async (req, res) => {
  res.send(`
    <h1>Privacy Policy</h1>
    <p>Your privacy is important to us. It is GeekFights' policy to respect your privacy regarding any information we may collect from you across our website.</p>
    <p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used.</p>
    <p>We only retain collected information for as long as is necessary to provide you with your requested service. What data we store, we’ll protect within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.</p>
    <p>We don’t share any personally identifying information publicly or with third-parties, except when required to by law.</p>
    <p>Our website may link to external sites that are not operated by us. Please be aware that we have no control over the content and practices of these sites, and cannot accept responsibility or liability for their respective privacy policies.</p>
    <p>You are free to refuse our request for your personal information, with the understanding that we may be unable to provide you with some of your desired services.</p>
    <p>Your continued use of our website will be regarded as acceptance of our practices around privacy and personal information. If you have any questions about how we handle user data and personal information, feel free to contact us.</p>
    <p>This policy is effective as of 11 August 2025.</p>
  `);
};

export const getTermsOfService = async (req, res) => {
  res.send(`
    <h1>Terms of Service</h1>
    <p>By accessing the website at GeekFights, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws.</p>
    <p>Permission is granted to temporarily download one copy of the materials (information or software) on GeekFights' website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
    <ol>
      <li>modify or copy the materials;</li>
      <li>use the materials for any commercial purpose, or for any public display (commercial or non-commercial);</li>
      <li>attempt to decompile or reverse engineer any software contained on GeekFights' website;</li>
      <li>remove any copyright or other proprietary notations from the materials; or</li>
      <li>transfer the materials to another person or "mirror" the materials on any other server.</li>
    </ol>
    This license shall automatically terminate if you violate any of these restrictions and may be terminated by GeekFights at any time.</p>
    <p>The materials on GeekFights' website are provided on an 'as is' basis. GeekFights makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
  `);
};

export const getCookiePolicy = async (req, res) => {
  res.send(`
    <h1>Cookie Policy</h1>
    <p>We use cookies to help improve your experience of our website. This cookie policy is part of our privacy policy, and covers the use of cookies between your device and our site.</p>
    <p>We use cookies to enable certain features on our website (eg. logging in), to track site usage (eg. analytics), to store your user settings (eg. timezone, notification preferences), and to personalize your content (eg. advertising, language).</p>
    <p>If you don’t wish to accept cookies from us, you should instruct your browser to refuse cookies from our website, with the understanding that we may be unable to provide you with some of your desired content and services.</p>
  `);
};

export const saveConsent = async (req, res) => {
  const { preferences } = req.body;
  const db = req.db;
  await db.read();

  const userIndex = db.data.users.findIndex(u => u.id === req.user.id);

  if (userIndex === -1) {
    return res.status(404).json({ msg: 'User not found' });
  }

  if (!db.data.users[userIndex].consent) {
    db.data.users[userIndex].consent = {};
  }

  db.data.users[userIndex].consent.cookie = {
    preferences,
    timestamp: new Date().toISOString()
  };

  await db.write();
  res.json({ message: 'Cookie consent saved successfully' });
};
