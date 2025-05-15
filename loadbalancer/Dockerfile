# Sử dụng image Nginx chính thức, phiên bản Alpine để có kích thước nhỏ
FROM nginx:alpine

# Sao chép file cấu hình Nginx tùy chỉnh của bạn vào đúng vị trí trong container
# Nginx sẽ tự động đọc file này khi khởi động
COPY nginx.conf /etc/nginx/nginx.conf

# (Tùy chọn) Sao chép các file tĩnh khác nếu có, ví dụ trang lỗi tùy chỉnh
# COPY custom_error_pages/ /usr/share/nginx/html/custom_error_pages/

# Expose cổng mà Nginx sẽ lắng nghe bên trong container (mặc định là 80)
EXPOSE 80

# Lệnh mặc định để chạy Nginx khi container khởi động
# 'daemon off;' để Nginx chạy ở foreground, điều này cần thiết cho Docker
CMD ["nginx", "-g", "daemon off;"]