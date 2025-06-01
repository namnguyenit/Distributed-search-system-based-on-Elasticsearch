require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/my_search_db_local_dev',
    elasticsearchHost: process.env.ELASTICSEARCH_HOST || 'http://localhost:9200',
    jwtSecret: process.env.JWT_SECRET || 'DEFAULT_VERY_SECRET_KEY_FOR_DEVELOPMENT',
    sessionSecret: process.env.SESSION_SECRET || 'DEFAULT_SESSION_SECRET_KEY_FOR_DEVELOPMENT',
    nodeEnv: process.env.NODE_ENV || 'development'
};