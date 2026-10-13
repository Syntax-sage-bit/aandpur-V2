(() => {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem('aandpur-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') root.dataset.theme = savedTheme;

  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      localStorage.setItem('aandpur-theme', next);
    });
  });

  const sidebar = document.getElementById('sidebar');
  document.querySelectorAll('[data-menu-toggle]').forEach(button => {
    button.addEventListener('click', () => sidebar?.classList.toggle('open'));
  });

  let toastTimer;
  const toast = document.getElementById('toast');
  document.querySelectorAll('[data-demo]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      if (!toast) return;
      const feature = button.dataset.demo || 'This feature';
      toast.textContent = `${feature} will be added in the next development phase.`;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
      sidebar?.classList.remove('open');
    });
  });
})();