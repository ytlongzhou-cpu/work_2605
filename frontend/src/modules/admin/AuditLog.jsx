import React, { useEffect, useState } from 'react';
import { getAuditLogs } from './adminApi';

/**
 * 审计日志页组件
 *
 * BUG FIX：
 *   1. 字段名对齐后端：display_name（非 displayName）、sheet_id（非 sheetId）
 *   2. 增加加载状态和错误提示，避免空白页
 *   3. 增加分页支持（total 字段）
 */
export default function AuditLog() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // 筛选条件
    const [page, setPage] = useState(1);
    const limit = 50;

    const loadLogs = async (p = 1) => {
        setLoading(true);
        setError('');
        const res = await getAuditLogs({ page: p, limit });
        if (res.success) {
            setLogs(res.data);
            setTotal(res.total ?? res.data.length);
        } else {
            setError(res.error || '加载失败');
        }
        setLoading(false);
    };

    useEffect(() => { loadLogs(page); }, [page]);

    const totalPages = Math.ceil(total / limit);

    return (
        <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>审计日志</h3>
            {loading && <p style={{ color: '#888' }}>加载中…</p>}
            {error && <p style={{ color: '#dc2626' }}>{error}</p>}

            {!loading && !error && (
                <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                                <th style={th}>操作人</th>
                                <th style={th}>Sheet ID</th>
                                <th style={th}>单元格</th>
                                <th style={th}>修改前</th>
                                <th style={th}>修改后</th>
                                <th style={th}>时间</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(l => (
                                <tr key={l.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                    {/* BUG FIX：后端返回 display_name，不是 displayName */}
                                    <td style={td}>{l.display_name}</td>
                                    {/* BUG FIX：后端返回 sheet_id，不是 sheetId */}
                                    <td style={td}>{l.sheet_id}</td>
                                    <td style={td}>{l.cell_ref}</td>
                                    <td style={td}>{l.old_value ?? '—'}</td>
                                    <td style={td}>{l.new_value ?? '—'}</td>
                                    <td style={td}>{new Date(l.changed_at).toLocaleString('zh-CN')}</td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr><td colSpan={6} style={{ ...td, color: '#94A3B8', textAlign: 'center' }}>暂无记录</td></tr>
                            )}
                        </tbody>
                    </table>

                    {/* 分页 */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', fontSize: 13 }}>
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button>
                            <span>第 {page} / {totalPages} 页，共 {total} 条</span>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

const th = { padding: '8px 12px', fontWeight: 600, color: '#374151', fontSize: 12 };
const td = { padding: '7px 12px', color: '#374151' };
