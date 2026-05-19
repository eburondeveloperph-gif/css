async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json', 'Host': 'srv909561.hstgr.cloud' };
  
  let devicesRes = await fetch(gowaUrl + '/devices', { headers: hdrs });
  let devicesData = await devicesRes.json();
  console.log(devicesData);
}
run();
