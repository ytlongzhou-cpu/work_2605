import axiosInstance from '../auth/axiosInstance';

/** 将 HTTP 状态码转为中文错误信息 */
function toChineseError(err) {
  const code = err.response?.status || 500;
  // 优先用后端返回的中文 error 字段
  const serverMsg = err.response?.data?.error;
  const map = {
    400: '请求参数错误',
    401: '请先登录',
    403: '权限不足，无法执行此操作',
    404: '资源不存在',
    409: '名称已存在，请换一个',
    500: '服务器内部错误，请稍后重试',
  };
  const msg = serverMsg || map[code] || `请求失败（${code}）`;
  return { success: false, error: msg, code };
}

export async function getDirectories() {
  try {
    const res = await axiosInstance.get('/api/directories');
    return res.data;
  } catch (err) {
    return toChineseError(err);
  }
}

export async function createDirectory(name, parentId = null) {
  try {
    const res = await axiosInstance.post('/api/directories', { name, parent_id: parentId });
    return res.data;
  } catch (err) {
    return toChineseError(err);
  }
}

export async function deleteDirectory(id) {
  try {
    const res = await axiosInstance.delete(`/api/directories/${id}`);
    return res.data;
  } catch (err) {
    return toChineseError(err);
  }
}

export async function toggleDirectoryArchive(id) {
  try {
    const res = await axiosInstance.put(`/api/directories/${id}/archive`);
    return res.data;
  } catch (err) {
    return toChineseError(err);
  }
}

export async function getFiles(directoryId, includeArchived = false) {
  try {
    const params = includeArchived ? { include_archived: 1 } : {};
    const res = await axiosInstance.get(`/api/directories/${directoryId}/files`, { params });
    return res.data;
  } catch (err) {
    return toChineseError(err);
  }
}

export async function createFile(name, directoryId) {
  try {
    const res = await axiosInstance.post('/api/files', { name, directory_id: directoryId });
    return res.data;
  } catch (err) {
    return toChineseError(err);
  }
}

export async function deleteFile(id) {
  try {
    const res = await axiosInstance.delete(`/api/files/${id}`);
    return res.data;
  } catch (err) {
    return toChineseError(err);
  }
}

export async function toggleFileArchive(id) {
  try {
    const res = await axiosInstance.put(`/api/files/${id}/archive`);
    return res.data;
  } catch (err) {
    return toChineseError(err);
  }
}
