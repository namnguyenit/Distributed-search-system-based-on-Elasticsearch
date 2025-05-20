const { Client } = require('@elastic/elasticsearch');
const config = require('../config');
// const Product = require('../models/productModel'); // Product model không cần thiết trực tiếp trong file này nữa nếu các hàm nhận dữ liệu thuần

const esClient = new Client({
    node: config.elasticsearchHost,
    // auth: { username: 'elastic', password: 'your_es_password' },
    // tls: { rejectUnauthorized: false }
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
// Gọi checkConnection một lần khi module được load, hoặc trong app.js sau khi khởi tạo service
checkConnection();

const PRODUCT_INDEX = 'products';

// Chỉ giữ lại một hàm createProductIndex đã được tinh chỉnh
async function createProductIndex() {
    try {
        const indexExists = await esClient.indices.exists({ index: PRODUCT_INDEX });
        if (!indexExists) {
            console.log(`Creating index: ${PRODUCT_INDEX}`);
            await esClient.indices.create({
                index: PRODUCT_INDEX,
                body: {
                    mappings: {
                        properties: {
                            name: {
                                type: 'text',
                                analyzer: 'standard', // Analyzer cho tìm kiếm full-text
                                fields: {
                                    keyword: { type: 'keyword', ignore_above: 256 }, // Cho sắp xếp, tổng hợp
                                    suggest: { type: 'completion' } // Cho gợi ý
                                }
                            },
                            description: { type: 'text', analyzer: 'standard' },
                            category: {
                                type: 'text',
                                analyzer: 'standard',
                                fields: { keyword: { type: 'keyword', ignore_above: 256 } }
                            },
                            tags: {
                                type: 'text',
                                analyzer: 'standard',
                                fields: { keyword: { type: 'keyword', ignore_above: 256 } }
                            },
                            brand: {
                                type: 'text',
                                analyzer: 'standard',
                                fields: { keyword: { type: 'keyword', ignore_above: 256 } }
                            },
                            price: { type: 'float' },
                            imageUrl: { type: 'keyword', index: false },
                            stock: { type: 'integer' },
                            mongoId: { type: 'keyword' },
                            createdAt: {
                                type: 'date',
                                format: "M/d/yyyy||yyyy-MM-dd'T'HH:mm:ss.SSSZ||yyyy-MM-dd||epoch_millis"
                            },
                            updatedAt: {
                                type: 'date',
                                format: "M/d/yyyy||yyyy-MM-dd'T'HH:mm:ss.SSSZ||yyyy-MM-dd||epoch_millis"
                            }
                        }
                    },
                    // settings: { analysis: { /* custom analyzers nếu cần */ } }
                }
            });
            console.log(`Index ${PRODUCT_INDEX} created successfully.`);
        } else {
            console.log(`Index ${PRODUCT_INDEX} already exists.`);
        }
    } catch (error) {
        console.error(`Error creating index ${PRODUCT_INDEX}:`, error.meta ? error.meta.body : error);
    }
}

// Gọi hàm này một lần khi ứng dụng khởi động (ví dụ, trong app.js hoặc một script cài đặt)
createProductIndex();

async function indexProduct(product) { // product ở đây nên là một plain object
    try {
        const nameParts = product.name ? product.name.split(' ').filter(p => p.length > 0) : [];
        const suggestionInputs = product.name ? [product.name, ...nameParts] : [];

        // Tạo document để index, chỉ lấy các trường cần thiết
        // Nếu 'product' là Mongoose document, bạn có thể dùng product.toObject() hoặc product._doc
        // nhưng hãy cẩn thận không đưa các trường không mong muốn vào.
        const documentToIndex = {
            name: product.name,
            description: product.description,
            category: product.category,
            tags: product.tags,
            brand: product.brand,
            price: product.price,
            imageUrl: product.imageUrl,
            stock: product.stock,
            mongoId: product._id ? product._id.toString() : product.mongoId, // Đảm bảo mongoId được lấy đúng cách
            createdAt: product.createdAt, // Đảm bảo định dạng ngày tháng đúng khi gửi
            updatedAt: product.updatedAt, // Đảm bảo định dạng ngày tháng đúng khi gửi
            "name.suggest": { // Điền dữ liệu cho suggester
                input: suggestionInputs
            }
        };

        await esClient.index({
            index: PRODUCT_INDEX,
            id: product._id ? product._id.toString() : product.mongoId, // Sử dụng ID từ MongoDB
            document: documentToIndex,
        });
        console.log(`Sản phẩm "${product.name}" (ID: ${product._id ? product._id.toString() : product.mongoId}) đã được index.`);
    } catch (error) {
        console.error('Lỗi khi index sản phẩm:', error.meta ? error.meta.body : error);
    }
}

async function updateProductInES(productId, productData) { // productData nên là plain object chỉ chứa các trường cần cập nhật
    try {
        await esClient.update({
            index: PRODUCT_INDEX,
            id: productId.toString(),
            doc: productData
        });
        console.log(`Product ID: ${productId} updated in Elasticsearch.`);
    } catch (error) {
        console.error('Error updating product in Elasticsearch:', error.meta ? error.meta.body : error);
    }
}

async function deleteProductFromES(productId) {
    try {
        await esClient.delete({
            index: PRODUCT_INDEX,
            id: productId.toString()
        });
        console.log(`Product ID: ${productId} deleted from Elasticsearch.`);
    } catch (error) {
        console.error('Error deleting product from Elasticsearch:', error.meta ? error.meta.body : error);
    }
}

async function searchProducts(queryText, from = 0, size = 10) {
    try {
        const textSearchFields = ["name^3", "description^1", "category^2", "tags^2", "brand^2"];
        const queryClauses = [];

        if (queryText && queryText.trim() !== "") {
            queryClauses.push({
                multi_match: {
                    query: queryText,
                    fields: textSearchFields,
                    fuzziness: "AUTO",
                    type: "best_fields"
                }
            });
        } else {
            queryClauses.push({ match_all: {} });
        }

        if (!isNaN(parseFloat(queryText)) && isFinite(queryText)) {
            const numericQuery = parseFloat(queryText);
            queryClauses.push({
                bool: {
                    should: [
                        { term: { price: numericQuery } },
                        { term: { stock: numericQuery } }
                    ]
                }
            });
        }

        const response = await esClient.search({
            index: PRODUCT_INDEX,
            from,
            size,
            query: {
                bool: {
                    should: queryClauses,
                    minimum_should_match: queryClauses.length > 1 && !isNaN(parseFloat(queryText)) && isFinite(queryText) ? 1 : (queryClauses.length > 0 ? 1 : 0)
                }
            },
            highlight: {
                fields: {
                    name: {},
                    description: {},
                    brand: {},
                    category: {},
                    tags: {}
                }
            }
        });

        if (response.hits && response.hits.hits) {
            console.log(`[searchProducts] Found ${response.hits.total.value} products for query "${queryText}":`);
            response.hits.hits.forEach(hit => {
                console.log(`- ID: ${hit._id}, Name: ${hit._source?.name}`);
            });
        } else {
            console.log(`[searchProducts] No products found for query "${queryText}".`);
        }

        return response.hits;
    } catch (error) {
        console.error('Lỗi khi thực hiện tìm kiếm (searchProducts):', error.meta ? error.meta.body : error);
        throw error;
    }
}
// Sửa lại tham số và logic trả về cho getSuggestions
async function getSuggestions(fieldName, prefixText, size = 5) {
    // fieldName phải là "name.suggest" được truyền từ controller
    console.log(`[Service] Elasticsearch getSuggestions for field: ${fieldName}, prefix: ${prefixText}`);
    try {
        const response = await esClient.search({
            index: PRODUCT_INDEX,
            body: {
                // Yêu cầu _source để client có thể hiển thị chi tiết sản phẩm
                _source: ["name", "imageUrl", "price", "category", "description", "stock", "brand"],
                suggest: {
                    "product-suggestions": { // Tên của suggester, có thể đặt tùy ý
                        prefix: prefixText,
                        completion: {
                            field: fieldName, // Đây là trường có kiểu 'completion' trong mapping
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

        console.log('[Service] Elasticsearch suggest response:', JSON.stringify(response.suggest, null, 2));
        if (response.suggest && response.suggest['product-suggestions'] && response.suggest['product-suggestions'][0] && response.suggest['product-suggestions'][0].options) {
            // Mỗi 'option' trong kết quả suggest mặc định sẽ chứa _id, _index, _score, text, và _source của document gốc
            return response.suggest['product-suggestions'][0].options;
        }
        return []; // Trả về mảng rỗng nếu không có gợi ý
    } catch (error) {
        console.error('[Service] Lỗi lấy thông tin gợi ý từ elasticsearch:', error.meta ? error.meta.body : error);
        throw error;
    }
}

async function getClusterHealth() {
    try {
        return await esClient.cluster.health({});
    } catch (error) {
        console.error('Lỗi khi lấy thông tin trạng thái của nhóm node:', error.meta ? error.meta.body : error);
        throw error;
    }
}

async function getNodesInfo() {
    try {
        return await esClient.nodes.info({
            node_id: '_all',
            metric: ['http', 'transport', 'os', 'process', 'jvm']
        });
    } catch (error) {
        console.error('Lỗi khi lấy thông tin của node:', error.meta ? error.meta.body : error);
        throw error;
    }
}

async function getNodesStats() {
    try {
        const stats = await esClient.nodes.stats({ metric: ['indices', 'http'] });
        return stats;
    } catch (error) {
        console.error('Lỗi lấy thông tin của node:', error.meta ? error.meta.body : error);
        throw error;
    }
}

async function bulkIndexProducts(products) {
    if (!products.length) return;
    const body = products.flatMap(product => [
        { index: { _index: 'products', _id: product._id.toString() } },
        {
            name: product.name,
            description: product.description,
            price: product.price,
            // ... các trường khác ...
        }
    ]);
    try {
        const { body: bulkResponse } = await esClient.bulk({ refresh: true, body });
        if (bulkResponse.errors) {
            console.error('Bulk indexing had errors:', bulkResponse.errors);
        }
    } catch (err) {
        console.error('Bulk indexing error:', err);
    }
}

module.exports = {
    esClient,
    checkConnection,
    createProductIndex,
    indexProduct,
    updateProductInES,
    deleteProductFromES,
    searchProducts,
    getSuggestions,
    getClusterHealth,
    getNodesInfo,
    getNodesStats,
    bulkIndexProducts
};