// 新增作品：在数组中复制一条，改标题、简介、链接、封面即可。
// category 可选 software（软件）、game（游戏）；更多分类在 catalog.js 中添加。
// href / image 用相对路径或完整 https 地址，按数组顺序展示。
window.YUNWEN_PROJECTS = [
  {
    title: 'Y课表',
    category: 'software',
    description: '安卓课表',
    href: './software/y-timetable/index.html',
    image: './assets/y-timetable-cover.svg',
    imageAlt: 'Y课表软件插画'
  },
  {
    title: '回声',
    category: 'game',
    description: '声呐潜行',
    href: './echo/index.html',
    image: './assets/echo-cover.svg',
    imageAlt: '回声：黑暗中的声呐潜行游戏'
  },
  {
    title: '地牢来信',
    category: 'game',
    description: '建造 · 小游戏与接龙',
    href: './courtyard/index.html',
    image: './assets/courtyard-cover.svg?v=courtyard-03',
    imageAlt: '地牢来信：两位旅人在庭院里交换一封信'
  },
  {
    title: '在学校乱逛',
    category: 'game',
    description: '校园探索',
    // 链接必须写明 index.html：file:// 下直接访问目录只会得到文件列表，
    // 自动找 index 是 HTTP 服务器的功能。线上两种写法都行，本地只有这种行。
    href: './campus/index.html',
    image: './assets/campus-cover.png',
    imageAlt: '校园像素游戏画面'
  }
];
