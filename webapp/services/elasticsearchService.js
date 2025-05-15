const { Client } = require('@elastic/elasticsearch');
const config = require('../config');

const esClient = new Client({
    node: config.elasticsearchHost,
    // Nếu Elasticsearch cluster có authentication (khuyến khích cho production)
    // auth: {
    //   username: 'elastic', // Hoặc user bạn đã tạo
    //   password: 'your_es_password'
    // },
    // Nếu dùng HTTPS với self-signed certificate (chỉ cho development)
    // tls: {
    //   rejectUnauthorized: false
    // }
});

async function checkConnection() {
    try {
        const health = await esClient.cluster.health({});
        console.log('Elasticsearch cluster health:', health);
        return health;
    } catch (error) {
        console.error('Không thể kết nối đến Elasticsearch:', error.meta ? error.meta.body : error);
        return null;
    }
}
checkConnection(); 


async function searchProducts(indexName, queryText, from = 0, size = 10) {
    try {
        const response = await esClient.search({
            index: indexName, // ví dụ: 'products'
            body: {
                from: from,
                size: size,
                query: {
                    multi_match: {
                        query: queryText,
                        fields: ["name^3", "description", "category^2", "tags"],
                        fuzziness: "AUTO" 
                    }
                },
                highlight: { 
                    fields: {
                        "name": {},
                        "description": {}
                    }
                }
            }
        });
        return response.hits; 
    } catch (error) {
        console.error('Lỗi thông tin tìm kiếm:', error.meta ? error.meta.body : error);
        throw error;
    }
}

// Hàm lấy gợi ý (suggestions)
async function getSuggestions(indexName, fieldName, prefixText, size = 5) {
    try {
        const response = await esClient.search({
            index: indexName,
            body: {
                suggest: {
                    "product-suggestions": { 
                        prefix: prefixText,
                        completion: {
                            field: fieldName, 
                            size: size,
                            skip_duplicates: true,
                            fuzzy: { 
                                fuzziness: "AUTO"
                            }
                        }
                    }
                }
            }
        });
        return response.suggest['product-suggestions'][0].options;
    } catch (error) {
        console.error('Lỗi lấy thông tin gợi ý từ elasticsearch:', error.meta ? error.meta.body : error);
        throw error;
    }
}

// Hàm lấy trạng thái nhóm node cho admin
async function getClusterHealth() {
    try {
        return await esClient.cluster.health({});
    } catch (error) {
        console.error('Lỗi khi lấy thông tin trạng thái của nhóm node:', error.meta ? error.meta.body : error);
        throw error;
    }
}

// Hàm lấy trạng thái sống chết của các node
async function getNodesInfo() { 
    try {
        // _nodes/http,jvm,os,process,fs,transport,indices,thread_pool
        return await esClient.nodes.info({
            node_id: '_all', 
            metric: ['http', 'transport', 'os', 'process', 'jvm'] 
        });
    } catch (error) {
        console.error('Lỗi khi lấy thông tin của node:', error.meta ? error.meta.body : error);
        throw error;
    }
}

// Hàm lấy thống kê request (phần này phức tạp hơn, cần xem xét cách Nginx log hoặc dùng tool giám sát)
// Elasticsearch không trực tiếp cung cấp "lượng request của từng node" cho mỗi query search đơn lẻ.
// Bạn có thể lấy tổng số query, indexing rate từ _nodes/stats
async function getNodesStats() {
    try {
        const stats = await esClient.nodes.stats({ metric: ['indices', 'http'] });
        return stats;

    } catch (error) {
        console.error('Lỗi lấy thông tin của node:', error.meta ? error.meta.body : error);
        throw error;
    }
}


module.exports = {
    esClient,
    checkConnection,
    searchProducts,
    getSuggestions,
    getClusterHealth,
    getNodesInfo,
    getNodesStats
};