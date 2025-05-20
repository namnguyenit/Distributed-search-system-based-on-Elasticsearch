// webapp/controllers/searchController.js
const esService = require('../services/elasticsearchService');
const SearchHistory = require('../models/searchHistoryModel'); // [VIETNAMESE_COMMENT: Mô hình lịch sử tìm kiếm]

exports.searchProducts = async (req, res) => {
    const { q, page, limit } = req.query;
    // FIX: indexName được xử lý bởi service, không cần truyền ở đây nếu luôn là 'products'
    // const indexName = 'products'; 

    if (!q) {
        return res.status(400).json({ message: 'Query parameter "q" is required.' });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const from = (pageNum - 1) * limitNum;

    try {
        // Tham số đầu tiên của esService.searchProducts là queryText (q)
        const esResults = await esService.searchProducts(q, from, limitNum);

        // Lưu lịch sử tìm kiếm
        if (req.session.user || req.user) { // req.user từ JWT, req.session.user từ session
            const userId = req.user ? req.user.id : req.session.user._id; // Lấy ID user
            const history = new SearchHistory({
                userId: userId,
                query: q,
                resultsCount: esResults.total.value
            });
            await history.save().catch(err => console.error("Failed to save search history:", err)); // Bắt lỗi nếu lưu thất bại nhưng vẫn trả kết quả
        }

        res.json({
            query: q,
            data: esResults.hits,
            total: esResults.total.value,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(esResults.total.value / limitNum)
        });
    } catch (error) {
        console.error('Search controller error:', error);
        res.status(500).json({ message: 'Error performing search.', error: error.message });
    }
};

exports.getSuggestions = async (req, res) => {
    // Tham số truy vấn 'index' không được sử dụng trực tiếp bởi esService.getSuggestions
    // vì PRODUCT_INDEX được sử dụng nội bộ.
    const { field, prefix } = req.query; // 'index' đã được loại bỏ khỏi đây
    if (!field || !prefix) { // Kiểm tra field và prefix
        return res.status(400).json({ message: 'Các tham số "field", và "prefix" là bắt buộc.' });
    }
    try {
        // FIX: Thứ tự tham số chính xác cho esService.getSuggestions
        // esService.getSuggestions mong đợi (fieldName, prefixText, size)
        // 'field' từ query tương ứng với 'fieldName'
        // 'prefix' từ query tương ứng với 'prefixText'
        const suggestions = await esService.getSuggestions(field, prefix);                                             
        // Mỗi option trong suggestions nên có _source chứa chi tiết sản phẩm
        const detailedSuggestions = suggestions.map(sugg => ({
            text: sugg.text, // Văn bản được gợi ý
            score: sugg._score,
            product: sugg._source // Tài liệu sản phẩm đầy đủ từ Elasticsearch
        }));
        res.json(detailedSuggestions);
    } catch (error) {
        console.error('Lỗi controller gợi ý:', error);
        // Gửi lại thông báo lỗi thực tế từ Elasticsearch nếu có và đang ở môi trường development
        const errorMessage = process.env.NODE_ENV === 'development' && error.meta && error.meta.body && error.meta.body.error 
                           ? error.meta.body.error.reason || error.meta.body.error.type
                           : 'Lỗi khi lấy gợi ý.';
        res.status(500).json({ message: errorMessage, error: error.message });
    }
};

exports.getUserSearchHistory = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.session.user._id;
        const history = await SearchHistory.find({ userId: userId })
                                            .sort({ timestamp: -1 }) // Sắp xếp mới nhất lên đầu
                                            .limit(50); // Giới hạn số lượng lịch sử trả về
        res.json(history);
    } catch (error) {
        console.error('Error fetching search history:', error);
        res.status(500).json({ message: 'Failed to retrieve search history.' });
    }
};