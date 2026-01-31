# Tab Alarm Monitor - Firefox Extension

A Firefox extension that helps you monitor and manage important tabs with customizable alarms. Get notified when you haven't visited a tab for a specified period.

## Features

- **Custom Time Intervals**: Set alarms in seconds, minutes, hours, or days
- **Visual Indicators**: Tabs show colored status bars (green for safe, pink for alerts)
- **Sound Alerts**: Audio notification when it's time to check a tab
- **Tab Title Updates**: Emoji indicators and alarm counts in tab titles
- **Mute Control**: Toggle sound notifications on/off
- **Alarm Counter**: Track how many times an alarm has triggered
- **Auto-cleanup**: Removes monitoring when tabs are closed

## How It Works

1. **Add Tab Monitoring**: Click "Add Current Tab" to monitor the active tab
2. **Set Interval**: Choose how often you want to be reminded
3. **Visual Feedback**: Tab gets a green indicator showing it's being monitored
4. **Alerts**: When time elapses without visiting the tab, you get:
   - Red visual indicator on the tab
   - Sound notification
   - Desktop notification
   - Updated tab title with alarm count
5. **Reset**: Visit the tab or click "Visit" to reset the alarm

## Technical Details

### Architecture

- **Background Script** (`background.js`): Manages alarms, notifications, and tab monitoring
- **Popup UI** (`popup.js`): User interface for adding/managing monitored tabs
- **Storage** (`storage.js`): Handles data persistence using browser.storage API
- **Offscreen Audio** (`offscreen.js`): Handles audio playback for Chrome compatibility

### Browser Compatibility

- Supports both Firefox (using `browser` API) and Chrome (using `chrome` API)
- Firefox: Uses Audio element in background script
- Chrome: Uses offscreen document for audio playback
- Minimum Firefox version: 140.0

### Data Storage

All data is stored locally using `browser.storage.local`:
- Tab monitoring status
- Last visit timestamps
- Alarm counts
- Sound mute preferences

### Permissions Required

- `storage`: Save monitoring data
- `tabs`: Access tab information
- `alarms`: Create periodic reminders
- `notifications`: Show desktop notifications
- `<all_urls>`: Inject visual indicators into tabs

## Privacy

This extension does NOT collect or transmit any data. All monitoring happens locally in your browser.

## Build Process

The extension uses a Python build script to:
1. Resize the source icon to required sizes (16x16, 48x48, 128x128)
2. Create a Firefox-compatible zip file with forward slashes

No minification, transpilation, or bundling is performed. All JavaScript code is written in plain ES6+ compatible with Firefox.

## File Structure

```
├── manifest.json
├── popup.html
├── offscreen.html
├── build_firefox.py
├── assets/
│   ├── css/
│   │   ├── popup.css
│   │   └── root.css
│   ├── icons/
│   │   └── icon.png
│   ├── js/
│   │   ├── background.js
│   │   ├── popup.js
│   │   ├── storage.js
│   │   └── offscreen.js
│   └── sounds/
│       └── alarm.mp3
```

## Developer

Created by Qays Sarayra - https://qayssarayra.com