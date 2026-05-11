import React, { useEffect, useState } from 'react';
import { getAuditLogs } from './adminApi';

/**
 * 审计日志页组件
 */
export default function AuditLog() {
    const [logs, setLogs] = useState([]);

    const loadLogs = async () => {
        const res = await getAuditLogs();
        if(res.success) setLogs(res.data);
    };

    useEffect(() => { loadLogs(); }, []);

    return (
        <div>
            <h3>审计日志</h3>
            <ul>
                {logs.map(l => (
                    <li key={l.id}>{l.displayName} 修改 {l.sheetId} 的 {l.old_value} -> {l.new_value} ({l.changed_at})</li>
                ))}
            </ul>
        </div>
    );
}
