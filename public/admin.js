document.querySelectorAll('form[data-confirm]').forEach((f) =>
  f.addEventListener('submit', (e) => {
    if (!confirm(f.dataset.confirm)) e.preventDefault();
  }),
);

// Refresh while a check is running so results show up without clicking.
if (document.querySelector('.status .pill.warn')) setTimeout(() => location.reload(), 15000);
