const esService = require('../services/elasticsearchService');
const User = require('../models/userModel');
// Cần thêm logic để phân tích log Nginx hoặc dùng Prometheus/Grafana cho request-stats chính xác

exports.getNodesStatus = async (req, res) => {
    try {
        const health = await esService.getClusterHealth();
        const nodesInfo = await esService.getNodesInfo(); // Lấy thông tin chi tiết hơn
        const nodesStats = await esService.getNodesStats(); // Lấy stats

        let liveNodes = [];
        if (nodesInfo && nodesInfo.nodes) {
            for (const nodeId in nodesInfo.nodes) {
                const node = nodesInfo.nodes[nodeId];
                const nodeStat = nodesStats.nodes ? nodesStats.nodes[nodeId] : null;
                liveNodes.push({
                    id: nodeId,
                    name: node.name,
                    ip: node.ip, // Hoặc node.http.publish_address
                    roles: node.roles,
                    is_master: health.master_node === nodeId, // Kiểm tra node hiện tại có phải master không
                    http_address: node.http ? node.http.publish_address : 'N/A',
                    // Lấy một vài stats cơ bản
                    jvm_heap_used_percent: node.jvm ? node.jvm.mem.heap_used_percent : 'N/A',
                    os_cpu_percent: node.os && node.os.cpu ? node.os.cpu.percent : 'N/A',
                    // total_http_opened: nodeStat && nodeStat.http ? nodeStat.http.total_opened : 'N/A'
                });
            }
        }

        res.json({
            cluster_name: health.cluster_name,
            status: health.status, // green, yellow, red
            number_of_nodes: health.number_of_nodes,
            number_of_data_nodes: health.number_of_data_nodes,
            active_primary_shards: health.active_primary_shards,
            active_shards: health.active_shards,
            relocating_shards: health.relocating_shards,
            initializing_shards: health.initializing_shards,
            unassigned_shards: health.unassigned_shards,
            live_nodes: liveNodes
        });
    } catch (error) {
        console.error("Error in getNodesStatus:", error);
        res.status(500).json({ message: 'Failed to get Elasticsearch node status.', error: error.message });
    }
};

exports.getRequestStats = async (req, res) => {
    // Đây là phần phức tạp.
    // 1. Lấy từ Elasticsearch: _nodes/stats/http sẽ cho total_opened connections, không phải số query.
    // 2. Phân tích log Nginx: Cần cấu hình Nginx ghi log chi tiết và có một tiến trình phân tích log đó.
    // 3. Dùng tool giám sát chuyên dụng: Prometheus + Elasticsearch Exporter + Nginx Exporter, rồi query từ Grafana.

    // Ví dụ đơn giản (không chính xác cho "request của từng node"):
    try {
        const nodesStats = await esService.getNodesStats();
        let totalRequests = 0;
        const nodeRequests = {};

        if (nodesStats && nodesStats.nodes) {
            for (const nodeId in nodesStats.nodes) {
                const httpStats = nodesStats.nodes[nodeId].http;
                if (httpStats) {
                    const nodeTotalOpened = httpStats.total_opened || 0;
                    nodeRequests[nodesStats.nodes[nodeId].name] = nodeTotalOpened;
                    totalRequests += nodeTotalOpened;
                }
            }
        }
        res.json({
            message: "Đây là tổng số kết nối HTTP đã mở tới các node ES, không phải số lượng request tìm kiếm cụ thể. Cần giải pháp giám sát nâng cao hơn.",
            total_http_connections_opened_cluster: totalRequests,
            http_connections_opened_per_node: nodeRequests
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get request stats.', error: error.message });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Không trả về password
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to get users.', error: error.message });
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role specified.' });
        }
        const user = await User.findByIdAndUpdate(userId, { role }, { new: true, runValidators: true }).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ message: 'User role updated successfully.', user });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update user role.', error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        // Xóa lịch sử tìm kiếm của user này (tùy chọn)
        await SearchHistory.deleteMany({ userId: userId });
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete user.', error: error.message });
    }
};