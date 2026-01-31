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

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function createTabElement(tabId, tab) {
    const isAlert = tab.status === 'alert';
    const statusClass = isAlert ? 'alert' : 'safe';
    const alarmCount = tab.alarmCount || 0;
    
    const now = Date.now();
    const elapsed = Math.floor((now - tab.lastVisit) / 1000);
    const timeStr = formatTimeAgo(elapsed);

    const tabItem = document.createElement('div');
    tabItem.className = `tab-item ${statusClass}`;
    tabItem.setAttribute('data-tab-id', tabId);

    // Header
    const header = document.createElement('div');
    header.className = 'tab-header';

    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title;

    const actions = document.createElement('div');
    actions.className = 'tab-actions';

    const visitBtn = document.createElement('button');
    visitBtn.className = 'btn-success visit-btn';
    visitBtn.setAttribute('data-tab-id', tabId);
    visitBtn.textContent = 'Visit';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-danger remove-btn';
    removeBtn.setAttribute('data-tab-id', tabId);
    removeBtn.textContent = 'Remove';

    actions.appendChild(visitBtn);
    actions.appendChild(removeBtn);
    header.appendChild(title);
    header.appendChild(actions);

    // URL
    const urlDiv = document.createElement('div');
    urlDiv.className = 'tab-url';
    urlDiv.textContent = tab.url;

    // Info
    const info = document.createElement('div');
    info.className = 'tab-info';

    const interval = document.createElement('span');
    interval.className = 'tab-interval';
    interval.textContent = `Every ${tab.interval} ${tab.unit}`;

    const status = document.createElement('div');
    status.className = 'tab-status';

    const dot = document.createElement('span');
    dot.className = `status-dot ${statusClass}`;

    const lastVisit = document.createElement('span');
    lastVisit.textContent = `Last visit: ${timeStr}`;

    status.appendChild(dot);
    status.appendChild(lastVisit);
    info.appendChild(interval);
    info.appendChild(status);

    // Assemble
    tabItem.appendChild(header);
    tabItem.appendChild(urlDiv);
    tabItem.appendChild(info);

    // Alarm counter
    if (alarmCount > 0) {
      const counter = document.createElement('div');
      counter.className = 'alarm-counter';
      counter.textContent = `🔔 ${alarmCount} alarm${alarmCount > 1 ? 's' : ''} missed`;
      tabItem.appendChild(counter);
    }

    return tabItem;
  }

  async function renderTabs() {
    const tabs = await Storage.getAll();
    const tabIds = Object.keys(tabs);

    // Clear existing content
    while (tabsList.firstChild) {
      tabsList.removeChild(tabsList.firstChild);
    }

    if (tabIds.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'No tabs monitored yet. Add current tab to start monitoring.';
      tabsList.appendChild(emptyState);
      return;
    }

    for (const tabId of tabIds) {
      const tab = tabs[tabId];
      const tabElement = createTabElement(tabId, tab);
      tabsList.appendChild(tabElement);
    }

    // Add event listeners
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