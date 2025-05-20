// distributed-search-system/webapp/public/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const suggestionsContainer = document.getElementById('suggestionsContainer');
    const productPopupModal = document.getElementById('productPopupModal'); // Lấy phần tử popup

    // --- Các hàm cho Product Popup ---
    function displayProductPopup(product) {
        if (!product || !productPopupModal) return;

        document.getElementById('popupProductName').textContent = product.name || 'N/A';
        const productImage = document.getElementById('popupProductImage');
        if (product.imageUrl) {
            productImage.src = product.imageUrl;
            productImage.style.display = 'block';
        } else {
            productImage.style.display = 'none';
        }
        document.getElementById('popupProductCategory').textContent = product.category || 'N/A';
        document.getElementById('popupProductPrice').textContent = product.price !== undefined ? product.price.toFixed(2) : 'N/A';
        document.getElementById('popupProductStock').textContent = product.stock !== undefined ? product.stock : 'N/A';
        document.getElementById('popupProductDescription').textContent = product.description || '';

        productPopupModal.style.display = 'block';
    }

    // Làm cho closeProductPopup có thể truy cập toàn cục hoặc gắn event listener cụ thể
    window.closeProductPopup = function() {
        if (productPopupModal) {
            productPopupModal.style.display = 'none';
        }
    }

    // Đóng popup nếu người dùng nhấp ra ngoài nội dung modal
    window.addEventListener('click', (event) => {
        if (event.target === productPopupModal) {
            closeProductPopup();
        }
    });
    // --- Kết thúc các hàm cho Product Popup ---


    // Xử lý tìm kiếm
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
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
                    // API endpoint cho gợi ý
                    const response = await fetch(`/api/search/suggestions?index=products&field=name.suggest&prefix=${encodeURIComponent(prefix)}`); //
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ message: response.statusText }));
                        throw new Error(`Lỗi HTTP! status: ${response.status}, message: ${errorData.message}`);
                    }
                    const suggestions = await response.json(); // Mong đợi mảng {text, score, product}

                    suggestionsContainer.innerHTML = '';
                    if (suggestions && suggestions.length > 0) {
                        suggestionsContainer.style.display = 'block';
                        suggestions.forEach(sugg => {
                            const div = document.createElement('div');
                            div.textContent = sugg.text; // Hiển thị văn bản được gợi ý
                            div.classList.add('suggestion-item');
                            div.addEventListener('click', () => {
                                // Khi một gợi ý được nhấp, hiển thị popup sản phẩm
                                displayProductPopup(sugg.product); // sugg.product nên là _source
                                suggestionsContainer.innerHTML = '';
                                suggestionsContainer.style.display = 'none';
                                // Tùy chọn: Bạn có thể muốn xóa input tìm kiếm hoặc điền nó,
                                // nhưng vì chúng ta hiển thị popup, có lẽ không submit form.
                                // searchInput.value = sugg.text;
                                // searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                            });
                            suggestionsContainer.appendChild(div);
                        });
                    } else {
                        suggestionsContainer.style.display = 'none';
                    }
                } catch (error) {
                    console.error("Lỗi khi lấy gợi ý:", error);
                    suggestionsContainer.innerHTML = `<div class="suggestion-item">Lỗi: ${error.message}</div>`;
                    suggestionsContainer.style.display = 'block'; // Hiển thị lỗi trong ô gợi ý
                }
            }, 300); // Chờ 300ms sau khi người dùng ngừng gõ
        });

        // Ẩn gợi ý khi nhấp ra ngoài
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
            }
        });
    }
});