/* Stash Tile: current egress IP/region, Google, ChatGPT, optional active group selection.
 * Configure API address, API secret and group in the Tile's argument (not in public JS).
 * Status is a connectivity/region indicator, not an account-level login test.
 */
(function () {
  var opts = {};
  String(typeof $argument === 'undefined' ? '' : $argument).split(';').forEach(function (p) {
    var i = p.indexOf('=');
    if (i > 0) opts[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  function get(url, headers, cb) {
    $httpClient.get({url:url, headers:headers || {}, timeout:8, 'auto-redirect':false}, function (err, resp, data) {
      cb(err, resp || {}, data || '');
    });
  }
  function valid(status) { return status >= 200 && status < 400; }
  var state = {node:'', ip:'未知', country:'未知', google:'检测中', gpt:'检测中'};
  var remaining = 4;
  function finishOne() { if (--remaining === 0) render(); }
  function render() {
    var checks = [state.google, state.gpt];
    var good = checks.filter(function(x){ return x === '可用'; }).length;
    var fail = checks.filter(function(x){ return x === '不可用'; }).length;
    var bg = good === 2 ? '#205B51' : fail ? '#6B3940' : '#253B58';
    var content = (state.node ? '节点：' + state.node + '\n' : '') +
      '出口：' + state.country + ' · ' + state.ip + '\n' +
      'Google：' + state.google + '  |  ChatGPT：' + state.gpt;
    $done({title:'网络状态', content:content, icon:'network', backgroundColor:bg});
  }
  get('https://ipwho.is/', {}, function(err, resp, data) {
    try {
      var v = JSON.parse(data);
      if (!err && v.success !== false && v.ip) {
        state.ip = v.ip;
        state.country = v.country || v.country_code || '未知';
      }
    } catch(e) {}
    finishOne();
  });
  get('https://www.google.com/generate_204', {}, function(err, resp) {
    state.google = err ? '网络错误' : (Number(resp.status || resp.statusCode) === 204 ? '可用' : '不可用');
    finishOne();
  });
  get('https://chatgpt.com/', {}, function(err, resp, data) {
    var code = Number(resp.status || resp.statusCode || 0);
    var body = String(data).toLowerCase();
    if (err || !code) state.gpt = '网络错误';
    else if (body.indexOf('unsupported_country') !== -1 || code === 451) state.gpt = '地区受限';
    else if (valid(code) || code === 403 || code === 429) state.gpt = '可达*';
    else state.gpt = '不可用';
    finishOne();
  });
  if (opts.api && opts.secret && opts.group) {
    var endpoint = opts.api.replace(/\/$/, '') + '/proxies/' + encodeURIComponent(opts.group);
    get(endpoint, {'Authorization':'Bearer ' + opts.secret}, function(err, resp, data) {
      try {
        var v = JSON.parse(data);
        if (!err && Number(resp.status || resp.statusCode) === 200 && v.now) state.node = v.now;
      } catch(e) {}
      finishOne();
    });
  } else {
    finishOne();
  }
})();
