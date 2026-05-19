async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json', 'Host': 'srv909561.hstgr.cloud' };
  
  let res = await fetch(gowaUrl + '/device', { headers: hdrs });
  console.log('/device:', await res.text());
  
  res = await fetch(gowaUrl + '/device/list', { headers: hdrs });
  console.log('/device/list:', await res.text());

  res = await fetch(gowaUrl + '/app/login', { headers: hdrs });
  console.log('/app/login:', await res.text());
}
run();
