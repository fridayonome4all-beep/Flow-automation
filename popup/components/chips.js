// Reusable segmented chip group component with keyboard and ARIA support.

export function renderChipGroup({ container, items, selectedId, onChange, ariaLabel = '' }) {
  if (!container) return;
  container.innerHTML = '';
  container.setAttribute('role', 'radiogroup');
  if (ariaLabel) container.setAttribute('aria-label', ariaLabel);

  items.forEach(item => {
    const isSelected = item.id === selectedId;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip ${isSelected ? 'selected' : ''}`;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    btn.dataset.id = item.id;

    if (item.disabled) {
      btn.disabled = true;
      btn.classList.add('disabled');
    }

    // Optional icon rendering
    if (item.icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = `chip-icon icon-${item.icon}`;
      btn.appendChild(iconSpan);
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'chip-label';
    labelSpan.textContent = item.label || item.id;
    btn.appendChild(labelSpan);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (item.disabled) return;
      container.querySelectorAll('.chip').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-checked', 'true');
      if (onChange) onChange(item.id);
    });

    container.appendChild(btn);
  });
}
