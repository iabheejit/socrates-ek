/**
 * Input validation utilities for production safety
 */

/**
 * Validates phone number (WhatsApp ID)
 * Accepts international format with or without + sign
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') {
        return false;
    }
    // Remove spaces and common separators
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Accept 10-15 digit numbers with optional + prefix
    return /^\+?\d{10,15}$/.test(cleaned);
}

/**
 * Validates day number (1-3 for current course structure)
 * @param {number|string} day - Day number
 * @returns {boolean} True if valid
 */
function isValidDay(day) {
    const dayNum = parseInt(day, 10);
    return !isNaN(dayNum) && dayNum >= 1 && dayNum <= 3;
}

/**
 * Validates module number (1-3 for current course structure)
 * @param {number|string} module - Module number
 * @returns {boolean} True if valid
 */
function isValidModule(module) {
    const moduleNum = parseInt(module, 10);
    return !isNaN(moduleNum) && moduleNum >= 1 && moduleNum <= 3;
}

/**
 * Validates text input (not empty, reasonable length)
 * @param {string} text - Text to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {boolean} True if valid
 */
function isValidText(text, maxLength = 5000) {
    if (!text || typeof text !== 'string') {
        return false;
    }
    const trimmed = text.trim();
    return trimmed.length > 0 && trimmed.length <= maxLength;
}

/**
 * Validates course topic/name
 * @param {string} topic - Topic name
 * @returns {boolean} True if valid
 */
function isValidTopic(topic) {
    if (!topic || typeof topic !== 'string') {
        return false;
    }
    const trimmed = topic.trim();
    // 2-100 characters, alphanumeric and common symbols
    return /^[a-zA-Z0-9\s\-_,.()]{2,100}$/.test(trimmed);
}

/**
 * Sanitizes string for Airtable formula (prevents injection)
 * Escapes single quotes and backslashes
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized value
 */
function sanitizeForAirtable(value) {
    if (!value || typeof value !== 'string') {
        return '';
    }
    // Escape single quotes and backslashes for Airtable formulas
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Sanitizes user query to prevent prompt injection
 * @param {string} query - User query
 * @returns {string} Sanitized query
 */
function sanitizeUserQuery(query) {
    if (!query || typeof query !== 'string') {
        return '';
    }

    const trimmed = query.trim();

    // Block queries that are too short or too long
    if (trimmed.length < 3 || trimmed.length > 2000) {
        throw new Error('Query length must be between 3 and 2000 characters');
    }

    // Block obvious injection attempts
    const dangerousPatterns = [
        /system:/gi,
        /assistant:/gi,
        /\[INST\]/gi,
        /\[\/INST\]/gi,
        /<\|.*?\|>/gi,
        /ignore (previous|above|all) instructions/gi,
        /you are now/gi,
        /act as/gi,
        /pretend (to be|you are)/gi
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(trimmed)) {
            throw new Error('Query contains disallowed content');
        }
    }

    return trimmed;
}

/**
 * Validates student name
 * @param {string} name - Student name
 * @returns {boolean} True if valid
 */
function isValidName(name) {
    if (!name || typeof name !== 'string') {
        return false;
    }
    const trimmed = name.trim();
    // 2-50 characters, letters, spaces, common name characters
    return /^[a-zA-Z\s\-'.]{2,50}$/.test(trimmed);
}

/**
 * Validates record ID format (Airtable)
 * @param {string} id - Record ID
 * @returns {boolean} True if valid
 */
function isValidRecordId(id) {
    if (!id || typeof id !== 'string') {
        return false;
    }
    // Airtable IDs start with 'rec' followed by alphanumeric characters
    return /^rec[a-zA-Z0-9]{14}$/.test(id);
}

/**
 * Validates table name format
 * @param {string} tableName - Table name
 * @returns {boolean} True if valid
 */
function isValidTableName(tableName) {
    if (!tableName || typeof tableName !== 'string') {
        return false;
    }
    // Alphanumeric, underscores, hyphens, 1-100 chars
    return /^[a-zA-Z0-9_\-]{1,100}$/.test(tableName);
}

/**
 * Builds safe Airtable filter formula
 * @param {string} field - Field name
 * @param {string} value - Value to filter
 * @returns {string} Safe filter formula
 */
function buildSafeFilter(field, value) {
    const sanitizedValue = sanitizeForAirtable(value);
    return `{${field}} = '${sanitizedValue}'`;
}

/**
 * Builds safe Airtable AND filter formula
 * @param {Array<{field: string, value: string}>} conditions - Array of conditions
 * @returns {string} Safe filter formula
 */
function buildSafeAndFilter(conditions) {
    const safeClauses = conditions.map(({ field, value }) =>
        buildSafeFilter(field, value)
    );
    return `AND(${safeClauses.join(', ')})`;
}

module.exports = {
    isValidPhone,
    isValidDay,
    isValidModule,
    isValidText,
    isValidTopic,
    isValidName,
    isValidRecordId,
    isValidTableName,
    sanitizeForAirtable,
    sanitizeUserQuery,
    buildSafeFilter,
    buildSafeAndFilter
};
