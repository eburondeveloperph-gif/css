async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json', 'Host': 'srv909561.hstgr.cloud', 'X-Device-Id': '2754b6f1-dbc8-46ae-8d35-e5ed7853c4f3' };
  
  let res = await fetch(gowaUrl + '/app/login', { headers: hdrs });
  console.log('GET /app/login:', res.status, await res.text());
}
run();
