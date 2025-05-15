const esService = require('../services/elasticsearchService');
    const SearchHistory = require('../models/searchHistoryModel');

    exports.searchProducts = async (req, res) => {
        const { q, page, limit } = req.query;
        const indexName = 'products'; // Hoặc lấy từ config/request

        if (!q) {
            return res.status(400).json({ message: 'Query parameter "q" is required.' });
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const from = (pageNum - 1) * limitNum;

        try {
            const esResults = await esService.searchProducts(indexName, q, from, limitNum);

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
        const { index, field, prefix } = req.query;
        if (!index || !field || !prefix) {
            return res.status(400).json({ message: 'Parameters "index", "field", and "prefix" are required.' });
        }
        try {
            const suggestions = await esService.getSuggestions(index, field, prefix);
            res.json(suggestions.map(sugg => ({ text: sugg.text, score: sugg._score }))); // Chỉ lấy text và score
        } catch (error) {
            console.error('Suggestion controller error:', error);
            res.status(500).json({ message: 'Error fetching suggestions.', error: error.message });
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