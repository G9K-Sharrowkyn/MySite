const { v4: uuidv4 } = require('uuid');

// @desc    Get messages for authenticated user
// @route   GET /api/messages
// @access  Private
exports.getMessages = async (req, res) => {
  const db = req.db;
  await db.read();
  const userId = req.user.id;

  // Filtruj wiadomości, gdzie użytkownik jest odbiorcą lub nadawcą
  const userMessages = db.data.messages.filter(
    (msg) => msg.to === userId || msg.from === userId
  );

  res.json(userMessages);
};

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  const { to, subject, body } = req.body;
  const db = req.db;
  await db.read();

  const senderId = req.user.id;
  const sender = db.data.users.find(u => u.id === senderId);
  const receiver = db.data.users.find(u => u.id === to);

  if (!receiver) {
    return res.status(404).json({ msg: 'Odbiorca nie znaleziony' });
  }

  const newMessage = {
    id: uuidv4(),
    from: senderId,
    fromUsername: sender ? sender.username : 'Nieznany',
    to,
    toUsername: receiver.username,
    subject,
    body,
    timestamp: new Date().toISOString(),
    read: false,
  };

  db.data.messages.push(newMessage);
  await db.write();
  res.status(201).json(newMessage);
};