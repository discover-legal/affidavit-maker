// middleware/validationRules.js
// Basic validation rules for the application

const validationRules = {
  chat: [
    (req, res, next) => {
      // Basic validation for chat endpoint
      const { message } = req.body;
      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }
      if (message.length > 5000) {
        return res.status(400).json({
          success: false,
          error: 'Message is too long (max 5000 characters)'
        });
      }
      next();
    }
  ]
};

module.exports = validationRules;