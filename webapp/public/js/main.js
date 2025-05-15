document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const suggestionsContainer = document.getElementById('suggestionsContainer');

    // Xử lý tìm kiếm
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                // Chuyển hướng đến trang kết quả tìm kiếm thay vì AJAX để load trang mới
                window.location.href = `/search?q=${encodeURIComponent(query)}`;
            }
        });
    }

    // Xử lý gợi ý tìm kiếm
    if (searchInput && suggestionsContainer) {
        let suggestionTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(suggestionTimeout);
            const prefix = searchInput.value.trim();

            if (prefix.length < 2) { // Chỉ tìm gợi ý khi có ít nhất 2 ký tự
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
                return;
            }

            suggestionTimeout = setTimeout(async () => {
                try {
                    // Thay 'products' và 'name.suggest' bằng index và field thực tế của bạn
                    const response = await fetch(`/api/search/suggestions?index=products&field=name.suggest&prefix=${encodeURIComponent(prefix)}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const suggestions = await response.json();

                    suggestionsContainer.innerHTML = ''; // Xóa gợi ý cũ
                    if (suggestions && suggestions.length > 0) {
                        suggestionsContainer.style.display = 'block';
                        suggestions.forEach(sugg => {
                            const div = document.createElement('div');
                            div.textContent = sugg.text; // Giả sử API trả về { text: "..." }
                            div.classList.add('suggestion-item');
                            div.addEventListener('click', () => {
                                searchInput.value = sugg.text;
                                suggestionsContainer.innerHTML = '';
                                suggestionsContainer.style.display = 'none';
                                searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); // Kích hoạt submit form
                            });
                            suggestionsContainer.appendChild(div);
                        });
                    } else {
                        suggestionsContainer.style.display = 'none';
                    }
                } catch (error) {
                    console.error("Lỗi khi lấy gợi ý:", error);
                    suggestionsContainer.innerHTML = '';
                    suggestionsContainer.style.display = 'none';
                }
            }, 300); // Chờ 300ms sau khi người dùng ngừng gõ
        });

        // Ẩn gợi ý khi click ra ngoài
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
            }
        });
    }

    // Xử lý form đăng ký để kiểm tra mật khẩu khớp nhau
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (password !== confirmPassword) {
                e.preventDefault(); // Ngăn submit form
                alert('Mật khẩu và xác nhận mật khẩu không khớp!');
                // Hoặc hiển thị thông báo lỗi tinh tế hơn
            }
        });
    }

});