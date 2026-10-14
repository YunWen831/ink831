(() => {
 'use strict';
 // Resolve every catalog entry from the website root, including nested category pages.
 const siteRoot = new URL('../', document.currentScript.src);
 const labels = { game: '游戏', software: '软件', tool: '工具', note: '记录' };
 const make = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; };
 const safeURL = value => { if (typeof value !== 'string' || !value.trim()) return null; try { const url = new URL(value, siteRoot); return ['https:', 'http:', 'file:'].includes(url.protocol) ? url : null; } catch (_) { return null; } };
 const view = document.body.dataset.catalog || 'categories';
 const entries = view === 'categories' ? window.YUNWEN_CATEGORIES : Array.isArray(window.YUNWEN_PROJECTS) ? window.YUNWEN_PROJECTS.filter(p => p && p.category === view) : null;
 const list = document.getElementById('project-list');
 if (Array.isArray(entries) && list) {
  const cards = [];
  entries.forEach((project, index) => {
   if (!project || !project.title) return; const url = safeURL(project.href); if (!url) return;
   const card = make('a', 'project'); card.href = url.href;
   if (url.origin !== location.origin) { card.target = '_blank'; card.rel = 'noopener noreferrer'; }
   const cover = make('div', 'project-image'), imageURL = safeURL(project.image);
   if (imageURL) { const image = make('img'); image.src = imageURL.href; image.alt = project.imageAlt || `${project.title}封面`; image.width = 1280; image.height = 800; if (index > 0) image.loading = 'lazy'; cover.append(image); }
   const copy = make('div', 'project-copy');
   if (view !== 'categories') copy.append(make('span', 'category', labels[project.category] || '作品'));
   copy.append(make('h2', '', project.title), make('p', '', project.description || ''));
   const arrow = make('span', 'project-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
   card.append(cover, copy, arrow); cards.push(card);
  });
  if (cards.length) list.replaceChildren(...cards);
 }
 const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();
})();
