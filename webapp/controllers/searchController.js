// webapp/controllers/searchController.js
const esService = require('../services/elasticsearchService');
const SearchHistory = require('../models/searchHistoryModel');

exports.searchProducts = async (req, res) => {
    const { q, page, limit } = req.query;
    if (!q) {
        return res.status(400).json({ message: 'Query parameter "q" is required.' });
    }
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const from = (pageNum - 1) * limitNum;
    try {
        const esResults = await esService.searchProducts(q, from, limitNum);
        if (req.session.user || req.user) {
            const userId = req.user ? req.user.id : req.session.user._id;
            const history = new SearchHistory({
                userId: userId,
                query: q,
                resultsCount: esResults.total.value
            });
            await history.save().catch(err => console.error("Failed to save search history:", err));
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
    const { field, prefix } = req.query;
    if (!field || !prefix) {
        return res.status(400).json({ message: 'Các tham số "field", và "prefix" là bắt buộc.' });
    }
    try {
        const suggestions = await esService.getSuggestions(field, prefix);
        const detailedSuggestions = suggestions.map(sugg => ({
            text: sugg.text,
            score: sugg._score,
            product: sugg._source
        }));
        res.json(detailedSuggestions);
    } catch (error) {
        console.error('Lỗi controller gợi ý:', error);
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
            .sort({ timestamp: -1 })
            .limit(50);
        res.json(history);
    } catch (error) {
        console.error('Error fetching search history:', error);
        res.status(500).json({ message: 'Failed to retrieve search history.' });
    }
};