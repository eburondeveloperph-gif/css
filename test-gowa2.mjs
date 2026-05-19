async function run() {
  const gowaUrl = 'https://gowa-7c8k.srv909561.hstgr.cloud';
  const hdrs = { 'Authorization': 'Basic YWRtaW46MTIwMjIx', 'Content-Type': 'application/json' };
  
  Object.defineProperty(hdrs, 'Host', { value: 'srv909561.hstgr.cloud', enumerable: true }); // Avoid host replacement by some fetch implementations
  
  let res = await fetch(gowaUrl + '/device', { headers: hdrs });
  console.log('/device:', await res.text());
  
  res = await fetch(gowaUrl + '/app/login', { headers: hdrs, method: 'POST' });
  console.log('/app/login:', await res.text());
}
run();
