async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json', 'Host': 'srv909561.hstgr.cloud', 'X-Device-Id': 'eburon' };
  
  let res = await fetch(gowaUrl + '/api/devices', { headers: hdrs });
  console.log('GET /api/devices:', res.status, await res.text());

  res = await fetch(gowaUrl + '/api/devices', { headers: hdrs, method: 'POST', body: JSON.stringify({device_id: 'eburon'}) });
  console.log('POST /api/devices:', res.status, await res.text());
}
run();
