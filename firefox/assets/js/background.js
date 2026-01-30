const ALARM_PREFIX = 'tab_alarm_';
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Audio element for Firefox compatibility
let audioElement = null;

function initAudio() {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.volume = 1.0;
  }
}

async function getMonitoredTabs() {
  try {
    const result = await browserAPI.storage.local.get(['monitoredTabs']);
    return result && result.monitoredTabs ? result.monitoredTabs : {};
  } catch (err) {
    console.error('Error getting monitored tabs:', err);
    return {};
  }
}

async function saveMonitoredTabs(tabs) {
  try {
    await browserAPI.storage.local.set({ monitoredTabs: tabs });
  } catch (err) {
    console.error('Error saving monitored tabs:', err);
  }
}

function getIntervalInMinutes(interval, unit) {
  if (unit === 'seconds') {
    return interval / 60;
  } else if (unit === 'hours') {
    return interval * 60;
  } else if (unit === 'days') {
    return interval * 60 * 24;
  }
  return interval; // minutes
}

function createAlarmName(tabId) {
  return `${ALARM_PREFIX}${tabId}`;
}

async function setupAlarm(tabId, interval, unit) {
  const alarmName = createAlarmName(tabId);
  const periodInMinutes = getIntervalInMinutes(interval, unit);
  
  await browserAPI.alarms.create(alarmName, {
    delayInMinutes: periodInMinutes,
    periodInMinutes: periodInMinutes
  });
}

async function clearAlarm(tabId) {
  const alarmName = createAlarmName(tabId);
  await browserAPI.alarms.clear(alarmName);
}

async function canInjectScript(tabId) {
  try {
    const tab = await browserAPI.tabs.get(parseInt(tabId));
    if (!tab || !tab.url) return false;
    const url = tab.url.toLowerCase();
    return !url.startsWith('chrome://') && 
           !url.startsWith('chrome-extension://') && 
           !url.startsWith('about:') && 
           !url.startsWith('edge://') &&
           !url.startsWith('moz-extension://') &&
           !url.startsWith('file://');
  } catch (err) {
    return false;
  }
}

async function setTabIndicator(tabId, status, count) {
  const canInject = await canInjectScript(tabId);
  if (!canInject) {
    return;
  }

  try {
    if (browserAPI.scripting && browserAPI.scripting.executeScript) {
      await browserAPI.scripting.executeScript({
        target: { tabId: parseInt(tabId) },
        func: (alertStatus, alarmCount) => {
          if (!window.originalTitle) {
            window.originalTitle = document.title;
          }
          
          if (alertStatus === 'alert') {
            const prefix = alarmCount > 0 ? `🔴 (${alarmCount}) ` : '🔴 ';
            document.title = prefix + window.originalTitle.replace(/^🔴.*?\s/, '').replace(/^🟢\s/, '');
          } else {
            document.title = '🟢 ' + window.originalTitle.replace(/^🔴.*?\s/, '').replace(/^🟢\s/, '');
          }
          
          const existingStyle = document.getElementById('tab-monitor-style');
          if (existingStyle) existingStyle.remove();
          
          const color = alertStatus === 'alert' ? '#ec4899' : '#10b981';
          const style = document.createElement('style');
          style.id = 'tab-monitor-style';
          style.textContent = `
            body::before {
              content: '';
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              height: 6px;
              background: ${color};
              z-index: 999999;
              box-shadow: 0 0 20px ${color};
              animation: tabPulse 2s ease-in-out infinite;
            }
            @keyframes tabPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
          `;
          document.head.appendChild(style);
        },
        args: [status, count]
      });
    } else {
      await browserAPI.tabs.executeScript(parseInt(tabId), {
        code: `
          (function(alertStatus, alarmCount) {
            if (!window.originalTitle) {
              window.originalTitle = document.title;
            }
            
            if (alertStatus === 'alert') {
              const prefix = alarmCount > 0 ? '🔴 (' + alarmCount + ') ' : '🔴 ';
              document.title = prefix + window.originalTitle.replace(/^🔴.*?\\s/, '').replace(/^🟢\\s/, '');
            } else {
              document.title = '🟢 ' + window.originalTitle.replace(/^🔴.*?\\s/, '').replace(/^🟢\\s/, '');
            }
            
            const existingStyle = document.getElementById('tab-monitor-style');
            if (existingStyle) existingStyle.remove();
            
            const color = alertStatus === 'alert' ? '#ec4899' : '#10b981';
            const style = document.createElement('style');
            style.id = 'tab-monitor-style';
            style.textContent = \`
              body::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 6px;
                background: \${color};
                z-index: 999999;
                box-shadow: 0 0 20px \${color};
                animation: tabPulse 2s ease-in-out infinite;
              }
              @keyframes tabPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
              }
            \`;
            document.head.appendChild(style);
          })('${status}', ${count});
        `
      });
    }
  } catch (err) {
    console.log(`Cannot inject script into tab ${tabId}:`, err.message);
  }
}

async function removeTabIndicator(tabId) {
  const canInject = await canInjectScript(tabId);
  if (!canInject) return;

  try {
    if (browserAPI.scripting && browserAPI.scripting.executeScript) {
      await browserAPI.scripting.executeScript({
        target: { tabId: parseInt(tabId) },
        func: () => {
          if (window.originalTitle) {
            document.title = window.originalTitle;
          }
          
          const existingStyle = document.getElementById('tab-monitor-style');
          if (existingStyle) existingStyle.remove();
        }
      });
    } else {
      await browserAPI.tabs.executeScript(parseInt(tabId), {
        code: `
          if (window.originalTitle) {
            document.title = window.originalTitle;
          }
          
          const existingStyle = document.getElementById('tab-monitor-style');
          if (existingStyle) existingStyle.remove();
        `
      });
    }
  } catch (err) {
    console.log(`Cannot remove indicator from tab ${tabId}:`, err.message);
  }
}

async function playAlarm() {
  const muteState = await browserAPI.storage.local.get(['soundMuted']);
  const isMuted = muteState?.soundMuted || false;
  
  if (isMuted) {
    return;
  }
  
  // For Chrome - use offscreen document
  if (typeof chrome !== 'undefined' && chrome.offscreen && chrome.offscreen.createDocument) {
    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
      });

      if (existingContexts.length === 0) {
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: ['AUDIO_PLAYBACK'],
          justification: 'Play alarm sound for tab monitoring',
        });
      }

      await chrome.runtime.sendMessage({ 
        action: 'playAlarm',
        muted: isMuted
      });
    } catch (err) {
      console.error('Offscreen audio error:', err);
    }
  } 
  // For Firefox - use Audio element in background
  else {
    try {
      initAudio();
      audioElement.src = browserAPI.runtime.getURL('assets/sounds/alarm.mp3');
      
      // Force load and play
      await audioElement.load();
      
      const playPromise = audioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.error('Audio play failed:', err);
          // Fallback: try creating a new Audio element
          try {
            const fallbackAudio = new Audio(browserAPI.runtime.getURL('assets/sounds/alarm.mp3'));
            fallbackAudio.volume = 1.0;
            fallbackAudio.play().catch(e => console.error('Fallback audio failed:', e));
          } catch (e) {
            console.error('Fallback audio creation failed:', e);
          }
        });
      }
    } catch (err) {
      console.error('Firefox audio error:', err);
    }
  }
}

async function handleAlarm(alarm) {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const tabId = alarm.name.replace(ALARM_PREFIX, '');
  const tabs = await getMonitoredTabs();
  
  if (!tabs[tabId]) {
    await clearAlarm(tabId);
    return;
  }

  const tab = tabs[tabId];
  const now = Date.now();
  const intervalMs = getIntervalInMinutes(tab.interval, tab.unit) * 60 * 1000;
  const timeSinceLastVisit = now - tab.lastVisit;

  if (timeSinceLastVisit >= intervalMs) {
    const currentCount = tab.alarmCount || 0;
    tabs[tabId].status = 'alert';
    tabs[tabId].alarmCount = currentCount + 1;
    await saveMonitoredTabs(tabs);
    
    await setTabIndicator(tabId, 'alert', tabs[tabId].alarmCount);
    await playAlarm();
    
    try {
      browserAPI.notifications.create({
        type: 'basic',
        iconUrl: browserAPI.runtime.getURL('assets/icons/icon.png'),
        title: 'Tab Alarm',
        message: `Time to check: ${tab.title}`,
        priority: 2
      });
    } catch (err) {
      console.log('Notification error:', err);
    }

    try {
      await browserAPI.tabs.get(parseInt(tabId));
    } catch (e) {
      delete tabs[tabId];
      await saveMonitoredTabs(tabs);
      await clearAlarm(tabId);
    }
  }
}

browserAPI.alarms.onAlarm.addListener(handleAlarm);

browserAPI.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'testSound') {
    await playAlarm();
    sendResponse({ status: 'ok' });
  } else if (message.action === 'tabAdded') {
    await setupAlarm(message.tabId, message.interval, message.unit);
    await setTabIndicator(message.tabId, 'safe', 0);
  } else if (message.action === 'tabRemoved') {
    await clearAlarm(message.tabId);
    await removeTabIndicator(message.tabId);
  } else if (message.action === 'tabVisited') {
    await clearAlarm(message.tabId);
    const tabs = await getMonitoredTabs();
    if (tabs[message.tabId]) {
      tabs[message.tabId].alarmCount = 0;
      await saveMonitoredTabs(tabs);
      await setTabIndicator(message.tabId, 'safe', 0);
      await setupAlarm(message.tabId, tabs[message.tabId].interval, tabs[message.tabId].unit);
    }
  }
  
  return true;
});

browserAPI.tabs.onRemoved.addListener(async (tabId) => {
  const tabs = await getMonitoredTabs();
  const tabIdStr = tabId.toString();
  if (tabs[tabIdStr]) {
    delete tabs[tabIdStr];
    await saveMonitoredTabs(tabs);
    await clearAlarm(tabIdStr);
  }
});

browserAPI.tabs.onActivated.addListener(async (activeInfo) => {
  const tabs = await getMonitoredTabs();
  const tabIdStr = activeInfo.tabId.toString();
  if (tabs[tabIdStr] && tabs[tabIdStr].status === 'alert') {
    tabs[tabIdStr].lastVisit = Date.now();
    tabs[tabIdStr].status = 'safe';
    tabs[tabIdStr].alarmCount = 0;
    await saveMonitoredTabs(tabs);
    await setTabIndicator(tabIdStr, 'safe', 0);
  }
});

browserAPI.runtime.onInstalled.addListener(async () => {
  initAudio();
  const tabs = await getMonitoredTabs();
  for (const [tabId, tab] of Object.entries(tabs)) {
    await setupAlarm(tabId, tab.interval, tab.unit);
    const status = tab.status || 'safe';
    const count = tab.alarmCount || 0;
    await setTabIndicator(tabId, status, count);
  }
});

 
initAudio();