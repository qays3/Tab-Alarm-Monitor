const Storage = {
  async getAll() {
    try {
      const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
      const result = await browserAPI.storage.local.get(['monitoredTabs']);
      return result && result.monitoredTabs ? result.monitoredTabs : {};
    } catch (err) {
      console.error('Storage getAll error:', err);
      return {};
    }
  },

  async save(tabs) {
    try {
      const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
      await browserAPI.storage.local.set({ monitoredTabs: tabs });
    } catch (err) {
      console.error('Storage save error:', err);
    }
  },

  async addTab(tabId, data) {
    const tabs = await this.getAll();
    tabs[tabId] = {
      ...data,
      lastVisit: Date.now(),
      status: 'safe',
      alarmCount: 0
    };
    await this.save(tabs);
    return tabs[tabId];
  },

  async removeTab(tabId) {
    const tabs = await this.getAll();
    delete tabs[tabId];
    await this.save(tabs);
  },

  async updateTab(tabId, updates) {
    const tabs = await this.getAll();
    if (tabs[tabId]) {
      tabs[tabId] = { ...tabs[tabId], ...updates };
      await this.save(tabs);
    }
    return tabs[tabId];
  },

  async markVisited(tabId) {
    return this.updateTab(tabId, {
      lastVisit: Date.now(),
      status: 'safe',
      alarmCount: 0
    });
  },

  async markAlert(tabId) {
    const tabs = await this.getAll();
    if (tabs[tabId]) {
      const currentCount = tabs[tabId].alarmCount || 0;
      return this.updateTab(tabId, {
        status: 'alert',
        alarmCount: currentCount + 1
      });
    }
  }
};