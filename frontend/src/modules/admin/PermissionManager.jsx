import React, { useEffect, useState } from 'react';
import { getUsers, getUserPermissions, grantPermission, revokePermission } from './adminApi';
import { getDirectories } from '../file-manager/fileApi';

/**
 * 权限分配页组件
 *
 * BUG FIX：
 *   1. 原版没有加载目录列表，无法展示"授权目录"的下拉选项
 *   2. 新增授权表单（选目录 + 选权限类型）
 *   3. userId 类型需为 number，filter 时用严格相等
 */
export default function PermissionManager() {
    const [users, setUsers] = useState([]);
    const [dirs, setDirs] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [newDirId, setNewDirId] = useState('');
    const [newPermType, setNewPermType] = useState('read');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    const loadUsers = async () => {
        const res = await getUsers();
        if (res.success) setUsers(res.data);
    };

    const loadDirs = async () => {
        const res = await getDirectories();
        if (res.success) setDirs(res.data);
    };

    // BUG FIX：userId 是 number 类型，filter 时不做类型转换会导致全部过滤掉
    const loadPermissions = async (userId) => {
        const res = await getUserPermissions(userId);
        if (res.success) setPermissions(res.data);
    };

    useEffect(() => {
        loadUsers();
        loadDirs();
    }, []);

    useEffect(() => {
        if (selectedUser) loadPermissions(selectedUser.id);
        else setPermissions([]);
    }, [selectedUser]);

    const handleGrant = async () => {
        if (!selectedUser || !newDirId) { setMsg('请选择用户和目录'); return; }
        setSaving(true);
        setMsg('');
        const res = await grantPermission(selectedUser.id, Number(newDirId), newPermType);
        setSaving(false);
        if (res.success) {
            setMsg('授权成功');
            loadPermissions(selectedUser.id);
        } else {
            setMsg(res.error || '授权失败');
        }
    };

    const handleRevoke = async (permId) => {
        const res = await revokePermission(permId);
        if (res.success) loadPermissions(selectedUser.id);
        else alert(res.error || '撤销失败');
    };

    return (
        <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>权限分配</h3>

            {/* 用户选择 */}
            <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>选择用户：</label>
                <select
                    style={selectStyle}
                    value={selectedUser?.id ?? ''}
                    onChange={e => {
                        const u = users.find(u => u.id === Number(e.target.value));
                        setSelectedUser(u || null);
                        setMsg('');
                    }}
                >
                    <option value="">-- 请选择 --</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>{u.username}（{u.display_name}）</option>
                    ))}
                </select>
            </div>

            {selectedUser && (
                <>
                    {/* 授权表单 */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                        <select style={selectStyle} value={newDirId} onChange={e => setNewDirId(e.target.value)}>
                            <option value="">-- 选择目录 --</option>
                            {dirs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select style={selectStyle} value={newPermType} onChange={e => setNewPermType(e.target.value)}>
                            <option value="read">只读 (read)</option>
                            <option value="write">读写 (write)</option>
                        </select>
                        <button
                            style={{ padding: '6px 16px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                            onClick={handleGrant}
                            disabled={saving}
                        >
                            授权
                        </button>
                        {msg && <span style={{ fontSize: 12, color: msg.includes('成功') ? '#16a34a' : '#dc2626' }}>{msg}</span>}
                    </div>

                    {/* 当前权限列表 */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#F1F5F9' }}>
                                <th style={th}>目录</th>
                                <th style={th}>权限</th>
                                <th style={th}>授权时间</th>
                                <th style={th}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {permissions.map(p => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                    <td style={td}>{p.directory_name}</td>
                                    <td style={td}>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                                            background: p.perm_type === 'write' ? '#DCFCE7' : '#EFF6FF',
                                            color: p.perm_type === 'write' ? '#16A34A' : '#2563EB',
                                        }}>
                                            {p.perm_type === 'write' ? '读写' : '只读'}
                                        </span>
                                    </td>
                                    <td style={td}>{new Date(p.granted_at).toLocaleString('zh-CN')}</td>
                                    <td style={td}>
                                        <button
                                            style={{ padding: '3px 10px', border: '1px solid #FCA5A5', borderRadius: 4, background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: 12 }}
                                            onClick={() => handleRevoke(p.id)}
                                        >
                                            撤销
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {permissions.length === 0 && (
                                <tr><td colSpan={4} style={{ ...td, color: '#94A3B8', textAlign: 'center' }}>该用户暂无权限</td></tr>
                            )}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
}

const labelStyle = { fontSize: 13, color: '#374151', marginRight: 8 };
const selectStyle = { padding: '6px 10px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 13, outline: 'none' };
const th = { padding: '8px 12px', fontWeight: 600, color: '#374151', fontSize: 12, textAlign: 'left' };
const td = { padding: '7px 12px', color: '#374151' };
