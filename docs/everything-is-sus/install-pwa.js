let installPrompt;

function isInstalled() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function updateButtons() {
  for (const button of document.querySelectorAll('[data-install-app]')) {
    button.hidden = isInstalled();
    const label = installPrompt ? 'Install app' : 'Install';
    if (button.textContent !== label) button.textContent = label;
  }
}

function showInstructions() {
  const dialog = document.createElement('dialog');
  dialog.className = 'install-dialog';
  dialog.innerHTML = `<form method="dialog"><p class="kicker">Install Everything's Sus</p><h2>Keep the case close at hand</h2><p>Use your browser's <strong>Install app</strong> or <strong>Add to Home Screen</strong> command.</p><ul><li>The app opens on the landing page by default.</li><li>Use its Pass &amp; Play, Host, or Player shortcut to return directly to that mode.</li><li>A saved game or private hand on this device resumes automatically.</li></ul><button class="primary">Got it</button></form>`;
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}

document.addEventListener('click', async (event) => {
  if (!event.target.closest('[data-install-app]')) return;
  if (!installPrompt) { showInstructions(); return; }
  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = undefined;
  updateButtons();
});
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  updateButtons();
});
window.addEventListener('appinstalled', updateButtons);
new MutationObserver(updateButtons).observe(document.body, { childList: true, subtree: true });
updateButtons();
