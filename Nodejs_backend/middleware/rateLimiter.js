const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * General API rate limiter
 * Limits requests to 100 per 15 minutes per IP
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests',
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
        res.status(429).json({
            error: 'Too many requests',
            message: 'Too many requests from this IP, please try again later.',
            retryAfter: req.rateLimit.resetTime
        });
    }
});

/**
 * Webhook rate limiter (more permissive for webhooks)
 * Limits to 1000 requests per 15 minutes
 */
const webhookLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Higher limit for webhooks
    message: {
        error: 'Too many webhook requests',
        message: 'Webhook rate limit exceeded, please contact support.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.error(`Webhook rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many webhook requests',
            message: 'Webhook rate limit exceeded, please contact support.'
        });
    }
});

/**
 * Strict rate limiter for expensive operations (LLM queries)
 * Limits to 10 requests per minute
 */
const llmQueryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Very strict limit for expensive LLM operations
    message: {
        error: 'Query rate limit exceeded',
        message: 'Too many queries, please wait before sending another query.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        logger.warn(`LLM query rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Query rate limit exceeded',
            message: 'Too many queries, please wait before sending another query.',
            retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        });
    }
});

module.exports = {
    apiLimiter,
    webhookLimiter,
    llmQueryLimiter
};
