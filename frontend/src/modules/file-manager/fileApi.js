import axiosInstance from '../auth/axiosInstance';

export async function getDirectories() {
  try {
    const res = await axiosInstance.get('/api/directories');
    return res.data;
  } catch (err) {
    return { success: false, error: err.message, code: err.response?.status || 500 };
  }
}

export async function createDirectory(name, parentId = null) {
  try {
    const res = await axiosInstance.post('/api/directories', { name, parent_id: parentId });
    return res.data;
  } catch (err) {
    return { success: false, error: err.message, code: err.response?.status || 500 };
  }
}

export async function deleteDirectory(id) {
  try {
    const res = await axiosInstance.delete(`/api/directories/${id}`);
    return res.data;
  } catch (err) {
    return { success: false, error: err.message, code: err.response?.status || 500 };
  }
}

export async function toggleDirectoryArchive(id) {
  try {
    const res = await axiosInstance.put(`/api/directories/${id}/archive`);
    return res.data;
  } catch (err) {
    return { success: false, error: err.message, code: err.response?.status || 500 };
  }
}

export async function getFiles(directoryId) {
  try {
    const res = await axiosInstance.get(`/api/directories/${directoryId}/files`);
    return res.data;
  } catch (err) {
    return { success: false, error: err.message, code: err.response?.status || 500 };
  }
}

export async function createFile(name, directoryId) {
  try {
    const res = await axiosInstance.post('/api/files', { name, directory_id: directoryId });
    return res.data;
  } catch (err) {
    return { success: false, error: err.message, code: err.response?.status || 500 };
  }
}

export async function deleteFile(id) {
  try {
    const res = await axiosInstance.delete(`/api/files/${id}`);
    return res.data;
  } catch (err) {
    return { success: false, error: err.message, code: err.response?.status || 500 };
  }
}

export async function toggleFileArchive(id) {
  try {
    const res = await axiosInstance.put(`/api/files/${id}/archive`);
    return res.data;
  } catch (err) {
    return { success: false, error: err.message, code: err.response?.status || 500 };
  }
}
