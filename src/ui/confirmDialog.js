// はい／いいえ の確認画面（洞窟の入口など）。開いている間は全画面を覆い、下のボタンへタップが届かない。
import './confirmDialog.css';

export function createConfirmDialog(root) {
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.hidden = true;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML = `
    <div class="confirm-panel">
      <div class="confirm-title"></div>
      <div class="confirm-note"></div>
      <div class="confirm-buttons">
        <button type="button" data-answer="yes">はい</button>
        <button type="button" data-answer="no">いいえ</button>
      </div>
    </div>
  `;
  root.append(dialog);
  const title = dialog.querySelector('.confirm-title');
  const note = dialog.querySelector('.confirm-note');
  let resolve = null;

  function close(answer) {
    if (!resolve) return;
    const done = resolve;
    resolve = null;
    dialog.hidden = true;
    done(answer);
  }

  dialog.addEventListener('pointerdown', (event) => event.stopPropagation());
  dialog.querySelector('[data-answer="yes"]').addEventListener('click', () => close(true));
  dialog.querySelector('[data-answer="no"]').addEventListener('click', () => close(false));
  window.addEventListener('keydown', (event) => {
    if (!resolve) return;
    if (event.key === 'Escape') close(false);
    if (event.key === 'Enter') close(true);
  });

  // 開いている間に頼まれた確認は「いいえ」として返す（重ねて開かない）
  function ask({ title: titleText, note: noteText }) {
    if (resolve) return Promise.resolve(false);
    title.textContent = titleText;
    note.textContent = noteText ?? '';
    dialog.hidden = false;
    dialog.querySelector('[data-answer="yes"]').focus?.();
    return new Promise((done) => { resolve = done; });
  }

  return { ask, open: () => resolve !== null, close: () => close(false) };
}
