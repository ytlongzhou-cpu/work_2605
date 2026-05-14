import React, { useEffect, useState, useCallback } from 'react';
import { getAuditLogs, getUsers, getAllFiles } from './adminApi';

/**
 * 审计日志页组件
 *
 * 筛选条件：
 *   1. 操作人（下拉，从用户列表加载）
 *   2. 文件名（下拉，从文件列表加载）—— 替代难用的 Sheet ID
 *   3. 开始日期 / 结束日期
 *   4. 关键字搜索（单元格坐标、改前改后值）
 */
export default function AuditLog() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // 分页
    const [page, setPage] = useState(1);
    const limit = 50;

    // 筛选条件
    const [filterUserId, setFilterUserId]   = useState('');
    const [filterFileId, setFilterFileId]   = useState('');  // 按文件筛选（更友好）
    const [filterFrom, setFilterFrom]       = useState('');
    const [filterTo, setFilterTo]           = useState('');
    const [filterKeyword, setFilterKeyword] = useState('');  // 前端关键字过滤

    // 用户列表 & 文件列表
    const [users, setUsers]   = useState([]);
    const [files, setFiles]   = useState([]);

    useEffect(() => {
        getUsers().then(res => { if (res.success) setUsers(res.data); });
        getAllFiles().then(res => { if (res.success) setFiles(res.data); });
    }, []);

    const loadLogs = useCallback(async (p = 1) => {
        setLoading(true);
        setError('');
        const params = { page: p, limit };
        if (filterUserId)  params.user_id  = filterUserId;
        if (filterFileId)  params.file_id  = filterFileId;
        if (filterFrom)    params.from     = filterFrom;
        if (filterTo)      params.to       = filterTo;

        const res = await getAuditLogs(params);
        if (res.success) {
            setLogs(res.data);
            setTotal(res.total ?? res.data.length);
        } else {
            setError(res.error || '加载失败');
        }
        setLoading(false);
    }, [filterUserId, filterFileId, filterFrom, filterTo]);

    useEffect(() => {
        setPage(1);
        loadLogs(1);
    }, [loadLogs]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        loadLogs(1);
    };

    const handleReset = () => {
        setFilterUserId('');
        setFilterFileId('');
        setFilterFrom('');
        setFilterTo('');
        setFilterKeyword('');
    };

    const hasFilter = filterUserId || filterFileId || filterFrom || filterTo || filterKeyword;
    const totalPages = Math.ceil(total / limit);

    // 前端关键字过滤（对已加载的当页数据）
    const displayLogs = filterKeyword
        ? logs.filter(l => {
            const kw = filterKeyword.toLowerCase();
            return (
                (l.display_name || '').toLowerCase().includes(kw) ||
                (l.cell_ref || '').toLowerCase().includes(kw) ||
                (l.old_value || '').toLowerCase().includes(kw) ||
                (l.new_value || '').toLowerCase().includes(kw)
            );
        })
        : logs;

    return (
        <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>审计日志</h3>

            {/* ── 筛选栏 ── */}
            <form onSubmit={handleSearch} style={filterBarStyle}>
                <div style={filterGroupStyle}>
                    <label style={labelStyle}>操作人</label>
                    <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} style={selectStyle}>
                        <option value="">全部用户</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
                        ))}
                    </select>
                </div>

                <div style={filterGroupStyle}>
                    <label style={labelStyle}>文件名</label>
                    <select value={filterFileId} onChange={e => setFilterFileId(e.target.value)} style={{ ...selectStyle, width: 180 }}>
                        <option value="">全部文件</option>
                        {files.map(f => (
                            <option key={f.id} value={f.id}>{f.dirName ? `${f.dirName} / ${f.name}` : f.name}</option>
                        ))}
                    </select>
                </div>

                <div style={filterGroupStyle}>
                    <label style={labelStyle}>开始日期</label>
                    <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={inputStyle} />
                </div>

                <div style={filterGroupStyle}>
                    <label style={labelStyle}>结束日期</label>
                    <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={inputStyle} />
                </div>

                <div style={filterGroupStyle}>
                    <label style={labelStyle}>关键字</label>
                    <input
                        type="text"
                        placeholder="单元格/内容…"
                        value={filterKeyword}
                        onChange={e => setFilterKeyword(e.target.value)}
                        style={{ ...inputStyle, width: 130 }}
                    />
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                    <button type="submit" style={btnPrimary}>查询</button>
                    <button type="button" onClick={handleReset} style={btnDefault}>重置</button>
                </div>
            </form>

            {/* ── 状态提示 ── */}
            {loading && <p style={{ color: '#888', fontSize: 13 }}>加载中…</p>}
            {error   && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}

            {/* ── 结果统计 ── */}
            {!loading && !error && (
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 8px' }}>
                    共 {total} 条记录
                    {hasFilter && <span style={{ color: '#F59E0B', marginLeft: 6 }}>（已筛选）</span>}
                    {filterKeyword && displayLogs.length !== logs.length && (
                        <span style={{ color: '#8B5CF6', marginLeft: 6 }}>关键字匹配 {displayLogs.length} 条</span>
                    )}
                </p>
            )}

            {/* ── 日志表格 ── */}
            {!loading && !error && (
                <>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                                    <th style={th}>操作人</th>
                                    <th style={th}>单元格</th>
                                    <th style={th}>修改前</th>
                                    <th style={th}>修改后</th>
                                    <th style={th}>Sheet ID</th>
                                    <th style={th}>时间</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayLogs.map(l => (
                                    <tr key={l.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                        <td style={td}>{l.display_name}</td>
                                        <td style={{ ...td, fontFamily: 'monospace', color: '#1E40AF', fontWeight: 600 }}>{l.cell_ref}</td>
                                        <td style={{ ...td, color: '#EF4444', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            title={l.old_value}>{l.old_value ?? '—'}</td>
                                        <td style={{ ...td, color: '#16A34A', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            title={l.new_value}>{l.new_value ?? '—'}</td>
                                        <td style={{ ...td, color: '#94A3B8', fontSize: 11 }}>{l.sheet_id}</td>
                                        <td style={{ ...td, whiteSpace: 'nowrap', color: '#64748B' }}>
                                            {new Date(l.changed_at).toLocaleString('zh-CN')}
                                        </td>
                                    </tr>
                                ))}
                                {displayLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ ...td, color: '#94A3B8', textAlign: 'center', padding: '24px 0' }}>
                                            {hasFilter ? '没有符合条件的记录' : '暂无记录'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* ── 分页 ── */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', fontSize: 13 }}>
                            <button
                                disabled={page <= 1}
                                onClick={() => { const p = page - 1; setPage(p); loadLogs(p); }}
                                style={page <= 1 ? btnDisabled : btnDefault}
                            >上一页</button>
                            <span style={{ color: '#64748B' }}>第 {page} / {totalPages} 页，共 {total} 条</span>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => { const p = page + 1; setPage(p); loadLogs(p); }}
                                style={page >= totalPages ? btnDisabled : btnDefault}
                            >下一页</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

const filterBarStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-end',
    background: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 16,
};
const filterGroupStyle = { display: 'flex', flexDirection: 'column', gap: 4 };
const labelStyle = { fontSize: 11, color: '#64748B', fontWeight: 600 };
const inputStyle  = { fontSize: 13, padding: '4px 8px', border: '1px solid #CBD5E1', borderRadius: 5, outline: 'none', height: 30, boxSizing: 'border-box' };
const selectStyle = { ...inputStyle, width: 140 };
const btnPrimary  = { fontSize: 13, padding: '4px 14px', background: '#1E40AF', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', height: 30 };
const btnDefault  = { fontSize: 13, padding: '4px 14px', background: '#fff', color: '#374151', border: '1px solid #CBD5E1', borderRadius: 5, cursor: 'pointer', height: 30 };
const btnDisabled = { ...btnDefault, opacity: 0.4, cursor: 'not-allowed' };
const th = { padding: '8px 12px', fontWeight: 600, color: '#374151', fontSize: 12, whiteSpace: 'nowrap' };
const td = { padding: '7px 12px', color: '#374151' };
