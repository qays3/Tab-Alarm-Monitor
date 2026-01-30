const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
  const addButton = document.getElementById('addCurrentTab');
  const intervalInput = document.getElementById('intervalInput');
  const unitSelect = document.getElementById('unitSelect');
  const tabsList = document.getElementById('tabsList');
  const muteToggle = document.getElementById('muteToggle');
  const soundOnIcon = muteToggle.querySelector('.sound-on');
  const soundOffIcon = muteToggle.querySelector('.sound-off');

  const muteState = await browserAPI.storage.local.get(['soundMuted']);
  let isMuted = muteState?.soundMuted || false;
  updateMuteButton();

  function updateMuteButton() {
    if (isMuted) {
      soundOnIcon.style.display = 'none';
      soundOffIcon.style.display = 'block';
      muteToggle.classList.add('muted');
    } else {
      soundOnIcon.style.display = 'block';
      soundOffIcon.style.display = 'none';
      muteToggle.classList.remove('muted');
    }
  }

  muteToggle.addEventListener('click', async () => {
    isMuted = !isMuted;
    await browserAPI.storage.local.set({ soundMuted: isMuted });
    updateMuteButton();
  });

  function formatTimeAgo(elapsed) {
    const seconds = elapsed % 60;
    const totalMinutes = Math.floor(elapsed / 60);
    const minutes = totalMinutes % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const hours = totalHours % 24;
    const days = Math.floor(totalHours / 24);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ') + ' ago';
  }

  async function renderTabs() {
    const tabs = await Storage.getAll();
    const tabIds = Object.keys(tabs);

    if (tabIds.length === 0) {
      tabsList.innerHTML = '<div class="empty-state">No tabs monitored yet. Add current tab to start monitoring.</div>';
      return;
    }

    let html = '';
    for (const tabId of tabIds) {
      const tab = tabs[tabId];
      const isAlert = tab.status === 'alert';
      const statusClass = isAlert ? 'alert' : 'safe';
      const alarmCount = tab.alarmCount || 0;
      
      const now = Date.now();
      const elapsed = Math.floor((now - tab.lastVisit) / 1000);
      const timeStr = formatTimeAgo(elapsed);

      html += `
        <div class="tab-item ${statusClass}" data-tab-id="${tabId}">
          <div class="tab-header">
            <div class="tab-title">${tab.title}</div>
            <div class="tab-actions">
              <button class="btn-success visit-btn" data-tab-id="${tabId}">Visit</button>
              <button class="btn-danger remove-btn" data-tab-id="${tabId}">Remove</button>
            </div>
          </div>
          <div class="tab-url">${tab.url}</div>
          <div class="tab-info">
            <span class="tab-interval">Every ${tab.interval} ${tab.unit}</span>
            <div class="tab-status">
              <span class="status-dot ${statusClass}"></span>
              <span>Last visit: ${timeStr}</span>
            </div>
          </div>
          ${alarmCount > 0 ? `<div class="alarm-counter">🔔 ${alarmCount} alarm${alarmCount > 1 ? 's' : ''} missed</div>` : ''}
        </div>
      `;
    }

    tabsList.innerHTML = html;

    document.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tabId = e.target.dataset.tabId;
        await Storage.removeTab(tabId);
        browserAPI.runtime.sendMessage({ action: 'tabRemoved', tabId });
        renderTabs();
      });
    });

    document.querySelectorAll('.visit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tabId = e.target.dataset.tabId;
        await Storage.markVisited(tabId);
        browserAPI.tabs.update(parseInt(tabId), { active: true });
        browserAPI.runtime.sendMessage({ action: 'tabVisited', tabId });
        renderTabs();
      });
    });
  }

  addButton.addEventListener('click', async () => {
    const interval = parseInt(intervalInput.value);
    const unit = unitSelect.value;

    if (!interval || interval < 1) {
      alert('Please enter a valid interval');
      return;
    }

    try {
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
      
      if (!tabs || tabs.length === 0) {
        alert('Could not get current tab');
        return;
      }

      const tab = tabs[0];
      
      await Storage.addTab(tab.id.toString(), {
        title: tab.title,
        url: tab.url,
        interval: interval,
        unit: unit
      });

      browserAPI.runtime.sendMessage({ 
        action: 'tabAdded', 
        tabId: tab.id.toString(),
        interval: interval,
        unit: unit
      });

      renderTabs();
    } catch (err) {
      console.error('Error adding tab:', err);
      alert('Error adding tab: ' + err.message);
    }
  });

  browserAPI.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.monitoredTabs) {
      renderTabs();
    }
    if (namespace === 'local' && changes.soundMuted) {
      isMuted = changes.soundMuted.newValue;
      updateMuteButton();
    }
  });

  renderTabs();
  setInterval(renderTabs, 1000);
});