process.env.JWT_SECRET = 'jest-only-secret-not-for-production';
process.env.DATABASE = 'local';
process.env.JSON_DB_PATH = '.tmp/db.jest.json';
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
process.env.TRANSLATION_PROVIDER = 'disabled';
