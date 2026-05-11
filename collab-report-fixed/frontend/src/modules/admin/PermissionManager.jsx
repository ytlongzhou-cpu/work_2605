import React, { useEffect, useState } from 'react';
import { getUsers, getUserPermissions, grantPermission, revokePermission } from './adminApi';

/**
 * 权限分配页组件
 */
export default function PermissionManager() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [permissions, setPermissions] = useState([]);

    const loadUsers = async () => {
        const res = await getUsers();
        if(res.success) setUsers(res.data);
    };

    const loadPermissions = async (userId) => {
        const res = await getUserPermissions(userId);
        if(res.success) setPermissions(res.data);
    };

    useEffect(() => { loadUsers(); }, []);

    useEffect(() => { if(selectedUser) loadPermissions(selectedUser.id); }, [selectedUser]);

    return (
        <div>
            <h3>权限分配</h3>
            <div>
                <select onChange={e => setSelectedUser(users.find(u => u.id === parseInt(e.target.value)))}>
                    <option value="">选择用户</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
            </div>
            <div>
                {permissions.map(p => (
                    <div key={p.id}>
                        {p.directory_name} - {p.perm_type}
                        <button onClick={() => revokePermission(p.id).then(() => loadPermissions(selectedUser.id))}>撤销</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
