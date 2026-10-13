(() => {
  'use strict';
  const categories = { game: '小游戏', tool: '工具', note: '记录' };
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const safeURL = value => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, location.href);
      // 放行 file: —— 否则本地双击打开 index.html 时，整个作品列表都不渲染
      return ['https:', 'http:', 'file:'].includes(url.protocol) ? url : null;
    } catch (_) { return null; }
  };
  if (Array.isArray(window.YUNWEN_PROJECTS)) {
    const cards = [];
    window.YUNWEN_PROJECTS.forEach((project, index) => {
      if (!project || !project.title) return;
      const url = safeURL(project.href);
      if (!url) return;
      const card = make('a', 'project'); card.href = url.href;
      if (url.origin !== location.origin) { card.target = '_blank'; card.rel = 'noopener noreferrer'; }
      const cover = make('div', 'project-image'), imageURL = safeURL(project.image);
      if (imageURL) {
        const image = make('img'); image.src = imageURL.href; image.alt = project.imageAlt || `${project.title}封面`;
        image.width = 1280; image.height = 800;
        if (index > 0) image.loading = 'lazy'; cover.append(image);
      }
      const copy = make('div', 'project-copy');
      copy.append(make('span', 'category', categories[project.category] || '作品'), make('h2', '', project.title), make('p', '', project.description || ''));
      const arrow = make('span', 'project-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
      card.append(cover, copy, arrow); cards.push(card);
    });
    // 数据加载失败或误删时，保留 HTML 里的游戏备用入口。
    if (cards.length) document.getElementById('project-list').replaceChildren(...cards);
  }
  document.getElementById('year').textContent = new Date().getFullYear();
})();
