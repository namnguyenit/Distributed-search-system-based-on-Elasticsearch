const esService = require('../services/elasticsearchService');
const User = require('../models/userModel');

exports.getNodesStatus = async (req, res) => {
    try {
        const health = await esService.getClusterHealth();
        const nodesInfo = await esService.getNodesInfo();
        const nodesStats = await esService.getNodesStats();

        let liveNodes = [];
        if (nodesInfo && nodesInfo.nodes) {
            for (const nodeId in nodesInfo.nodes) {
                const node = nodesInfo.nodes[nodeId];
                const nodeStat = nodesStats.nodes ? nodesStats.nodes[nodeId] : null;
                liveNodes.push({
                    id: nodeId,
                    name: node.name,
                    ip: node.ip,
                    roles: node.roles,
                    is_master: health.master_node === nodeId,
                    http_address: node.http ? node.http.publish_address : 'N/A',
                    jvm_heap_used_percent: nodeStat && nodeStat.jvm && nodeStat.jvm.mem ? nodeStat.jvm.mem.heap_used_percent : (node.jvm && node.jvm.mem ? node.jvm.mem.heap_used_percent : 'N/A'),
                    os_cpu_percent: nodeStat && nodeStat.os && nodeStat.os.cpu ? nodeStat.os.cpu.percent : (node.os && node.os.cpu ? node.os.cpu.percent : 'N/A')
                });
            }
        }

        res.json({
            cluster_name: health.cluster_name,
            status: health.status,
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
        const users = await User.find().select('-password');
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
        await SearchHistory.deleteMany({ userId: userId });
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete user.', error: error.message });
    }
};

// Basic stress test: gửi nhiều request tìm kiếm song song
// Sử dụng batch/pool để giới hạn số lượng request đồng thời khi stress test
exports.basicStressTest = async (req, res) => {
    const { numClients, numRequests } = req.body;
    const clients = parseInt(numClients) || 1;
    const requestsPerClient = parseInt(numRequests) || 1;
    const totalRequests = clients * requestsPerClient;
    const searchBody = {
        index: 'products',
        body: { query: { match_all: {} } }
    };
    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();
    const concurrency = 100; // Số lượng request đồng thời tối đa
    let running = 0;
    let finished = 0;
    let next = 0;
    function runOne() {
        running++;
        return esService.esClient.search(searchBody)
            .then(() => { successCount++; })
            .catch(() => { failCount++; })
            .finally(() => {
                running--;
                finished++;
                if (next < totalRequests) {
                    runOne();
                    next++;
                }
            });
    }
    // Khởi tạo batch đầu tiên
    const starters = [];
    for (let i = 0; i < Math.min(concurrency, totalRequests); i++) {
        starters.push(runOne());
        next++;
    }
    // Đợi cho đến khi tất cả hoàn thành
    while (finished < totalRequests) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 20));
    }
    const totalTime = Date.now() - startTime;
    res.json({
        success: true,
        totalRequests,
        successCount,
        failCount,
        totalTime,
        avgTime: (totalTime / totalRequests).toFixed(2)
    });
};