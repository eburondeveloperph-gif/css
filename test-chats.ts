import fetch from 'node-fetch';

async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json', 'Host': 'srv909561.hstgr.cloud' };
  
  let devicesRes = await fetch(gowaUrl + '/devices', { headers: hdrs });
  let devicesData = await devicesRes.json();
  if (!devicesData.results || devicesData.results.length === 0) return;
  const did = devicesData.results[0].id;
  hdrs['X-Device-Id'] = did;
  console.log('device id:', did);

  let msgRes = await fetch(gowaUrl + '/chats?limit=5', { headers: hdrs });
  console.log(await msgRes.text());
}
run();
