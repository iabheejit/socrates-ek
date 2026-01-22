/**
 * Express middleware for input validation
 */

const { isValidPhone, sanitizeUserQuery } = require('../utils/validators');

/**
 * Middleware to validate WhatsApp webhook events
 */
function validateWebhookEvent(req, res, next) {
    const event = req.body;

    // Validate event structure
    if (!event || typeof event !== 'object') {
        return res.status(400).json({
            error: 'Invalid request body',
            message: 'Request body must be a valid JSON object'
        });
    }

    // Validate waId (phone number)
    if (event.waId && !isValidPhone(event.waId)) {
        return res.status(400).json({
            error: 'Invalid phone number',
            message: 'Phone number (waId) format is invalid'
        });
    }

    // Validate text messages
    if (event.text && typeof event.text !== 'string') {
        return res.status(400).json({
            error: 'Invalid text field',
            message: 'Text field must be a string'
        });
    }

    // Limit text message length
    if (event.text && event.text.length > 4000) {
        return res.status(400).json({
            error: 'Message too long',
            message: 'Text messages must be less than 4000 characters'
        });
    }

    next();
}

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
    console.error('Error:', err);

    // Handle validation errors
    if (err.message && err.message.includes('Query contains disallowed content')) {
        return res.status(400).json({
            error: 'Invalid input',
            message: 'Your query contains disallowed content'
        });
    }

    // Handle generic errors
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message
    });
}

/**
 * Request logger middleware
 */
function requestLogger(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });

    next();
}

module.exports = {
    validateWebhookEvent,
    errorHandler,
    requestLogger
};
