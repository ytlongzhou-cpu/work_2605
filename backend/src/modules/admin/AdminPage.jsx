import React, { useState } from 'react';
import UserManagement from './UserManagement';
import PermissionManager from './PermissionManager';
import AuditLog from './AuditLog';

/**
 * 管理后台容器组件
 */
export default function AdminPage() {
    const [activeTab, setActiveTab] = useState('users');

    const renderTab = () => {
        switch(activeTab) {
            case 'users': return <UserManagement />;
            case 'permissions': return <PermissionManager />;
            case 'audit': return <AuditLog />;
            default: return null;
        }
    };

    return (
        <div>
            <nav>
                <button onClick={() => setActiveTab('users')}>用户管理</button>
                <button onClick={() => setActiveTab('permissions')}>权限分配</button>
                <button onClick={() => setActiveTab('audit')}>审计日志</button>
            </nav>
            <div>{renderTab()}</div>
        </div>
    );
}
