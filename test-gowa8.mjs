async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json', 'Host': 'srv909561.hstgr.cloud' };
  
  let res = await fetch(gowaUrl + '/devices', { headers: hdrs });
  console.log('GET /devices:', res.status, await res.text());
}
run();
