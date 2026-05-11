/**
 * 模块K：WebSocket 实时同步 - 用户颜色分配工具
 *
 * 按第五章 5.3 节定义的顺序，为每个在线用户分配固定颜色。
 * 颜色在用户会话期间保持不变，用户断线后释放颜色槽位。
 */

'use strict';

/** 第五章 5.3 节定义的颜色列表（光标色 + 背景高亮色） */
const COLOR_LIST = [
  { cursor: '#1D9E75', bg: 'rgba(29,158,117,0.15)'  },
  { cursor: '#378ADD', bg: 'rgba(55,138,221,0.15)'  },
  { cursor: '#EF9F27', bg: 'rgba(239,159,39,0.15)'  },
  { cursor: '#A855F7', bg: 'rgba(168,85,247,0.15)'  },
  { cursor: '#EF4444', bg: 'rgba(239,68,68,0.15)'   },
];

/**
 * userId → colorIndex 映射
 * 用户断线时删除，下次连接重新分配
 * @type {Map<number, number>}
 */
const userColorIndex = new Map();

/** 已占用的颜色槽位 Set（存 colorIndex） */
const usedIndexes = new Set();

/**
 * 为指定用户分配颜色（幂等：已分配则返回原颜色）
 * @param {number} userId
 * @returns {{ cursor: string, bg: string }}
 */
function assignColor(userId) {
  if (userColorIndex.has(userId)) {
    return COLOR_LIST[userColorIndex.get(userId)];
  }

  // BUG FIX：原版循环逻辑错误——当全部占满时 idx 的赋值在循环体内，
  // 但 break 在找到空槽时才触发，导致"全满时循环复用"逻辑从未生效。
  // 修复：先找第一个未占用的槽位，找不到则按总连接数取模循环。
  let idx = 0;
  let found = false;
  for (let i = 0; i < COLOR_LIST.length; i++) {
    if (!usedIndexes.has(i)) {
      idx = i;
      found = true;
      break;
    }
  }
  if (!found) {
    // 所有颜色都已分配，循环复用（按当前 map 大小取模）
    idx = userColorIndex.size % COLOR_LIST.length;
  }

  userColorIndex.set(userId, idx);
  usedIndexes.add(idx);
  return COLOR_LIST[idx];
}

/**
 * 释放指定用户的颜色槽位（用户断线时调用）
 * @param {number} userId
 */
function releaseColor(userId) {
  if (userColorIndex.has(userId)) {
    usedIndexes.delete(userColorIndex.get(userId));
    userColorIndex.delete(userId);
  }
}

/**
 * 获取用户已分配的颜色（未分配返回 null）
 * @param {number} userId
 * @returns {{ cursor: string, bg: string } | null}
 */
function getColor(userId) {
  if (!userColorIndex.has(userId)) return null;
  return COLOR_LIST[userColorIndex.get(userId)];
}

module.exports = { assignColor, releaseColor, getColor };
