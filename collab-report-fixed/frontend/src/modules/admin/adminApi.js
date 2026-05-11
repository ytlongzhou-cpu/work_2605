import axios from 'axios';

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

export async function getUserPermissions(userId) {
    try {
        const res = await axios.get(`/api/permissions/${userId}`);
        return res.data;
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

export async function getAuditLogs() {
    try {
        const res = await axios.get('/api/audit');
        return res.data;
    } catch(err) {
        return { success:false, error: err.message, code: err.response?.status || 500 };
    }
}
