// BUG FIX：必须用带 Token 拦截器的 axiosInstance，裸 axios 无 Authorization 头
import axios from '../auth/axiosInstance';

/**
 * 管理后台 API 封装
 */

export async function getUsers() {
    try {
        const res = await axios.get('/api/users');
        return res.data;
    } catch(err) {
        return { success:false, error: err.message, code: err.response?.status || 500 };
    }
}

export async function createUser(username, password, display_name) {
    try {
        const res = await axios.post('/api/users', { username, password, display_name, role: 'user' });
        return res.data;
    } catch(err) {
        return { success:false, error: err.message, code: err.response?.status || 500 };
    }
}

export async function deleteUser(id) {
    try {
        const res = await axios.delete(`/api/users/${id}`);
        return res.data;
    } catch(err) {
        return { success:false, error: err.message, code: err.response?.status || 500 };
    }
}

// BUG FIX：后端只有 GET /api/permissions（返回全部），没有按 userId 的路由
// 前端改为获取全部权限后按 userId 客户端过滤
export async function getUserPermissions(userId) {
    try {
        const res = await axios.get('/api/permissions');
        if (!res.data.success) return res.data;
        const filtered = userId
            ? res.data.data.filter(p => p.user_id === userId)
            : res.data.data;
        return { success: true, data: filtered };
    } catch(err) {
        return { success:false, error: err.message, code: err.response?.status || 500 };
    }
}

export async function grantPermission(user_id, directory_id, perm_type) {
    try {
        const res = await axios.post('/api/permissions', { user_id, directory_id, perm_type });
        return res.data;
    } catch(err) {
        return { success:false, error: err.message, code: err.response?.status || 500 };
    }
}

export async function revokePermission(permissionId) {
    try {
        const res = await axios.delete(`/api/permissions/${permissionId}`);
        return res.data;
    } catch(err) {
        return { success:false, error: err.message, code: err.response?.status || 500 };
    }
}

// BUG FIX：支持传入 params 对象（page/limit/sheet_id/user_id/from/to）
export async function getAuditLogs(params = {}) {
    try {
        const res = await axios.get('/api/audit', { params });
        return res.data;
    } catch(err) {
        return { success:false, error: err.message, code: err.response?.status || 500 };
    }
}

// 获取所有文件列表（供审计日志筛选下拉使用）
export async function getAllFiles() {
    try {
        // 先取所有目录，再取每个目录的文件
        const dirsRes = await axios.get('/api/directories');
        if (!dirsRes.data.success) return { success: false, error: dirsRes.data.error, data: [] };
        const dirs = dirsRes.data.data;
        const filesList = [];
        for (const dir of dirs) {
            const fr = await axios.get(`/api/directories/${dir.id}/files`);
            if (fr.data.success) {
                fr.data.data.forEach(f => filesList.push({ ...f, dirName: dir.name }));
            }
        }
        return { success: true, data: filesList };
    } catch(err) {
        return { success: false, error: err.message, data: [] };
    }
}

// BUG FIX：补充缺失的 updateUser 导出（UserManagement.jsx 有 import 但原版文件无此函数）
export async function updateUser(id, fields) {
    try {
        const res = await axios.put(`/api/users/${id}`, fields);
        return res.data;
    } catch(err) {
        return { success:false, error: err.message, code: err.response?.status || 500 };
    }
}

/**
 * 重置用户密码
 * @param {number} userId - 用户ID
 * @param {string} password - 新密码
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function resetPassword(userId, password) {
    try {
        const res = await axios.post(`/api/users/${userId}/reset-password`, { password });
        return res.data;
    } catch(err) {
        return { success:false, error: err.message, code: err.response?.status || 500 };
    }
}
