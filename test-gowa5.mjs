async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json', 'Host': 'srv909561.hstgr.cloud' }; // NO X-Device-Id
  
  const endpoints = ['/device', '/device/list', '/device/create', '/api/devices', '/device/start', '/device/connect', '/instance/create'];
  for (const ep of endpoints) {
      let res = await fetch(gowaUrl + ep, { headers: hdrs, method: 'POST', body: JSON.stringify({device_id: 'eburon'}) });
      console.log('POST', ep, res.status, await res.text());
  }
}
run();
