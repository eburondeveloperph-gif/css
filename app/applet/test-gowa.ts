import fetch from 'node-fetch';
async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx' };
  
  let res = await fetch(gowaUrl + '/device', { headers: hdrs });
  console.log('/device:', await res.text());
  
  res = await fetch(gowaUrl + '/device/list', { headers: hdrs });
  console.log('/device/list:', await res.text());

  res = await fetch(gowaUrl + '/device/create', { method: 'POST', headers: hdrs, body: JSON.stringify({device_id: 'eburon'}) });
  console.log('/device/create:', await res.text());
}
run();
