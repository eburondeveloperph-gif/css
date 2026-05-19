async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json', 'Host': 'srv909561.hstgr.cloud' }; // NO X-Device-Id
  
  const endpoints = ['/device', '/devices', '/api/devices', '/device/create', '/api/devices/create', '/instance/create'];
  for (const ep of endpoints) {
      const url = `${gowaUrl}${ep}?device_id=eburon`;
      let res = await fetch(url, { headers: hdrs, method: 'POST', body: JSON.stringify({name: 'eburon'}) });
      console.log('POST', ep, res.status, await res.text());
  }
}
run();
