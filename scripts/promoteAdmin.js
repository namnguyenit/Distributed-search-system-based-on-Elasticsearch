const mongoose = require('mongoose');
const User = require('../webapp/models/userModel');

// === CONFIGURE THIS ===
const MONGO_URI = 'mongodb://localhost:27017/my_search_db_local_dev'; // Sửa nếu bạn dùng URI khác
const ADMIN_USERNAME = 'admin'; // Đổi thành username bạn muốn promote

mongoose.connect(MONGO_URI)
  .then(async () => {
    const user = await User.findOne({ username: ADMIN_USERNAME });
    if (!user) {
      console.log('User not found:', ADMIN_USERNAME);
      process.exit(1);
    }
    user.role = 'admin';
    await user.save();
    console.log('User promoted to admin:', user.username);
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }); 