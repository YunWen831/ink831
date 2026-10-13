// 新增作品：在数组中复制一条，改标题、简介、链接、封面即可。
// category 可选 game（小游戏）、tool（工具）、note（记录）。
// href / image 用相对路径或完整 https 地址，按数组顺序展示。
window.YUNWEN_PROJECTS = [
  {
    title: '在学校乱逛',
    category: 'game',
    description: '三角色校园怪谈。探索、解谜，找出那场事故背后的线索。',
    // 链接必须写明 index.html：file:// 下直接访问目录只会得到文件列表，
    // 自动找 index 是 HTTP 服务器的功能。线上两种写法都行，本地只有这种行。
    href: './campus/index.html',
    image: './assets/campus-cover.png',
    imageAlt: '校园像素游戏画面'
  },
  {
    title: 'ds词塔',
    category: 'game',
    description: '背单词肉鸽。给中文拼英文——你越不熟的词，攻击力越高。',
    href: './vocab/index.html',
    image: './assets/vocab-cover.png',
    imageAlt: 'ds词塔战斗界面'
  },
  {
    title: '言灵',
    category: 'game',
    description: '四六级单词肉鸽。探索地牢，拼写真正的 CET-4/6 词汇，收集言灵。',
    href: './spell/index.html',
    image: './assets/spell-cover.png',
    imageAlt: '言灵游戏画面'
  }
];
