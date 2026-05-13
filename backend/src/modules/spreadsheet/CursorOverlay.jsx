/**
 * 模块D：表格编辑器 - 多人协作光标浮层
 *
 * 叠加在 Handsontable 容器上，根据 otherCursors 数组绘制其他用户的
 * 彩色光标框和姓名标签。
 *
 * 实现思路：
 *   Handsontable 的每个单元格 TD 可通过 .htCore 表格 DOM 精确定位。
 *   本组件通过 hotRef（Handsontable 实例 ref）调用 getCell(row, col)
 *   获取 TD 元素，再读取其 offsetTop/offsetLeft/offsetWidth/offsetHeight，
 *   将光标框绝对定位到对应单元格。
 *
 * Props：
 *   hotRef      {React.RefObject}  - Handsontable 实例 ref（HotTable 组件的 ref）
 *   otherCursors {Array<{
 *     userId:      number,
 *     displayName: string,
 *     color:       string,   光标边框颜色
 *     row:         number,   0-based 行
 *     col:         number,   0-based 列
 *   }>}
 *   containerRef {React.RefObject} - 表格外层容器 div 的 ref（用于计算相对偏移）
 */

import React, { useLayoutEffect, useState } from 'react';

/**
 * 单个光标框的位置和样式信息
 * @typedef {{ key, top, left, width, height, color, displayName }} CursorRect
 */

/**
 * 多人光标浮层组件
 */
function CursorOverlay({ hotRef, otherCursors = [], containerRef }) {
  /** 各光标的位置矩形信息 */
  const [rects, setRects] = useState([]);

  /**
   * 每当 otherCursors 变化时，重新计算各光标的 DOM 位置。
   * 使用 useLayoutEffect 确保在浏览器绘制前完成定位计算，避免闪烁。
   */
  useLayoutEffect(() => {
    const hot = hotRef?.current?.hotInstance;
    const container = containerRef?.current;
    if (!hot || !container) {
      setRects([]);
      return;
    }

    const containerRect = container.getBoundingClientRect();

    const nextRects = [];
    for (const cursor of otherCursors) {
      const { userId, row, col, color, displayName } = cursor;

      // 获取 Handsontable 单元格 TD 元素
      const td = hot.getCell(row, col);
      if (!td) continue;

      const tdRect = td.getBoundingClientRect();

      // 相对于容器的偏移
      nextRects.push({
        key:         userId,
        top:         tdRect.top  - containerRect.top,
        left:        tdRect.left - containerRect.left,
        width:       tdRect.width,
        height:      tdRect.height,
        color,
        displayName,
      });
    }

    setRects(nextRects);
  }, [otherCursors, hotRef, containerRef]);

  if (rects.length === 0) return null;

  return (
    <div style={styles.overlay}>
      {rects.map((rect) => (
        <div
          key={rect.key}
          style={{
            ...styles.cursorBox,
            top:         rect.top,
            left:        rect.left,
            width:       rect.width,
            height:      rect.height,
            borderColor: rect.color,
          }}
        >
          {/* 用户姓名标签，显示在单元格左上角 */}
          <span
            style={{
              ...styles.nameTag,
              background: rect.color,
            }}
          >
            {rect.displayName}
          </span>
        </div>
      ))}
    </div>
  );
}

const styles = {
  /** 覆盖在表格上方的绝对定位容器，pointer-events:none 不拦截鼠标事件 */
  overlay: {
    position:       'absolute',
    top:            0,
    left:           0,
    width:          '100%',
    height:         '100%',
    pointerEvents:  'none',
    zIndex:         10,
    overflow:       'hidden',
  },
  /** 单个光标框：彩色边框 */
  cursorBox: {
    position:       'absolute',
    boxSizing:      'border-box',
    border:         '2px solid',
    borderRadius:   1,
    pointerEvents:  'none',
  },
  /** 姓名标签：左上角小矩形 */
  nameTag: {
    position:       'absolute',
    top:            -20,
    left:           -2,
    height:         18,
    padding:        '0 5px',
    borderRadius:   '2px 2px 2px 0',
    color:          '#fff',
    fontSize:       11,
    fontWeight:     600,
    whiteSpace:     'nowrap',
    lineHeight:     '18px',
    userSelect:     'none',
  },
};

export default CursorOverlay;
