/** Chinese titles and captions, keyed by diagram id. */
export const DIAGRAMS_ZH: Record<string, { title: string; caption: string }> = {
  'am-straight-warmup': {
    title: '直线球热身',
    caption: '目标球与底袋成直线。主球 1 英尺 → 2 → 3 → 4 英尺。每 5 杆一组。',
  },
  'am-stop-ladder': {
    title: '定杆阶梯练习',
    caption: '中杆。主球停在撞击点约 3 英寸以内。每个距离 10 杆。',
  },
  'am-draw-ladder': {
    title: '低杆阶梯练习',
    caption: '球杆放平，击球点低。先拉回 6 英寸，再 12 英寸，然后更远。',
  },
  'am-follow-ladder': {
    title: '高杆阶梯练习',
    caption: '中上点击球。每杆前先选好跟进目标（6、12、24 英寸）。',
  },
  'am-precision-pocket': {
    title: '精准进袋练习',
    caption: '长直线球和小角度切球。左右底袋交替。袋口晃动算失误。',
  },
  'pm-cut-blocks': {
    title: '切球分组练习',
    caption: '30°、45°、60° — 左右两个方向。每个角度/方向 6 杆。目标球和袋口固定。',
  },
  'pm-one-rail': {
    title: '一库走位目标区',
    caption: '打进目标球，主球走一库进入 12–18 英寸目标区。先预判路线。',
  },
  'pm-3ball': {
    title: '三球线路练习',
    caption: '示例 — 任何无遮挡、能进的球型都可以。先说出 3 杆打法和主球目标区。',
  },
  'pm-5ball': {
    title: '五球清台',
    caption: '示例 — 随意散开 5 颗无遮挡的球，自由球开始。选最简单线路，主球少移动。',
  },
  'pm-review': {
    title: '简短复盘 / 重打',
    caption: '重摆今天最差的 2–3 杆球。反复重打，直到找到纠正方法。',
  },
  'test-straight': {
    title: '测试：长直线球',
    caption: '目标球距底袋约 15 英寸，主球在其后 4 英尺，完全成直线。10 杆。',
  },
  'test-cut': {
    title: '测试：切球',
    caption: '固定 45° 切球。先向左切 10 杆，再向右切 10 杆。始终不改变角度。',
  },
  'test-stop': {
    title: '测试：定杆',
    caption: '直线球，主球距目标球 24 英寸。成功 = 目标球进袋且主球停在撞击点约 3 英寸以内。',
  },
  'test-draw': {
    title: '测试：低杆 @24英寸',
    caption: '直线球，主球距目标球 24 英寸。每次测试用同一颗主球。测量拉回距离。',
  },
  'test-5ball': {
    title: '测试：五球清台（固定球型）',
    caption: '每次测试都用这个球型。自由球开始。打 5 次。',
  },
};

/** Chinese for every on-table text (label/marker `text`, zone/pocket `label`), keyed by the exact English string. */
export const LABELS_ZH: Record<string, string> = {
  'Cutting LEFT': '向左切',
  'Cutting RIGHT': '向右切',
  'Target zone': '目标区',
  'Stop zone': '定杆区',
  next: '下一杆',
  'for 2': '打2号',
  'for 3': '打3号',
  'Set up your worst shots here': '在这里摆出你最差的几杆球',
  'Ball in hand': '自由球',
  'draw 6"': '拉回 6"',
  'draw 12"': '拉回 12"',
  '1 ft': '1英尺',
  '2 ft': '2英尺',
  '3 ft': '3英尺',
  '4 ft': '4英尺',
  BIH: '自由球',
};
