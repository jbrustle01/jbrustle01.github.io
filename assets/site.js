document.documentElement.classList.remove('no-js');

const research = document.querySelector('[data-research]');
if (research) {
  const input = document.querySelector('#paper-search');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const papers = [...research.querySelectorAll('[data-paper]')];
  const groups = [...research.querySelectorAll('[data-group]')];
  const empty = document.querySelector('#empty-results');
  const status = document.querySelector('#search-status');
  let active = 'all';
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function update() {
    const query = normalize(input.value.trim());
    let visible = 0;
    papers.forEach(paper => {
      const matches = (active === 'all' || paper.dataset.kind === active) && normalize(paper.textContent).includes(query);
      paper.hidden = !matches;
      if (matches) visible++;
    });
    groups.forEach(group => {
      const count = [...group.querySelectorAll('[data-paper]')].filter(paper => !paper.hidden).length;
      group.hidden = count === 0;
      const badge = group.querySelector('.count');
      badge.textContent = count;
      badge.setAttribute('aria-label', `${count} ${count === 1 ? 'paper' : 'papers'}`);
    });
    empty.hidden = visible !== 0;
    status.textContent = `${visible} ${visible === 1 ? 'paper' : 'papers'} shown`;
  }
  filters.forEach(button => button.addEventListener('click', () => {
    active = button.dataset.filter;
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    update();
  }));
  input.addEventListener('input', update);
}
