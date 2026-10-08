/** Chinese titles and captions, keyed by diagram id. */
export const DIAGRAMS_ZH: Record<string, { title: string; caption: string }> = {
  'am-straight-warmup': {
    title: '直线球热身',
    caption: '目标球与底袋成直线。主球 30 → 60 → 90 → 120 厘米。每 5 杆一组。',
  },
  'am-stop-ladder': {
    title: '定杆阶梯练习',
    caption: '中杆。主球停在撞击点约 8 厘米以内。每个距离 10 杆。',
  },
  'am-draw-ladder': {
    title: '低杆阶梯练习',
    caption: '球杆放平，击球点低。先拉回 15 厘米，再 30 厘米，然后更远。',
  },
  'am-follow-ladder': {
    title: '高杆阶梯练习',
    caption: '中上点击球。每杆前先选好跟进目标（15、30、60 厘米）。',
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
    caption: '打进目标球，主球走一库进入 30–45 厘米目标区。先预判路线。',
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
    caption: '目标球距底袋约 38 厘米，主球在其后 120 厘米，完全成直线。10 杆。',
  },
  'test-cut': {
    title: '测试：切球',
    caption: '固定 45° 切球。先向左切 10 杆，再向右切 10 杆。始终不改变角度。',
  },
  'test-stop': {
    title: '测试：定杆',
    caption: '直线球，主球距目标球 60 厘米。成功 = 目标球进袋且主球停在撞击点约 8 厘米以内。',
  },
  'test-draw': {
    title: '测试：低杆 @60厘米',
    caption: '直线球，主球距目标球 60 厘米。每次测试用同一颗主球。测量拉回距离。',
  },
  'test-5ball': {
    title: '测试：五球清台（固定球型）',
    caption: '每次测试都用这个球型。自由球开始。打 5 次。',
  },
  'spot-shot': { title: '五分点直线球', caption: '目标球放在置球点，主球在它正后方对准底袋。一步入位，每杆打完停两秒。' },
  'cut-small': { title: '小角度切球', caption: '用假想球瞄 10°、20°、30° 的切球，左右都练。目标球和袋口固定。' },
  'rail-balls': { title: '贴库球', caption: '贴库：大角度先打库，加一点袋口方向的塞；小角度瞄缝隙。半贴库：目标球边缘瞄袋角，打实。' },
  'level-stops': { title: '五档击球点', caption: '同一个直线球，五种击球高度。每杆之前先说出主球会停在哪里。' },
  'separation-positions': { title: '90° 线和 1–4 号位', caption: '高杆让主球走到 90° 线前面（1、2 号位），低杆让它往回走（3、4 号位）。中杆沿着 90° 线走。' },
  'homework-route': { title: '打进 1 号，走位 2 号', caption: '自由球。1 号打进底袋，主球走到能打 2 号的位置。找出几条线路，选最稳的一条。' },
  'break-square': { title: '开得正', caption: '主球放在开球线上，打中杆或略低，不加塞。整颗正撞头球，主球停在台面中间。' },
  'break-tech': { title: '技术冲', caption: '主球放在开球线上、离边库 10–15 厘米。冲球堆第二颗，中心偏下半个皮头，带一点塞，七八成力。' },
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
  'draw 6"': '拉回15cm',
  'draw 12"': '拉回30cm',
  '1 ft': '30cm',
  '2 ft': '60cm',
  '3 ft': '90cm',
  '4 ft': '120cm',
  '3"': '8cm',
  '6"': '15cm',
  '8"': '20cm',
  '12"': '30cm',
  '16"': '40cm',
  '18"': '45cm',
  '24"': '60cm',
  '36"': '90cm',
  BIH: '自由球',
  'Foot spot': '置球点',
  'big angle': '大角度',
  'small angle': '小角度',
  'Frozen on the rail': '贴库球',
  'Half-frozen: edge to the jaw': '半贴库：边缘瞄袋角',
  follow: '高杆',
  'slight follow': '中高杆',
  stop: '中杆定住',
  'slight draw': '中低杆',
  draw: '低杆',
  'CB stops here': '主球停这里',
  'second ball': '第二颗',
  'CB ends mid-table': '主球回到台面中间',
};
