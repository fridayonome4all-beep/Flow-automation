// Run history bottom-sheet component displaying past runs and load-and-rerun actions.

export function renderHistorySheet({ container, history = [], onLoadAndRerun, onClearAll, onClose }) {
  if (!container) return;
  container.innerHTML = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.addEventListener('click', onClose);
  container.appendChild(backdrop);

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet history-sheet';

  // Drag handle for mobile touch gesture
  const dragHandle = document.createElement('div');
  dragHandle.className = 'sheet-drag-handle';
  sheet.appendChild(dragHandle);

  // Sheet Header
  const header = document.createElement('div');
  header.className = 'sheet-header';

  const title = document.createElement('h2');
  title.className = 'sheet-title';
  title.textContent = 'Image history';
  header.appendChild(title);

  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'sheet-header-actions';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn-clear-all';
  clearBtn.textContent = 'Clear all';
  clearBtn.addEventListener('click', onClearAll);
  actionsWrap.appendChild(clearBtn);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-close-sheet';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close history');
  closeBtn.addEventListener('click', onClose);
  actionsWrap.appendChild(closeBtn);

  header.appendChild(actionsWrap);
  sheet.appendChild(header);

  // Content body
  const body = document.createElement('div');
  body.className = 'sheet-body';

  if (!history || history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-history-box';
    empty.textContent = 'No previous runs recorded.';
    body.appendChild(empty);
  } else {
    history.slice(0, 20).forEach(run => {
      const card = document.createElement('div');
      card.className = 'history-card';

      // Meta top row
      const metaRow = document.createElement('div');
      metaRow.className = 'history-meta-row';

      const statusBadge = document.createElement('span');
      const statusText = (run.status || 'DONE').toUpperCase();
      statusBadge.className = `history-badge badge-${(run.status || 'done').toLowerCase()}`;
      statusBadge.textContent = statusText;
      metaRow.appendChild(statusBadge);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'history-time';
      timeSpan.textContent = formatTimeAgo(run.ts || run.timestamp);
      metaRow.appendChild(timeSpan);

      card.appendChild(metaRow);

      // Counts line
      const countLine = document.createElement('div');
      countLine.className = 'history-count-line';
      countLine.textContent = `${run.total || 0} prompts · ${run.done || 0}/${run.total || 0} done`;
      card.appendChild(countLine);

      // First prompt preview
      const previewLine = document.createElement('div');
      previewLine.className = 'history-preview-line';
      previewLine.textContent = run.preview || (run.prompts && run.prompts[0]?.text) || 'No preview available';
      card.appendChild(previewLine);

      // Action buttons row
      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '8px';
      btnRow.style.marginTop = '8px';

      const rerunBtn = document.createElement('button');
      rerunBtn.type = 'button';
      rerunBtn.className = 'btn-load-rerun';
      rerunBtn.style.flex = '1';
      rerunBtn.textContent = 'Load & rerun';
      rerunBtn.addEventListener('click', () => {
        if (onLoadAndRerun) onLoadAndRerun(run);
      });
      btnRow.appendChild(rerunBtn);

      const hasFailed = (run.failed && run.failed > 0) || (run.prompts && run.prompts.some(p => p.status === 'failed' || p.status === 'idle'));
      if (hasFailed) {
        const retryFailedBtn = document.createElement('button');
        retryFailedBtn.type = 'button';
        retryFailedBtn.className = 'btn-load-rerun';
        retryFailedBtn.style.background = '#059669';
        retryFailedBtn.style.color = '#ffffff';
        retryFailedBtn.style.flex = '1';
        retryFailedBtn.textContent = 'Retry All Failed';
        retryFailedBtn.addEventListener('click', () => {
          if (onLoadAndRerun) {
            const failedPrompts = (run.prompts || []).filter(p => p.status === 'failed' || p.status === 'idle');
            onLoadAndRerun({ ...run, prompts: failedPrompts.length > 0 ? failedPrompts : run.prompts });
          }
        });
        btnRow.appendChild(retryFailedBtn);
      }

      card.appendChild(btnRow);
      body.appendChild(card);
    });
  }

  sheet.appendChild(body);
  container.appendChild(sheet);
}

function formatTimeAgo(ts) {
  if (!ts) return 'recently';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
