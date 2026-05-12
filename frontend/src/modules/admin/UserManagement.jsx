import React, { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from './adminApi';
import { useAuth } from '../auth/AuthContext';

/**
 * 用户管理页组件
 *
 * BUG FIX：
 *   1. 导入了 updateUser 但原 adminApi 无此导出（已在 adminApi.js 补充）
 *   2. "删除" 按钮实际是软禁用，改为"禁用/启用"更准确
 *   3. 新增重置密码功能入口
 *   4. 新建用户后清空表单
 */
export default function UserManagement() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ username: '', display_name: '', password: '', role: 'user' });
    const [creating, setCreating] = useState(false);
    const [msg, setMsg] = useState('');
    
    // 重置密码弹窗状态
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetUserId, setResetUserId] = useState(null);
    const [resetPasswordValue, setResetPasswordValue] = useState('');
    const [resetting, setResetting] = useState(false);
    const [resetMsg, setResetMsg] = useState('');

    const loadUsers = async () => {
        setLoading(true);
        const res = await getUsers();
        if (res.success) setUsers(res.data);
        setLoading(false);
    };

    useEffect(() => { loadUsers(); }, []);

    const handleCreate = async () => {
        if (!form.username.trim() || !form.password || !form.display_name.trim()) {
            setMsg('请填写用户名、显示名和密码');
            return;
        }
        setCreating(true);
        setMsg('');
        const res = await createUser(form.username.trim(), form.password, form.display_name.trim());
        setCreating(false);
        if (res.success) {
            setMsg('用户创建成功');
            setForm({ username: '', display_name: '', password: '', role: 'user' });
            loadUsers();
        } else {
            setMsg(res.error || '创建失败');
        }
    };

    // BUG FIX：deleteUser 实为软禁用，此处做切换
    const handleToggleActive = async (u) => {
        const res = await updateUser(u.id, { is_active: u.is_active ? 0 : 1 });
        if (res.success) loadUsers();
        else alert(res.error || '操作失败');
    };

    /**
     * 打开重置密码弹窗
     */
    const handleOpenResetModal = (userId) => {
        setResetUserId(userId);
        setResetPasswordValue('');
        setResetMsg('');
        setShowResetModal(true);
    };

    /**
     * 关闭重置密码弹窗
     */
    const handleCloseResetModal = () => {
        setShowResetModal(false);
        setResetUserId(null);
        setResetPasswordValue('');
        setResetMsg('');
    };

    /**
     * 提交重置密码
     */
    const handleResetPassword = async () => {
        if (!resetPasswordValue.trim() || resetPasswordValue.length < 6) {
            setResetMsg('密码长度不能少于6位');
            return;
        }
        setResetting(true);
        setResetMsg('');
        const res = await resetPassword(resetUserId, resetPasswordValue);
        setResetting(false);
        if (res.success) {
            setResetMsg('密码重置成功');
            setTimeout(() => {
                handleCloseResetModal();
            }, 1500);
        } else {
            setResetMsg(res.error || '重置失败');
        }
    };

    return (
        <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>用户管理</h3>

            {/* 新建用户表单 */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center', background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <input
                    style={inputStyle}
                    placeholder="用户名 *"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                />
                <input
                    style={inputStyle}
                    placeholder="显示名 *"
                    value={form.display_name}
                    onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                />
                <input
                    style={inputStyle}
                    type="password"
                    placeholder="密码 *"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
                <select
                    style={{ ...inputStyle, width: 100 }}
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                    <option value="user">普通用户</option>
                    <option value="admin">管理员</option>
                </select>
                <button
                    style={{ padding: '7px 18px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}
                    onClick={handleCreate}
                    disabled={creating}
                >
                    {creating ? '创建中…' : '新建用户'}
                </button>
                {msg && <span style={{ fontSize: 12, color: msg.includes('成功') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
            </div>

            {/* 用户列表 */}
            {loading ? (
                <p style={{ color: '#888' }}>加载中…</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#F1F5F9' }}>
                            <th style={th}>用户名</th>
                            <th style={th}>显示名</th>
                            <th style={th}>角色</th>
                            <th style={th}>状态</th>
                            <th style={th}>最后登录</th>
                            <th style={th}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} style={{ borderBottom: '1px solid #E2E8F0', opacity: u.is_active ? 1 : 0.5 }}>
                                <td style={td}>{u.username}</td>
                                <td style={td}>{u.display_name}</td>
                                <td style={td}>
                                    <span style={{
                                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                        background: u.role === 'admin' ? '#FEF3C7' : '#EFF6FF',
                                        color: u.role === 'admin' ? '#D97706' : '#2563EB',
                                    }}>
                                        {u.role === 'admin' ? '管理员' : '普通用户'}
                                    </span>
                                </td>
                                <td style={td}>
                                    <span style={{ color: u.is_active ? '#16A34A' : '#DC2626', fontWeight: 500 }}>
                                        {u.is_active ? '正常' : '已禁用'}
                                    </span>
                                </td>
                                <td style={td}>{u.last_login ? new Date(u.last_login).toLocaleString('zh-CN') : '—'}</td>
                                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                    {/* 不允许操作自己 */}
                                    {u.id !== currentUser?.id && (
                                        <span style={{ display: 'flex', gap: 4 }}>
                                            <button
                                                style={{
                                                    padding: '3px 8px', border: '1px solid', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                                                    borderColor: '#93C5FD', background: '#EFF6FF', color: '#2563EB'
                                                }}
                                                onClick={() => handleOpenResetModal(u.id)}
                                            >
                                                重置密码
                                            </button>
                                            <button
                                                style={{
                                                    padding: '3px 8px', border: '1px solid', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                                                    ...(u.is_active
                                                        ? { borderColor: '#FCA5A5', background: '#FEF2F2', color: '#DC2626' }
                                                        : { borderColor: '#86EFAC', background: '#F0FDF4', color: '#16A34A' })
                                                }}
                                                onClick={() => handleToggleActive(u)}
                                            >
                                                {u.is_active ? '禁用' : '启用'}
                                            </button>
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#94A3B8' }}>暂无用户</td></tr>
                        )}
                    </tbody>
                </table>
            )}

            {/* 重置密码弹窗 */}
            {showResetModal && (
                <div style={modalOverlayStyle} onClick={handleCloseResetModal}>
                    <div style={modalStyle} onClick={e => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <span style={modalTitleStyle}>重置密码</span>
                            <button style={modalCloseBtn} onClick={handleCloseResetModal}>×</button>
                        </div>
                        <div style={modalBodyStyle}>
                            <div style={formGroupStyle}>
                                <label style={modalLabelStyle}>新密码</label>
                                <input
                                    style={modalInputStyle}
                                    type="password"
                                    placeholder="请输入新密码（至少6位）"
                                    value={resetPasswordValue}
                                    onChange={e => setResetPasswordValue(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            {resetMsg && (
                                <span style={{ 
                                    fontSize: 12, 
                                    color: resetMsg.includes('成功') ? '#16a34a' : '#dc2626',
                                    display: 'block',
                                    marginTop: 8
                                }}>{resetMsg}</span>
                            )}
                        </div>
                        <div style={modalFooterStyle}>
                            <button style={cancelBtnStyle} onClick={handleCloseResetModal}>取消</button>
                            <button 
                                style={confirmBtnStyle} 
                                onClick={handleResetPassword}
                                disabled={resetting}
                            >
                                {resetting ? '重置中…' : '确认重置'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const inputStyle = { padding: '7px 10px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 13, outline: 'none', width: 140 };
const th = { padding: '8px 12px', fontWeight: 600, color: '#374151', fontSize: 12, textAlign: 'left' };
const td = { padding: '7px 12px', color: '#374151' };

// 弹窗样式
const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
};

const modalStyle = {
    background: '#fff',
    borderRadius: 8,
    width: '100%',
    maxWidth: 360,
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
};

const modalHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid #E2E8F0',
};

const modalTitleStyle = {
    fontSize: 15,
    fontWeight: 600,
    color: '#1F2937',
};

const modalCloseBtn = {
    background: 'none',
    border: 'none',
    fontSize: 20,
    color: '#9CA3AF',
    cursor: 'pointer',
    padding: 0,
    lineHeight: '1',
};

const modalBodyStyle = {
    padding: '16px',
};

const formGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
};

const modalLabelStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
};

const modalInputStyle = {
    height: 42,
    padding: '0 12px',
    fontSize: 14,
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    outline: 'none',
    transition: 'border-color 0.15s',
};

const modalFooterStyle = {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid #E2E8F0',
    justifyContent: 'flex-end',
};

const cancelBtnStyle = {
    padding: '6px 16px',
    border: '1px solid #D1D5DB',
    borderRadius: 6,
    background: '#fff',
    color: '#4B5563',
    cursor: 'pointer',
    fontSize: 13,
};

const confirmBtnStyle = {
    padding: '6px 16px',
    border: 'none',
    borderRadius: 6,
    background: '#2563EB',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
};
