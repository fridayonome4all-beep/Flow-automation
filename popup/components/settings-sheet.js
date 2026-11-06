// Settings bottom-sheet component for file naming, tab auto-refresh, cache clearing, and calibration.

export function renderSettingsSheet({
  container,
  settings,
  onSave,
  onClearCache,
  onCalibrate,
  onExportLog,
  onResetAll,
  onClose
}) {
  if (!container) return;
  container.innerHTML = '';

  let currentSettings = { ...settings };

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.addEventListener('click', onClose);
  container.appendChild(backdrop);

  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet settings-sheet';

  // Drag handle for mobile touch gesture
  const dragHandle = document.createElement('div');
  dragHandle.className = 'sheet-drag-handle';
  sheet.appendChild(dragHandle);

  // Header
  const header = document.createElement('div');
  header.className = 'sheet-header';

  const title = document.createElement('h2');
  title.className = 'sheet-title';
  title.textContent = 'Settings';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-close-sheet';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close settings');
  closeBtn.addEventListener('click', onClose);
  header.appendChild(closeBtn);

  sheet.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'sheet-body';

  // Section 0: Google Account Sign-In Gate
  const accountSection = document.createElement('div');
  accountSection.className = 'settings-group';

  const accountLabel = document.createElement('h3');
  accountLabel.className = 'settings-group-title';
  accountLabel.textContent = 'Google Account';
  accountSection.appendChild(accountLabel);

  const accountCard = document.createElement('div');
  accountCard.className = 'settings-account-card';

  const auth = currentSettings.googleAuth || { signedIn: false, email: '' };

  if (auth.signedIn) {
    accountCard.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:#151922;border:1px solid #232a3b;border-radius:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:8px;height:8px;border-radius:50%;background:#34d399;display:inline-block;box-shadow:0 0 6px rgba(52,211,153,0.6);"></span>
          <span style="font-size:12px;color:#e2e8f0;font-weight:500;">${auth.email || 'user@gmail.com'}</span>
        </div>
        <button type="button" id="btnSignOutGoogle" class="btn-settings-link" style="color:#ef4444;font-size:11px;">Sign out</button>
      </div>
    `;
    setTimeout(() => {
      const btn = accountCard.querySelector('#btnSignOutGoogle');
      if (btn) {
        btn.addEventListener('click', () => {
          currentSettings.googleAuth = { signedIn: false, email: '' };
          renderSettingsSheet({
            container,
            settings: currentSettings,
            onSave,
            onClearCache,
            onCalibrate,
            onExportLog,
            onResetAll,
            onClose
          });
        });
      }
    }, 0);
  } else {
    accountCard.innerHTML = `
      <div style="padding:10px;background:#151922;border:1px solid #283144;border-radius:8px;display:flex;flex-direction:column;gap:8px;">
        <p style="font-size:11px;color:#94a3b8;margin:0;">Sign in to your Google Account to authorize automation batches on labs.google/fx/tools/flow.</p>
        <button type="button" id="btnSignInGoogle" class="btn-sheet-primary" style="background:#2563eb;color:#fff;font-size:12px;padding:6px 12px;border-radius:6px;">Sign in with Google</button>
      </div>
    `;
    setTimeout(() => {
      const btn = accountCard.querySelector('#btnSignInGoogle');
      if (btn) {
        btn.addEventListener('click', () => {
          currentSettings.googleAuth = { signedIn: true, email: 'creator@studio.google' };
          renderSettingsSheet({
            container,
            settings: currentSettings,
            onSave,
            onClearCache,
            onCalibrate,
            onExportLog,
            onResetAll,
            onClose
          });
        });
      }
    }, 0);
  }
  accountSection.appendChild(accountCard);
  body.appendChild(accountSection);

  // Section 1: File Naming
  const namingSection = document.createElement('div');
  namingSection.className = 'settings-group';

  const namingLabel = document.createElement('h3');
  namingLabel.className = 'settings-group-title';
  namingLabel.textContent = 'File naming';
  namingSection.appendChild(namingLabel);

  const options = [
    { id: 'num', label: '001_v1, 001_v2, ... (per prompt)' },
    { id: 'slug', label: '001-prompt_v1, ...' },
    { id: 'custom', label: 'Custom format template' }
  ];

  options.forEach(opt => {
    const radioRow = document.createElement('label');
    radioRow.className = `settings-radio-row ${currentSettings.naming === opt.id ? 'checked' : ''}`;

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'file_naming';
    radio.value = opt.id;
    radio.checked = currentSettings.naming === opt.id;

    radio.addEventListener('change', () => {
      currentSettings.naming = opt.id;
      namingSection.querySelectorAll('.settings-radio-row').forEach(r => r.classList.remove('checked'));
      radioRow.classList.add('checked');
      if (customPatternRow) {
        customPatternRow.style.display = opt.id === 'custom' ? 'block' : 'none';
      }
    });

    const span = document.createElement('span');
    span.textContent = opt.label;

    radioRow.appendChild(radio);
    radioRow.appendChild(span);
    namingSection.appendChild(radioRow);
  });

  // Custom pattern input
  const customPatternRow = document.createElement('div');
  customPatternRow.style.display = currentSettings.naming === 'custom' ? 'block' : 'none';
  customPatternRow.style.marginTop = '8px';
  customPatternRow.style.paddingLeft = '24px';
  customPatternRow.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;">
      <input type="text" id="customNamingInput" value="${currentSettings.customNamingPattern || '{id}_v{v}'}" style="flex:1;background:#0d0f14;border:1px solid #2d3548;border-radius:6px;padding:6px 8px;font-size:11px;color:#fff;font-family:monospace;" />
      <span style="font-size:10px;color:#64748b;font-family:monospace;">.ext</span>
    </div>
    <p style="font-size:10px;color:#64748b;margin-top:4px;line-height:1.4;">Tokens: <code style="color:#93c5fd;">{id}</code>, <code style="color:#93c5fd;">{index}</code>, <code style="color:#93c5fd;">{timestamp}</code>, <code style="color:#93c5fd;">{prompt_start}</code>, <code style="color:#93c5fd;">{v}</code>. Preference permanently saved.</p>
  `;
  const patternInput = customPatternRow.querySelector('#customNamingInput');
  if (patternInput) {
    patternInput.addEventListener('input', (e) => {
      currentSettings.customNamingPattern = e.target.value;
    });
  }
  namingSection.appendChild(customPatternRow);
  body.appendChild(namingSection);

  // Section 1.5: Auto Download Toggle
  const downloadSection = document.createElement('div');
  downloadSection.className = 'settings-group';

  const downloadLabel = document.createElement('h3');
  downloadLabel.className = 'settings-group-title';
  downloadLabel.textContent = 'Auto-download media';
  downloadSection.appendChild(downloadLabel);

  const downloadRow = document.createElement('label');
  downloadRow.className = `settings-radio-row ${currentSettings.autoDownload !== false ? 'checked' : ''}`;
  downloadRow.style.display = 'flex';
  downloadRow.style.alignItems = 'center';
  downloadRow.style.justifyContent = 'space-between';

  const downloadCheckbox = document.createElement('input');
  downloadCheckbox.type = 'checkbox';
  downloadCheckbox.checked = currentSettings.autoDownload !== false;
  downloadCheckbox.addEventListener('change', (e) => {
    currentSettings.autoDownload = e.target.checked;
    downloadRow.classList.toggle('checked', e.target.checked);
  });

  const downloadText = document.createElement('span');
  downloadText.textContent = 'Download files automatically on completion';

  downloadRow.appendChild(downloadText);
  downloadRow.appendChild(downloadCheckbox);
  downloadSection.appendChild(downloadRow);
  body.appendChild(downloadSection);

  // Section 2: Tab Auto-Refresh
  const refreshSection = document.createElement('div');
  refreshSection.className = 'settings-group';

  const refreshLabel = document.createElement('h3');
  refreshLabel.className = 'settings-group-title';
  refreshLabel.textContent = 'Refresh Flow tab every';
  refreshSection.appendChild(refreshLabel);

  const chipRow = document.createElement('div');
  chipRow.className = 'chips-row';

  const refreshOptions = [
    { id: 'off', label: 'Off' },
    { id: '3', label: '3' },
    { id: '5', label: '5' },
    { id: '10', label: '10' }
  ];

  refreshOptions.forEach(opt => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const isSel = String(currentSettings.autoRefresh) === opt.id;
    chip.className = `chip ${isSel ? 'selected' : ''}`;
    chip.textContent = opt.label;

    chip.addEventListener('click', () => {
      currentSettings.autoRefresh = opt.id === 'off' ? 'off' : parseInt(opt.id, 10);
      chipRow.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });

    chipRow.appendChild(chip);
  });
  refreshSection.appendChild(chipRow);

  const refreshSub = document.createElement('p');
  refreshSub.className = 'settings-subtext';
  refreshSub.textContent = 'Auto-refresh is off on Quetta — reloading the Flow tab here interrupts a running queue. (On Chrome you can set how often it refreshes.)';
  refreshSection.appendChild(refreshSub);

  body.appendChild(refreshSection);

  // Section 3: Troubleshooting & Cache
  const troubleSection = document.createElement('div');
  troubleSection.className = 'settings-group';

  const troubleLabel = document.createElement('h3');
  troubleLabel.className = 'settings-group-title';
  troubleLabel.textContent = 'Troubleshooting';
  troubleSection.appendChild(troubleLabel);

  const troubleSub = document.createElement('p');
  troubleSub.className = 'settings-subtext';
  troubleSub.textContent = 'If generation suddenly stops working after a Google Flow update, clear the cache to fetch the latest connection settings, then reopen this panel.';
  troubleSection.appendChild(troubleSub);

  const troubleActions = document.createElement('div');
  troubleActions.className = 'settings-action-row';

  const clearCacheBtn = document.createElement('button');
  clearCacheBtn.type = 'button';
  clearCacheBtn.className = 'btn-settings-action';
  clearCacheBtn.textContent = 'Clear cache';
  clearCacheBtn.addEventListener('click', () => {
    if (onClearCache) onClearCache();
  });
  troubleActions.appendChild(clearCacheBtn);

  const calibrateBtn = document.createElement('button');
  calibrateBtn.type = 'button';
  calibrateBtn.className = 'btn-settings-action';
  calibrateBtn.textContent = 'Calibrate selectors';
  calibrateBtn.addEventListener('click', () => {
    if (onCalibrate) onCalibrate();
  });
  troubleActions.appendChild(calibrateBtn);

  troubleSection.appendChild(troubleActions);

  const extraActions = document.createElement('div');
  extraActions.className = 'settings-action-row';

  const exportLogBtn = document.createElement('button');
  exportLogBtn.type = 'button';
  exportLogBtn.className = 'btn-settings-link';
  exportLogBtn.textContent = 'Export log';
  exportLogBtn.addEventListener('click', () => {
    if (onExportLog) onExportLog();
  });
  extraActions.appendChild(exportLogBtn);

  const resetAllBtn = document.createElement('button');
  resetAllBtn.type = 'button';
  resetAllBtn.className = 'btn-settings-link btn-danger-link';
  resetAllBtn.textContent = 'Reset everything';
  resetAllBtn.addEventListener('click', () => {
    if (window.confirm('Reset all settings, queues, and history to defaults?')) {
      if (onResetAll) onResetAll();
    }
  });
  extraActions.appendChild(resetAllBtn);

  troubleSection.appendChild(extraActions);
  body.appendChild(troubleSection);

  sheet.appendChild(body);

  // Footer Save button
  const footer = document.createElement('div');
  footer.className = 'sheet-footer';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-sheet-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    if (onSave) onSave(currentSettings);
    onClose();
  });
  footer.appendChild(saveBtn);

  sheet.appendChild(footer);
  container.appendChild(sheet);
}
