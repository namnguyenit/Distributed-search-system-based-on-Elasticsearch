# Sử dụng Node.js LTS Alpine image để có kích thước nhỏ
FROM node:18-alpine AS development

# Thiết lập thư mục làm việc trong container
WORKDIR /usr/src/app

# Sao chép package.json và package-lock.json (hoặc yarn.lock)
COPY package*.json ./

# Cài đặt các dependencies của dự án
# Sử dụng --only=production nếu bạn có bước build riêng cho production
RUN npm install

# Sao chép toàn bộ mã nguồn của ứng dụng vào thư mục làm việc
COPY . .

# Expose cổng mà ứng dụng Node.js sẽ lắng nghe
EXPOSE 3000

# Lệnh để khởi chạy ứng dụng khi container bắt đầu
# Sử dụng "npm run dev" nếu bạn có script dev với nodemon để tự động reload
CMD [ "npm", "start" ]