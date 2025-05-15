const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', 
            required: true
        },
        query: {
            type: String,
            required: true,
            trim: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        resultsCount: { 
            type: Number
        }
    });
    searchHistorySchema.index({ userId: 1, query: 1 }, { unique: true });
    // Tạo chỉ mục cho trường userId và timestamp để tối ưu hóa truy vấn
    searchHistorySchema.index({ userId: 1, timestamp: -1 });
    
    module.exports = mongoose.model('SearchHistory', searchHistorySchema);