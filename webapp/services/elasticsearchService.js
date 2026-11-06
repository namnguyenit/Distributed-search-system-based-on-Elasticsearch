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

async function ensureProductsIndex(options = { waitForStatus: 'yellow', retries: 3 }) {
    const { waitForStatus = 'yellow', retries = 3 } = options || {};
    let attempts = 0;
    while (attempts <= retries) {
        try {
            const exists = await esClient.indices.exists({ index: PRODUCT_INDEX });
            if (!exists) {
                await esClient.indices.create({
                    index: PRODUCT_INDEX,
                    body: {
                        settings: {
                            number_of_shards: 5,
                            number_of_replicas: 1
                        },
                        mappings: {
                            properties: {
                                // Completion field at top-level for suggestions
                                nameSuggest: { type: 'completion' },
                                name: {
                                    type: 'text',
                                    analyzer: 'standard',
                                    fields: {
                                        keyword: { type: 'keyword', ignore_above: 256 },
                                        // Also provide nested completion under name.suggest for compatibility
                                        suggest: { type: 'completion' }
                                    }
                                },
                                description: { type: 'text', analyzer: 'standard' },
                                category: { type: 'keyword' },
                                tags: { type: 'keyword' },
                                brand: { type: 'keyword' },
                                price: { type: 'float' },
                                imageUrl: { type: 'keyword', index: false },
                                stock: { type: 'integer' },
                                mongoId: { type: 'keyword' }
                            }
                        }
                    }
                });
            }
            // Wait for cluster/index to become available
            await esClient.cluster.health({ index: PRODUCT_INDEX, wait_for_status: waitForStatus, timeout: '60s' });
            return true;
        } catch (e) {
            attempts += 1;
            if (attempts > retries) {
                console.error('ensureProductsIndex failed:', e.meta ? e.meta.body : e);
                return false;
            }
            await new Promise(r => setTimeout(r, 1000 * attempts));
        }
    }
}

// Keep existing createProductIndex but delegate to ensureProductsIndex
async function createProductIndex() {
    try {
        await ensureProductsIndex();
    } catch (error) {
        console.error(`Error creating index ${PRODUCT_INDEX}:`, error.meta ? error.meta.body : error);
    }
}
createProductIndex();

async function indexProduct(product) {
    try {
        await ensureProductsIndex();
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
        await ensureProductsIndex();
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
        await ensureProductsIndex();
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
        await ensureProductsIndex();
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

        const doSearch = async () => esClient.search({
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

        try {
            const response = await doSearch();
            return response.hits;
        } catch (err) {
            if (err?.meta?.body?.error?.type === 'index_not_found_exception') {
                await ensureProductsIndex();
                const response = await doSearch();
                return response.hits;
            }
            throw err;
        }
    } catch (error) {
        console.error('Lỗi khi tìm kiếm sản phẩm:', error.meta ? error.meta.body : error);
        throw error;
    }
}

async function getSuggestions(fieldName = 'nameSuggest', prefixText, size = 5) {
    try {
        await ensureProductsIndex();
        const doSuggest = async () => esClient.search({
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
        try {
            const response = await doSuggest();
            return response.suggest?.['product-suggestions']?.[0]?.options || [];
        } catch (err) {
            if (err?.meta?.body?.error?.type === 'index_not_found_exception') {
                await ensureProductsIndex();
                const response = await doSuggest();
                return response.suggest?.['product-suggestions']?.[0]?.options || [];
            }
            throw err;
        }
    } catch (error) {
        console.error('Lỗi khi lấy gợi ý sản phẩm:', error.meta ? error.meta.body : error);
        throw error;
    }
}

async function bulkIndexProducts(products) {
    if (!products.length) return;
    await ensureProductsIndex();
    const body = products.flatMap(product => [
        { index: { _index: PRODUCT_INDEX, _id: product._id.toString() } },
        {
            name: product.name,
            nameSuggest: { input: (product.name || '').split(' ').filter(Boolean).concat([product.name || '']).filter(Boolean) },
            description: product.description,
            category: product.category,
            tags: product.tags,
            brand: product.brand,
            price: product.price,
            stock: product.stock,
            imageUrl: product.imageUrl,
            mongoId: product._id.toString()
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

// Thêm hàm getClusterHealth cho controller sử dụng
async function getClusterHealth() {
    return await esClient.cluster.health();
}

// Thêm hàm getNodesInfo cho controller sử dụng
async function getNodesInfo() {
    return await esClient.nodes.info();
}

// Thêm hàm getNodesStats cho controller sử dụng
async function getNodesStats() {
    return await esClient.nodes.stats();
}

// Export esClient để controller có thể dùng trực tiếp cho stress test
module.exports = {
    esClient,
    checkConnection,
    createProductIndex,
    ensureProductsIndex,
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
