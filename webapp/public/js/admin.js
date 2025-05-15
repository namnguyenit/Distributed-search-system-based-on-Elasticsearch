document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;

    if (path.includes('/admin/dashboard')) {
        loadAdminDashboardOverview();
    }
    if (path.includes('/admin/nodes')) {
        loadNodeStatus();
    }
    if (path.includes('/admin/users')) {
        loadUserList();
    }
    if (path.includes('/admin/request-stats')) {
        loadRequestStats();
    }

    async function fetchData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`API Error: ${response.status} - ${errorData.message || 'Unknown error'}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Lỗi khi fetch dữ liệu từ ${url}:`, error);
            return null; // Trả về null để xử lý lỗi ở nơi gọi
        }
    }

    async function loadAdminDashboardOverview() {
        const activeNodesCountEl = document.getElementById('activeNodesCount');
        const totalUsersCountEl = document.getElementById('totalUsersCount');
        const clusterStatusEl = document.getElementById('clusterStatus');

        if(activeNodesCountEl) {
            const nodeData = await fetchData('/api/admin/nodes-status');
            if (nodeData) {
                activeNodesCountEl.textContent = nodeData.number_of_nodes || 'Lỗi';
                clusterStatusEl.textContent = nodeData.status ? nodeData.status.toUpperCase() : 'Lỗi';
                clusterStatusEl.className = `status-${nodeData.status || 'red'}`;
            } else {
                activeNodesCountEl.textContent = 'Lỗi tải';
                clusterStatusEl.textContent = 'Lỗi tải';
            }
        }

        if(totalUsersCountEl) {
            const userData = await fetchData('/api/admin/users');
            if(userData) {
                totalUsersCountEl.textContent = userData.length || '0';
            } else {
                totalUsersCountEl.textContent = 'Lỗi tải';
            }
        }
    }


    async function loadNodeStatus() {
        const container = document.getElementById('nodeStatusContainer');
        if (!container) return;

        const data = await fetchData('/api/admin/nodes-status');
        if (data) {
            let html = `
                <h2>Thông tin Cluster</h2>
                <p><strong>Tên Cluster:</strong> ${data.cluster_name}</p>
                <p><strong>Trạng thái:</strong> <span class="status-${data.status}">${data.status ? data.status.toUpperCase() : 'N/A'}</span></p>
                <p><strong>Tổng số Node:</strong> ${data.number_of_nodes}</p>
                <p><strong>Số Data Node:</strong> ${data.number_of_data_nodes}</p>
                <p><strong>Active Primary Shards:</strong> ${data.active_primary_shards}</p>
                <p><strong>Active Shards:</strong> ${data.active_shards}</p>
                <p><strong>Relocating Shards:</strong> ${data.relocating_shards}</p>
                <p><strong>Initializing Shards:</strong> ${data.initializing_shards}</p>
                <p><strong>Unassigned Shards:</strong> ${data.unassigned_shards}</p>
                <h2>Node Chi tiết</h2>`;

            if (data.live_nodes && data.live_nodes.length > 0) {
                html += `
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên Node</th>
                                <th>Địa chỉ HTTP</th>
                                <th>Vai trò</th>
                                <th>Master?</th>
                                <th>JVM Heap (%)</th>
                                <th>OS CPU (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                data.live_nodes.forEach(node => {
                    html += `
                        <tr>
                            <td>${node.id}</td>
                            <td>${node.name}</td>
                            <td>${node.http_address || 'N/A'}</td>
                            <td>${node.roles ? node.roles.join(', ') : 'N/A'}</td>
                            <td>${node.is_master ? 'Có' : 'Không'}</td>
                            <td>${node.jvm_heap_used_percent || 'N/A'}</td>
                            <td>${node.os_cpu_percent || 'N/A'}</td>
                        </tr>
                    `;
                });
                html += `</tbody></table>`;
            } else {
                html += "<p>Không có thông tin node chi tiết hoặc không có node nào hoạt động.</p>";
            }
            container.innerHTML = html;
        } else {
            container.innerHTML = "<p>Không thể tải thông tin trạng thái node. Vui lòng thử lại.</p>";
        }
    }

    async function loadUserList() {
        const container = document.getElementById('userListContainer');
        if (!container) return;

        const users = await fetchData('/api/admin/users');
        if (users) {
            let html = `
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Tên đăng nhập</th>
                            <th>Email</th>
                            <th>Vai trò</th>
                            <th>Ngày tạo</th>
                            <th>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            users.forEach(user => {
                html += `
                    <tr data-user-id="${user._id}">
                        <td>${user._id}</td>
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>
                            <select class="user-role-select" data-original-role="${user.role}">
                                <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </td>
                        <td>${new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td class="user-actions">
                            <button class="btn-update-role" disabled>Cập nhật</button>
                            <button class="btn-delete-user">Xóa</button>
                        </td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
            container.innerHTML = html;
            attachUserActionListeners();
        } else {
            container.innerHTML = "<p>Không thể tải danh sách người dùng. Vui lòng thử lại.</p>";
        }
    }

    function attachUserActionListeners() {
        document.querySelectorAll('.user-role-select').forEach(select => {
            select.addEventListener('change', function() {
                const row = this.closest('tr');
                const updateButton = row.querySelector('.btn-update-role');
                updateButton.disabled = this.value === this.dataset.originalRole;
            });
        });

        document.querySelectorAll('.btn-update-role').forEach(button => {
            button.addEventListener('click', async function() {
                const row = this.closest('tr');
                const userId = row.dataset.userId;
                const newRole = row.querySelector('.user-role-select').value;
                if (confirm(`Bạn có chắc muốn thay đổi vai trò của người dùng này thành "${newRole}" không?`)) {
                    try {
                        const response = await fetch(`/api/admin/users/${userId}/role`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ role: newRole })
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.message || 'Lỗi cập nhật');
                        alert('Cập nhật vai trò thành công!');
                        this.disabled = true; // Vô hiệu hóa lại nút
                        row.querySelector('.user-role-select').dataset.originalRole = newRole; // Cập nhật vai trò gốc
                    } catch (err) {
                        alert(`Lỗi: ${err.message}`);
                    }
                }
            });
        });

        document.querySelectorAll('.btn-delete-user').forEach(button => {
            button.addEventListener('click', async function() {
                const row = this.closest('tr');
                const userId = row.dataset.userId;
                const username = row.cells[1].textContent; // Lấy username để hiển thị trong confirm
                if (confirm(`Bạn có chắc muốn xóa người dùng "${username}" (ID: ${userId}) không? Hành động này không thể hoàn tác.`)) {
                     try {
                        const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.message || 'Lỗi xóa người dùng');
                        alert('Xóa người dùng thành công!');
                        row.remove(); // Xóa hàng khỏi bảng
                    } catch (err) {
                        alert(`Lỗi: ${err.message}`);
                    }
                }
            });
        });
    }


    async function loadRequestStats() {
        const container = document.getElementById('requestStatsContainer');
        if (!container) return;
        const existingWarning = container.querySelector('.warning');
        const loadingMessage = container.querySelector('p:not(.warning)');


        const data = await fetchData('/api/admin/request-stats');
        if(loadingMessage) loadingMessage.remove(); // Xóa thông báo "Đang tải..."

        if (data) {
            let html = `<p class="warning">${existingWarning ? existingWarning.innerHTML : ''}</p>`; // Giữ lại warning nếu có
            html += `
                <h3>Tổng số kết nối HTTP đã mở đến Cluster: ${data.total_http_connections_opened_cluster || 'N/A'}</h3>
            `;
            if (data.http_connections_opened_per_node) {
                html += `<h4>Chi tiết từng Node:</h4>
                         <table>
                            <thead><tr><th>Tên Node</th><th>Số kết nối HTTP đã mở</th></tr></thead>
                            <tbody>`;
                for (const nodeName in data.http_connections_opened_per_node) {
                    html += `<tr><td>${nodeName}</td><td>${data.http_connections_opened_per_node[nodeName]}</td></tr>`;
                }
                html += `</tbody></table>`;
            }
             container.innerHTML = html;
        } else {
            container.innerHTML = `<p class="warning">${existingWarning ? existingWarning.innerHTML : ''}</p> <p>Không thể tải thông tin thống kê. Vui lòng thử lại.</p>`;
        }
    }

});