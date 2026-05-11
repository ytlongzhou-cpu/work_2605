import React, { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from './adminApi';
import { useAuth } from '../auth/AuthContext';

/**
 * 用户管理页组件
 */
export default function UserManagement() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [newUsername, setNewUsername] = useState('');
    const [newDisplayName, setNewDisplayName] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const loadUsers = async () => {
        const res = await getUsers();
        if (res.success) setUsers(res.data);
    };

    useEffect(() => { loadUsers(); }, []);

    const handleCreate = async () => {
        const res = await createUser(newUsername, newPassword, newDisplayName);
        if(res.success) loadUsers();
    };

    const handleDelete = async (id) => {
        const res = await deleteUser(id);
        if(res.success) loadUsers();
    };

    return (
        <div>
            <h3>用户管理</h3>
            <div>
                <input placeholder="用户名" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
                <input placeholder="显示名" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} />
                <input placeholder="密码" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <button onClick={handleCreate}>新建用户</button>
            </div>
            <ul>
                {users.map(u => (
                    <li key={u.id}>
                        {u.username} ({u.display_name}) [{u.role}]
                        <button onClick={() => handleDelete(u.id)}>删除</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
