console.log('Offscreen document loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Offscreen received message:', message);
  
  if (message.action === 'playAlarm') {
    const isMuted = message.muted || false;
    console.log('Playing alarm, muted:', isMuted);
    
    if (!isMuted) {
      const audio = document.getElementById('alarmAudio');
      if (audio) {
        audio.src = chrome.runtime.getURL('assets/sounds/alarm.mp3');
        audio.volume = 1.0;
        audio.play()
          .then(() => {
            console.log('Audio played successfully');
            sendResponse({ status: 'played' });
          })
          .catch(err => {
            console.error('Audio play failed:', err);
            sendResponse({ status: 'error', error: err.message });
          });
      } else {
        console.error('Audio element not found');
        sendResponse({ status: 'error', error: 'Audio element not found' });
      }
    } else {
      console.log('Sound is muted, skipping playback');
      sendResponse({ status: 'muted' });
    }
    
    return true;
  }
});