async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json', 'Host': 'srv909561.hstgr.cloud', 'X-Device-Id': '2754b6f1-dbc8-46ae-8d35-e5ed7853c4f3' };
  
  let res = await fetch(gowaUrl + '/send/message', { headers: hdrs, method: 'POST', body: JSON.stringify({phone: '123', message: 'test'}) });
  console.log('body1:', res.status, await res.text());
  
  res = await fetch(gowaUrl + '/send/message', { headers: hdrs, method: 'POST', body: JSON.stringify({to: '123', message: 'test'}) });
  console.log('body2:', res.status, await res.text());
}
run();
