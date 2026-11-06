// Reference images selector for Subject, Scene, and Style groups (up to 100 images each).

export function renderRefPicker({
  container,
  groups = { subject: [], scene: [], style: [] },
  onAddFiles,
  onRemoveFile,
  onOpenLibrary
}) {
  if (!container) return;
  container.innerHTML = '';

  const categories = [
    { key: 'subject', label: 'SUBJECT', desc: 'who / what (up to 100)' },
    { key: 'scene', label: 'SCENE', desc: 'where it happens (up to 100)' },
    { key: 'style', label: 'STYLE', desc: 'visual style / mood (up to 100)' }
  ];

  categories.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'ref-group-card';

    // Header row
    const header = document.createElement('div');
    header.className = 'ref-group-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'ref-title-wrap';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'ref-group-title';
    titleSpan.textContent = cat.label;
    titleWrap.appendChild(titleSpan);

    const descSpan = document.createElement('span');
    descSpan.className = 'ref-group-desc';
    descSpan.textContent = cat.desc;
    titleWrap.appendChild(descSpan);

    header.appendChild(titleWrap);

    const libBtn = document.createElement('button');
    libBtn.type = 'button';
    libBtn.className = 'btn-library';
    libBtn.textContent = 'Library';
    libBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (onOpenLibrary) onOpenLibrary(cat.key);
    });
    header.appendChild(libBtn);

    card.appendChild(header);

    // Active items or dashed add box
    const items = groups[cat.key] || [];

    const dropBox = document.createElement('div');
    dropBox.className = 'ref-drop-box';

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'file';
    hiddenInput.multiple = true;
    hiddenInput.accept = 'image/*';
    hiddenInput.style.display = 'none';

    hiddenInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0 && onAddFiles) {
        onAddFiles(cat.key, files);
      }
      hiddenInput.value = '';
    });
    dropBox.appendChild(hiddenInput);

    if (items.length === 0) {
      const addPrompt = document.createElement('div');
      addPrompt.className = 'ref-empty-prompt';
      addPrompt.textContent = 'Click to add';
      addPrompt.addEventListener('click', () => hiddenInput.click());
      dropBox.appendChild(addPrompt);
    } else {
      const thumbsGrid = document.createElement('div');
      thumbsGrid.className = 'ref-thumbs-grid';

      items.forEach((item, idx) => {
        const thumb = document.createElement('div');
        thumb.className = 'ref-thumb-item';

        const img = document.createElement('img');
        img.src = item.url || item.thumbnailUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
        img.alt = item.name || `Ref ${idx + 1}`;
        thumb.appendChild(img);

        const label = document.createElement('span');
        label.className = 'thumb-filename';
        label.textContent = item.name || `Ref ${idx + 1}`;
        thumb.appendChild(label);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'thumb-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onRemoveFile) onRemoveFile(cat.key, item.id || idx);
        });
        thumb.appendChild(removeBtn);

        thumbsGrid.appendChild(thumb);
      });

      // Append add more button
      if (items.length < 100) {
        const addMore = document.createElement('button');
        addMore.type = 'button';
        addMore.className = 'ref-thumb-add-more';
        addMore.textContent = '+ Add';
        addMore.addEventListener('click', () => hiddenInput.click());
        thumbsGrid.appendChild(addMore);
      }

      dropBox.appendChild(thumbsGrid);
    }

    card.appendChild(dropBox);
    container.appendChild(card);
  });
}
