// elasticsearchService.js
const { Client } = require('@elastic/elasticsearch');
const config = require('../config');

const esClient = new Client({ node: config.elasticsearchHost });

const PRODUCT_INDEX = 'products';

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
                                analyzer: 'standard',
                                fields: {
                                    keyword: { type: 'keyword', ignore_above: 256 },
                                    suggest: { type: 'completion' }
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
                            mongoId: { type: 'keyword' }
                        }
                    }
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
createProductIndex();

async function indexProduct(product) {
    try {
        const nameParts = product.name ? product.name.split(' ').filter(p => p.length > 0) : [];
        const suggestionInputs = product.name ? [product.name, ...nameParts] : [];

        const documentToIndex = {
            name: product.name,
            nameSuggest: {
                input: suggestionInputs
            },
            description: product.description,
            category: product.category,
            tags: product.tags,
            brand: product.brand,
            price: product.price,
            imageUrl: product.imageUrl,
            stock: product.stock,
            mongoId: product._id ? product._id.toString() : product.mongoId
            // removed createdAt and updatedAt due to date parsing errors
        };

        await esClient.index({
            index: PRODUCT_INDEX,
            id: product._id ? product._id.toString() : product.mongoId,
            document: documentToIndex
        });

        console.log(`Sản phẩm "${product.name}" đã được index.`);
    } catch (error) {
        console.error('Lỗi khi index sản phẩm:', error.meta ? error.meta.body : error);
    }
}
async function updateProductInES(productId, productData) {
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
                    minimum_should_match: queryClauses.length > 1 ? 1 : 0
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

        return response.hits;
    } catch (error) {
        console.error('Lỗi khi tìm kiếm sản phẩm:', error.meta ? error.meta.body : error);
        throw error;
    }
}

async function getSuggestions(fieldName = 'nameSuggest', prefixText, size = 5) {
    try {
        const response = await esClient.search({
            index: PRODUCT_INDEX,
            body: {
                _source: ["name", "imageUrl", "price", "category", "description", "stock", "brand"],
                suggest: {
                    'product-suggestions': {
                        prefix: prefixText,
                        completion: {
                            field: fieldName,
                            size,
                            skip_duplicates: true,
                            fuzzy: { fuzziness: "AUTO" }
                        }
                    }
                }
            }
        });

        return response.suggest?.['product-suggestions']?.[0]?.options || [];
    } catch (error) {
        console.error('Lỗi khi lấy gợi ý sản phẩm:', error.meta ? error.meta.body : error);
        throw error;
    }
}

async function bulkIndexProducts(products) {
    if (!products.length) return;
    const body = products.flatMap(product => [
        { index: { _index: PRODUCT_INDEX, _id: product._id.toString() } },
        {
            name: product.name,
            description: product.description,
            category: product.category,
            tags: product.tags,
            brand: product.brand,
            price: product.price,
            stock: product.stock,
            imageUrl: product.imageUrl,
            mongoId: product._id.toString()
            // Đã bỏ "name.suggest"
        }
    ]);

    try {
        const bulkResponse = await esClient.bulk({ refresh: true, body });
        if (bulkResponse.errors) {
            bulkResponse.items.forEach((item, idx) => {
                if (item.index && item.index.error) {
                    console.error(`Bulk index error at item ${idx}:`, item.index.error);
                }
            });
        } else {
            console.log(`Bulk indexing ${products.length} products completed successfully.`);
        }
    } catch (err) {
        console.error('Bulk indexing error:', err);
    }
}

module.exports = {
    esClient,
    checkConnection,
    createProductIndex,
    bulkIndexProducts
};


async function getClusterHealth() {
    try {
        return await esClient.cluster.health({});
    } catch (error) {
        console.error('Lỗi lấy trạng thái cụm Elasticsearch:', error.meta ? error.meta.body : error);
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
        console.error('Lỗi lấy thông tin node:', error.meta ? error.meta.body : error);
        throw error;
    }
}

async function getNodesStats() {
    try {
        return await esClient.nodes.stats({ metric: ['indices', 'http'] });
    } catch (error) {
        console.error('Lỗi lấy thống kê node:', error.meta ? error.meta.body : error);
        throw error;
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
    bulkIndexProducts,
    getClusterHealth,
    getNodesInfo,
    getNodesStats
};
