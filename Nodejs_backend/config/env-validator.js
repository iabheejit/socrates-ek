require('dotenv').config();

/**
 * Validates required environment variables on application startup
 * Exits the process if any required variables are missing
 */
function validateEnvVariables() {
    const requiredEnvVars = [
        // Server
        'port',

        // Airtable
        'AIRTABLE_PERSONAL_ACCESS_TOKEN',
        'AIRTABLE_STUDENT_BASE_ID',
        'AIRTABLE_COURSE_BASE_ID',

        // WhatsApp WATI
        'URL',
        'API',
        'WATI_URL_FOR_CERTIFICATE',
        'WAIT_API',

        // Azure LLM
        'AZURE_LLAMA_ENDPOINT',
        'AZURE_LLAMA_API_KEY',

        // Azure Storage
        'azurestring',
        'containername'
    ];

    const missingVars = [];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missingVars.push(envVar);
        }
    }

    if (missingVars.length > 0) {
        console.error('❌ ERROR: Missing required environment variables:');
        missingVars.forEach(varName => {
            console.error(`   - ${varName}`);
        });
        console.error('\n📝 Please check your .env file and ensure all required variables are set.');
        console.error('💡 See .env.example for reference.\n');
        process.exit(1);
    }

    console.log('✅ Environment variables validated successfully');
}

/**
 * Gets environment variable with fallback
 * @param {string} key - Environment variable key
 * @param {string} defaultValue - Default value if not found
 * @returns {string} Environment variable value or default
 */
function getEnv(key, defaultValue = '') {
    return process.env[key] || defaultValue;
}

/**
 * Gets required environment variable (throws if missing)
 * @param {string} key - Environment variable key
 * @returns {string} Environment variable value
 * @throws {Error} If environment variable is not set
 */
function getRequiredEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
}

module.exports = {
    validateEnvVariables,
    getEnv,
    getRequiredEnv
};
