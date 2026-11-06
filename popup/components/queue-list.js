// Interactive queue list renderer with status badges, edit, reorder, and tag validation indicators.

export function renderQueueList({ container, prompts, onEdit, onDelete, onMove, libraryFileNames = new Set() }) {
  if (!container) return;
  container.innerHTML = '';

  if (!prompts || prompts.length === 0) {
    const emptyBox = document.createElement('div');
    emptyBox.className = 'empty-queue-box';
    const p = document.createElement('p');
    p.textContent = 'No prompts loaded yet — load or paste prompts above.';
    emptyBox.appendChild(p);
    container.appendChild(emptyBox);
    return;
  }

  prompts.forEach((prompt, index) => {
    const item = document.createElement('div');
    item.className = `queue-item status-${prompt.status || 'idle'} ${prompt.isDuplicate ? 'is-duplicate' : ''}`;
    item.dataset.id = prompt.id;

    // Header row: index number and status badge
    const headerRow = document.createElement('div');
    headerRow.className = 'queue-item-header';

    const indexBadge = document.createElement('span');
    indexBadge.className = 'take-index-badge';
    indexBadge.textContent = `#${String(index + 1).padStart(3, '0')}`;
    headerRow.appendChild(indexBadge);

    const rightMeta = document.createElement('div');
    rightMeta.className = 'queue-item-meta';

    if (prompt.isDuplicate) {
      const dupBadge = document.createElement('span');
      dupBadge.className = 'meta-badge badge-duplicate';
      dupBadge.textContent = 'duplicate';
      rightMeta.appendChild(dupBadge);
    }

    const statusBadge = document.createElement('span');
    statusBadge.className = `meta-badge badge-${prompt.status || 'idle'}`;
    statusBadge.textContent = (prompt.status || 'idle').toUpperCase();
    rightMeta.appendChild(statusBadge);

    headerRow.appendChild(rightMeta);
    item.appendChild(headerRow);

    // Prompt content
    const textBlock = document.createElement('div');
    textBlock.className = 'queue-item-text';
    textBlock.textContent = prompt.text;
    item.appendChild(textBlock);

    // Tags block if present
    if (prompt.tags) {
      const tagsBar = document.createElement('div');
      tagsBar.className = 'queue-item-tags';

      const tagPairs = [
        ...prompt.tags.subject.map(s => ({ type: 'sub', name: s })),
        ...prompt.tags.scene.map(s => ({ type: 'scn', name: s })),
        ...prompt.tags.style.map(s => ({ type: 'sty', name: s })),
        ...(prompt.tags.start ? [{ type: 'start', name: prompt.tags.start }] : []),
        ...(prompt.tags.end ? [{ type: 'end', name: prompt.tags.end }] : []),
        ...prompt.tags.ref.map(r => ({ type: 'ref', name: r }))
      ];

      tagPairs.forEach(tag => {
        const tagPill = document.createElement('span');
        const isMissing = !libraryFileNames.has(tag.name.toLowerCase());
        tagPill.className = `tag-chip ${isMissing ? 'tag-missing' : ''}`;
        tagPill.textContent = `${tag.type}: ${tag.name}${isMissing ? ' ⚠' : ''}`;
        if (isMissing) {
          tagPill.title = 'Image not found in library — click library to add';
        }
        tagsBar.appendChild(tagPill);
      });

      item.appendChild(tagsBar);
    }

    // Action buttons (edit, move, delete)
    const actionRow = document.createElement('div');
    actionRow.className = 'queue-item-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'item-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newText = window.prompt('Edit prompt text:', prompt.raw || prompt.text);
      if (newText !== null && newText.trim() && onEdit) {
        onEdit(prompt.id, newText.trim());
      }
    });
    actionRow.appendChild(editBtn);

    if (index > 0) {
      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'item-btn';
      upBtn.textContent = '↑';
      upBtn.title = 'Move up';
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onMove) onMove(index, index - 1);
      });
      actionRow.appendChild(upBtn);
    }

    if (index < prompts.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'item-btn';
      downBtn.textContent = '↓';
      downBtn.title = 'Move down';
      downBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onMove) onMove(index, index + 1);
      });
      actionRow.appendChild(downBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'item-btn btn-danger';
    delBtn.textContent = 'Remove';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onDelete) onDelete(prompt.id);
    });
    actionRow.appendChild(delBtn);

    item.appendChild(actionRow);
    container.appendChild(item);
  });
}
