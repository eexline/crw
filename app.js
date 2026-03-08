// Navigation and settings (balance, token amounts) — persisted in localStorage
// Token prices from Binance API (free, no key, CORS allowed)

const STORAGE_BALANCE = 'wallet_balance';
const STORAGE_USERNAME = 'wallet_username';
const STORAGE_ADDRESS = 'wallet_address';
const STORAGE_BTC = 'wallet_btc';
const STORAGE_ETH = 'wallet_eth';
const STORAGE_BNB = 'wallet_bnb';
const STORAGE_HISTORY = 'wallet_history';

const DEFAULT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

const TOKEN_SYMBOLS = { btc: 'BTC', eth: 'ETH', bnb: 'BNB' };
const DEFAULT_AMOUNTS = { btc: '0.1245', eth: '2.45', bnb: '15.2' };

const TOKEN_IDS = { usdt: 'tether', btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin' };
const BINANCE_SYMBOLS = { bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT', binancecoin: 'BNBUSDT' };

function formatWithCommas(num) {
  const s = String(num);
  const i = s.indexOf('.');
  const intPart = i >= 0 ? s.slice(0, i) : s;
  const decPart = i >= 0 ? s.slice(i) : '';
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return withCommas + decPart;
}

const TOKEN_AMOUNT_MAX_LEN = 8;

function formatTokenAmount(formatted) {
  if (!formatted || formatted.length <= TOKEN_AMOUNT_MAX_LEN) return formatted;
  return formatted.slice(0, TOKEN_AMOUNT_MAX_LEN) + '…';
}

function formatTokenValue(amount, priceUsd) {
  if (priceUsd == null || isNaN(amount)) return '—';
  const value = amount * priceUsd;
  if (value >= 1000) return '$' + formatWithCommas(value.toFixed(0));
  if (value >= 1) return '$' + formatWithCommas(value.toFixed(2));
  if (value > 0) return '$' + value.toFixed(4);
  return '$0.00';
}

function formatChange(change) {
  if (change == null || isNaN(change)) return { text: '—', positive: true };
  const positive = change >= 0;
  const sign = positive ? '+' : '−';
  const text = sign + Math.abs(change).toFixed(2) + '%';
  return { text, positive };
}

function loadTokenPrices(onPricesLoaded, isRefresh, onRefreshError) {
  const items = document.querySelectorAll('.token-item[data-token][data-amount]');
  if (!items.length) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    if (isRefresh) {
      document.getElementById('refresh-indicator')?.classList.remove('visible');
      document.getElementById('btn-refresh-prices')?.classList.remove('is-spinning');
      document.getElementById('balance-block')?.classList.remove('balance-updating');
      if (typeof onRefreshError === 'function') onRefreshError();
    }
    return;
  }
  const ids = ['bitcoin', 'ethereum', 'tether', 'binancecoin'];
  const urls = ['bitcoin', 'ethereum', 'binancecoin'].map(function (key) {
    return 'https://api.binance.com/api/v3/ticker/24hr?symbol=' + BINANCE_SYMBOLS[key];
  });
  Promise.all(urls.map(function (url) {
    return fetch(url).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(r.status)); });
  }))
    .then(function (responses) {
      const data = { tether: { usd: 1, usd_24h_change: 0 } };
      ['bitcoin', 'ethereum', 'binancecoin'].forEach(function (key, i) {
        const t = responses[i];
        if (t && t.lastPrice != null) {
          const price = parseFloat(t.lastPrice);
          const change = t.priceChangePercent != null ? parseFloat(t.priceChangePercent) : null;
          data[key] = { usd: price, usd_24h_change: change };
        }
      });
      items.forEach((el) => {
        const token = el.dataset.token;
        const valueEl = el.querySelector('.token-value .value');
        const changeEl = el.querySelector('.token-value .change');
        if (!valueEl || !changeEl) return;
        const id = TOKEN_IDS[token];
        const info = id && data[id];
        if (token === 'usdt') {
          if (info && info.usd_24h_change != null) {
            const { text, positive } = formatChange(info.usd_24h_change);
            changeEl.textContent = text;
            changeEl.classList.toggle('positive', positive);
            changeEl.classList.toggle('negative', !positive);
          }
          return;
        }
        const amount = parseFloat(el.dataset.amount) || 0;
        if (info && typeof info.usd === 'number') {
          valueEl.textContent = formatTokenValue(amount, info.usd);
          const { text, positive } = formatChange(info.usd_24h_change);
          changeEl.textContent = text;
          changeEl.classList.toggle('positive', positive);
          changeEl.classList.toggle('negative', !positive);
        }
      });
      if (typeof onPricesLoaded === 'function') onPricesLoaded(data);
    })
    .catch(() => {
      if (isRefresh) {
        document.getElementById('btn-refresh-prices')?.classList.remove('is-spinning');
        document.getElementById('balance-block')?.classList.remove('balance-updating');
        if (typeof onRefreshError === 'function') onRefreshError();
      }
    });
}

function truncateAddress(addr) {
  if (!addr || addr.length < 14) return addr || '0x…';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(() => toast.classList.remove('visible'), 2000);
}

const TAP_SELECTOR = '.icon-btn:not(.icon-btn-no-action), .action-btn, .nav-item:not(.nav-item-no-action), .header-address, .content-tab:not(.content-tab-no-action), .token-item:not(.token-item-no-action), .copy-btn, .settings-input, .settings-select, .settings-btn';

function setupTapFeedback() {
  let activeEl = null;
  function addPress(e) {
    const el = e.target.closest(TAP_SELECTOR);
    if (el && !activeEl) {
      activeEl = el;
      el.classList.add('tap-press');
    }
  }
  function removePress() {
    if (activeEl) {
      activeEl.classList.remove('tap-press');
      activeEl = null;
    }
  }
  document.addEventListener('pointerdown', addPress, { passive: true });
  document.addEventListener('pointerup', removePress, { passive: true });
  document.addEventListener('pointercancel', removePress, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  setupTapFeedback();
  const navItems = document.querySelectorAll('.nav-item');
  const screens = document.querySelectorAll('.screen');
  const btnSettings = document.getElementById('btn-settings');
  const settingUsername = document.getElementById('setting-username');
  const settingBalance = document.getElementById('setting-balance');
  const headerUsername = document.getElementById('header-username');
  const balanceAmountValue = document.getElementById('balance-amount-value');
  const balanceAmountSymbol = document.getElementById('balance-amount-symbol');
  const balance24hValue = document.getElementById('balance-24h-value');
  const balance24hSymbol = document.getElementById('balance-24h-symbol');
  const balance24hPercent = document.getElementById('balance-24h-percent');
  const balance24hRow = document.getElementById('balance-24h-row');
  const settingBtc = document.getElementById('setting-btc');
  const settingEth = document.getElementById('setting-eth');
  const settingBnb = document.getElementById('setting-bnb');
  const settingAddress = document.getElementById('setting-address');
  const headerAddress = document.getElementById('header-address');
  const balanceBlock = document.getElementById('balance-block');
  const refreshIndicator = document.getElementById('refresh-indicator');
  const walletScrollWrap = document.querySelector('.wallet-scroll-wrap');

  let lastPriceData = null;
  let pricesLoadedOnce = false;
  let savedBalanceBeforeRefresh = null;
  let saved24hBeforeRefresh = null;

  function removeSkeleton() {
    document.querySelectorAll('.skeleton-text').forEach((el) => el.classList.remove('skeleton-text'));
  }

  function addBalanceSkeleton() {
    if (balanceAmountValue) balanceAmountValue.classList.add('skeleton-text');
    if (balance24hValue) balance24hValue.classList.add('skeleton-text');
    if (balance24hPercent) balance24hPercent.classList.add('skeleton-text');
  }

  function runLoadedAnimations(skipBalanceFade) {
    if (balanceBlock && !skipBalanceFade) balanceBlock.classList.remove('balance-loaded');
    requestAnimationFrame(function () {
      if (balanceBlock && !skipBalanceFade) balanceBlock.classList.add('balance-loaded');
      setTimeout(function () {
        if (balanceBlock) balanceBlock.classList.remove('balance-loaded');
      }, 1100);
    });
  }

  function onPricesLoaded(data, isRefresh) {
    lastPriceData = data;
    var newTotal = getTotalBalance(data);
    if (typeof newTotal !== 'number' || isNaN(newTotal)) newTotal = 0;
    updateBalance24h(data);
    if (!pricesLoadedOnce) {
      pricesLoadedOnce = true;
      removeSkeleton();
      setTimeout(function () {
        runLoadedAnimations();
      }, 220);
    } else if (isRefresh) {
      removeSkeleton();
      runLoadedAnimations(true);
      var fromVal = savedBalanceBeforeRefresh;
      if (typeof fromVal !== 'number') fromVal = parseDisplayedBalance();
      var from24h = saved24hBeforeRefresh;
      var to24h = parseDisplayed24h();
      if (typeof fromVal === 'number' && !isNaN(fromVal)) {
        var balanceEl = document.getElementById('balance-amount-value');
        if (balanceEl) {
          balanceEl.textContent = formatWithCommas(Number(fromVal).toFixed(2));
          if (from24h && balance24hValue && balance24hPercent && balance24hRow) {
            var signFrom = from24h.changeAbs >= 0 ? '+' : '−';
            balance24hValue.textContent = signFrom + formatWithCommas(Math.abs(from24h.changeAbs).toFixed(2));
            balance24hPercent.textContent = '(' + (from24h.changePct >= 0 ? '+' : '−') + Math.abs(from24h.changePct).toFixed(2) + '%)';
            balance24hRow.classList.remove('positive', 'negative');
            balance24hRow.classList.add(from24h.changePct >= 0 ? 'positive' : 'negative');
          }
          animateBalanceAnd24h(fromVal, newTotal, from24h || null, to24h || null, 600);
        }
      }
      savedBalanceBeforeRefresh = null;
      saved24hBeforeRefresh = null;
    }
    if (isRefresh) {
      document.getElementById('btn-refresh-prices')?.classList.remove('is-spinning');
      balanceBlock?.classList.remove('balance-updating');
    }
  }
  var canFetchPrices = location.protocol === 'http:' || location.protocol === 'https:';
  if (canFetchPrices) {
    loadTokenPrices((data) => onPricesLoaded(data, false), false);
    setInterval(function () {
      loadTokenPrices(function (data) { lastPriceData = data; updateBalance24h(data); }, false);
    }, 300000);
  } else {
    removeSkeleton();
    setTimeout(function () {
      runLoadedAnimations();
    }, 220);
  }

  function applyAddress() {
    const raw = (settingAddress && settingAddress.value.trim()) || '';
    const addr = raw || DEFAULT_ADDRESS;
    if (headerAddress) headerAddress.textContent = truncateAddress(addr);
    try {
      localStorage.setItem(STORAGE_ADDRESS, raw);
    } catch (e) {}
  }

  function copyAddress() {
    const raw = (settingAddress && settingAddress.value.trim()) || '';
    const addr = raw || DEFAULT_ADDRESS;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(addr).then(() => showToast('Address copied')).catch(() => showToast('Address copied'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = addr;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast('Address copied');
      } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function updateTokenValuesFromPrices(data) {
    ['btc', 'eth', 'bnb'].forEach((token) => {
      const row = document.querySelector('.token-item[data-token="' + token + '"]');
      if (!row) return;
      const amount = parseFloat(row.dataset.amount) || 0;
      const price = token === 'btc' ? data.bitcoin?.usd : token === 'eth' ? data.ethereum?.usd : data.binancecoin?.usd;
      const valueEl = row.querySelector('.token-value .value');
      if (valueEl && typeof price === 'number') valueEl.textContent = formatTokenValue(amount, price);
    });
  }

  function applyTokenAmountsToRows() {
    const btcVal = (settingBtc && settingBtc.value.trim()) || DEFAULT_AMOUNTS.btc;
    const ethVal = (settingEth && settingEth.value.trim()) || DEFAULT_AMOUNTS.eth;
    const bnbVal = (settingBnb && settingBnb.value.trim()) || DEFAULT_AMOUNTS.bnb;
    const amounts = { btc: btcVal, eth: ethVal, bnb: bnbVal };
    ['btc', 'eth', 'bnb'].forEach((token) => {
      const row = document.querySelector('.token-item[data-token="' + token + '"]');
      if (!row) return;
      const raw = amounts[token].replace(/,/g, '');
      const num = parseFloat(raw) || 0;
      row.dataset.amount = String(num);
      const amountEl = row.querySelector('.token-info .token-amount');
      if (amountEl) {
        const formatted = formatWithCommas(raw === '' ? '0' : String(num));
        amountEl.textContent = formatTokenAmount(formatted) + ' ' + TOKEN_SYMBOLS[token];
      }
    });
    try {
      if (settingBtc) localStorage.setItem(STORAGE_BTC, btcVal);
      if (settingEth) localStorage.setItem(STORAGE_ETH, ethVal);
      if (settingBnb) localStorage.setItem(STORAGE_BNB, bnbVal);
    } catch (e) {}
  }

  function getTotalBalance(data) {
    const usdtVal = parseFloat(settingBalance && settingBalance.value.trim()) || 0;
    if (!data) return usdtVal;
    const btcVal = (parseFloat(document.querySelector('.token-item[data-token="btc"]')?.dataset.amount) || 0) * (data.bitcoin?.usd ?? 0);
    const ethVal = (parseFloat(document.querySelector('.token-item[data-token="eth"]')?.dataset.amount) || 0) * (data.ethereum?.usd ?? 0);
    const bnbVal = (parseFloat(document.querySelector('.token-item[data-token="bnb"]')?.dataset.amount) || 0) * (data.binancecoin?.usd ?? 0);
    return usdtVal + btcVal + ethVal + bnbVal;
  }

  function parseDisplayedBalance() {
    if (!balanceAmountValue) return 0;
    const s = (balanceAmountValue.textContent || '').replace(/,/g, '').trim();
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function parseDisplayed24h() {
    if (!balance24hValue || !balance24hPercent) return null;
    var valStr = (balance24hValue.textContent || '').replace(/,/g, '').replace(/\s/g, '');
    var pctStr = (balance24hPercent.textContent || '').replace(/[()%\s]/g, '');
    var negVal = /^−|^-/.test(valStr);
    var negPct = /^−|^-/.test(pctStr);
    valStr = valStr.replace(/^−|^-/, '-');
    pctStr = pctStr.replace(/^−|^-/, '-');
    var changeAbs = Math.abs(parseFloat(valStr) || 0);
    var changePct = Math.abs(parseFloat(pctStr) || 0);
    return {
      changeAbs: negVal ? -changeAbs : changeAbs,
      changePct: negPct ? -changePct : changePct
    };
  }

  function animateBalanceAnd24h(fromVal, toVal, from24h, to24h, durationMs) {
    var balanceEl = document.getElementById('balance-amount-value');
    if (!balanceEl) return;
    var steps = 15;
    var stepMs = 55;
    var stepIndex = 0;
    var fromAbs = from24h ? from24h.changeAbs : 0;
    var fromPct = from24h ? from24h.changePct : 0;
    var toAbs = to24h ? to24h.changeAbs : 0;
    var toPct = to24h ? to24h.changePct : 0;
    balanceEl.textContent = formatWithCommas(Number(fromVal).toFixed(2));
    if (balance24hValue && balance24hPercent && balance24hRow) {
      var signFrom = fromAbs >= 0 ? '+' : '−';
      balance24hValue.textContent = signFrom + formatWithCommas(Math.abs(fromAbs).toFixed(2));
      balance24hPercent.textContent = '(' + (fromPct >= 0 ? '+' : '−') + Math.abs(fromPct).toFixed(2) + '%)';
      balance24hRow.classList.remove('positive', 'negative');
      balance24hRow.classList.add(toPct >= 0 ? 'positive' : 'negative');
    }
    function tick() {
      stepIndex += 1;
      var t = stepIndex >= steps ? 1 : stepIndex / steps;
      var currentBalance = fromVal + (toVal - fromVal) * t;
      var currentAbs = fromAbs + (toAbs - fromAbs) * t;
      var currentPct = fromPct + (toPct - fromPct) * t;
      balanceEl.textContent = formatWithCommas(Number(currentBalance).toFixed(2));
      if (balance24hValue && balance24hPercent && balance24hRow) {
        var sign = currentPct >= 0 ? '+' : '−';
        balance24hValue.textContent = sign + formatWithCommas(Math.abs(currentAbs).toFixed(2));
        balance24hPercent.textContent = '(' + sign + Math.abs(currentPct).toFixed(2) + '%)';
        balance24hRow.classList.toggle('positive', currentPct >= 0);
        balance24hRow.classList.toggle('negative', currentPct < 0);
      }
      if (stepIndex < steps) setTimeout(tick, stepMs);
    }
    setTimeout(tick, stepMs);
  }

  function updateMainBalance(total) {
    if (balanceAmountValue) balanceAmountValue.textContent = formatWithCommas(Number(total).toFixed(2));
    if (balanceAmountSymbol) balanceAmountSymbol.textContent = '$';
  }

  function updateBalance24h(data) {
    if (!data || !balance24hValue || !balance24hSymbol || !balance24hPercent || !balance24hRow) return;
    const usdtVal = parseFloat(settingBalance && settingBalance.value.trim()) || 0;
    const btcVal = (parseFloat(document.querySelector('.token-item[data-token="btc"]')?.dataset.amount) || 0) * (data.bitcoin?.usd ?? 0);
    const ethVal = (parseFloat(document.querySelector('.token-item[data-token="eth"]')?.dataset.amount) || 0) * (data.ethereum?.usd ?? 0);
    const bnbVal = (parseFloat(document.querySelector('.token-item[data-token="bnb"]')?.dataset.amount) || 0) * (data.binancecoin?.usd ?? 0);
    const total = usdtVal + btcVal + ethVal + bnbVal;
    updateMainBalance(total);
    if (total <= 0) {
      balance24hValue.textContent = '+0.00';
      balance24hSymbol.textContent = '$';
      balance24hPercent.textContent = '(0.00%)';
      balance24hRow.classList.remove('negative');
      balance24hRow.classList.add('positive');
      return;
    }
    const usdtCh = data.tether?.usd_24h_change ?? 0;
    const btcCh = data.bitcoin?.usd_24h_change ?? 0;
    const ethCh = data.ethereum?.usd_24h_change ?? 0;
    const bnbCh = data.binancecoin?.usd_24h_change ?? 0;
    const changePct = (usdtVal * usdtCh + btcVal * btcCh + ethVal * ethCh + bnbVal * bnbCh) / total;
    const changeAbs = total * (changePct / 100);
    const positive = changePct >= 0;
    const sign = positive ? '+' : '−';
    balance24hValue.textContent = sign + formatWithCommas(Math.abs(changeAbs).toFixed(2));
    balance24hSymbol.textContent = '$';
    balance24hPercent.textContent = '(' + sign + Math.abs(changePct).toFixed(2) + '%)';
    balance24hRow.classList.remove('positive', 'negative');
    balance24hRow.classList.add(positive ? 'positive' : 'negative');
  }

  function showScreen(screenId, activeNavItem) {
    screens.forEach((s) => s.classList.remove('active'));
    navItems.forEach((n) => n.classList.remove('active'));
    const screen = document.getElementById(`screen-${screenId}`);
    if (screen) screen.classList.add('active');
    if (activeNavItem) activeNavItem.classList.add('active');
  }

  function updateUsdtFromBalance() {
    const value = settingBalance ? settingBalance.value.trim() : '0';
    const formatted = formatWithCommas(value || '0');
    const usdtRow = document.querySelector('.token-item[data-token="usdt"]');
    if (!usdtRow) return;
    const amountEl = usdtRow.querySelector('.token-info .token-amount');
    const valueEl = usdtRow.querySelector('.token-value .value');
    if (amountEl) amountEl.textContent = formatTokenAmount(formatted) + ' USDT';
    if (valueEl) valueEl.textContent = '$' + formatted;
  }

  function applyBalanceAndCurrency() {
    const value = settingBalance ? settingBalance.value.trim() : '0.96';
    const total = getTotalBalance(lastPriceData);
    updateMainBalance(total);
    if (balance24hSymbol) balance24hSymbol.textContent = '$';
    updateUsdtFromBalance();
    if (lastPriceData) updateBalance24h(lastPriceData);
    try {
      localStorage.setItem(STORAGE_BALANCE, value || '0');
    } catch (e) {}
  }

  function applyUsername() {
    const name = (settingUsername && settingUsername.value.trim()) || 'Username';
    if (headerUsername) headerUsername.textContent = name;
    try {
      localStorage.setItem(STORAGE_USERNAME, name === 'Username' ? '' : name);
    } catch (e) {}
  }

  try {
    const savedUsername = localStorage.getItem(STORAGE_USERNAME);
    if (savedUsername != null && savedUsername !== '' && settingUsername) settingUsername.value = savedUsername;
    if (savedUsername && headerUsername) headerUsername.textContent = savedUsername;
    const savedAddress = localStorage.getItem(STORAGE_ADDRESS);
    if (savedAddress != null && settingAddress) settingAddress.value = savedAddress;
    applyAddress();
    const savedBalance = localStorage.getItem(STORAGE_BALANCE);
    if (savedBalance != null && settingBalance) settingBalance.value = savedBalance;
    const savedBtc = localStorage.getItem(STORAGE_BTC);
    const savedEth = localStorage.getItem(STORAGE_ETH);
    const savedBnb = localStorage.getItem(STORAGE_BNB);
    if (savedBtc != null && settingBtc) settingBtc.value = savedBtc;
    if (savedEth != null && settingEth) settingEth.value = savedEth;
    if (savedBnb != null && settingBnb) settingBnb.value = savedBnb;
  } catch (e) {}

  if (settingUsername) {
    settingUsername.addEventListener('input', applyUsername);
    settingUsername.addEventListener('change', applyUsername);
  }

  if (settingBalance) {
    settingBalance.addEventListener('input', applyBalanceAndCurrency);
    settingBalance.addEventListener('change', applyBalanceAndCurrency);
  }
  if (settingAddress) {
    settingAddress.addEventListener('input', applyAddress);
    settingAddress.addEventListener('change', applyAddress);
  }
  if (headerAddress) headerAddress.addEventListener('click', copyAddress);
  const btnCopyAddress = document.querySelector('.btn-copy-address');
  if (btnCopyAddress) btnCopyAddress.addEventListener('click', copyAddress);

  var btnRefreshPrices = document.getElementById('btn-refresh-prices');
  if (btnRefreshPrices && balanceBlock) {
    btnRefreshPrices.addEventListener('click', function () {
      if (btnRefreshPrices.classList.contains('is-spinning')) return;
      savedBalanceBeforeRefresh = parseDisplayedBalance();
      saved24hBeforeRefresh = parseDisplayed24h();
      btnRefreshPrices.classList.add('is-spinning');
      balanceBlock.classList.add('balance-updating');
      addBalanceSkeleton();
      loadTokenPrices(
        function (data) {
          onPricesLoaded(data, true);
          btnRefreshPrices.classList.remove('is-spinning');
          balanceBlock.classList.remove('balance-updating');
        },
        true,
        function () {
          removeSkeleton();
        }
      );
    });
  }

  function onBtcEthBnbChange() {
    applyTokenAmountsToRows();
    if (lastPriceData) {
      updateTokenValuesFromPrices(lastPriceData);
      updateBalance24h(lastPriceData);
    }
  }
  if (settingBtc) {
    settingBtc.addEventListener('input', onBtcEthBnbChange);
    settingBtc.addEventListener('change', onBtcEthBnbChange);
  }
  if (settingEth) {
    settingEth.addEventListener('input', onBtcEthBnbChange);
    settingEth.addEventListener('change', onBtcEthBnbChange);
  }
  if (settingBnb) {
    settingBnb.addEventListener('input', onBtcEthBnbChange);
    settingBnb.addEventListener('change', onBtcEthBnbChange);
  }

  applyBalanceAndCurrency();
  applyUsername();
  applyTokenAmountsToRows();

  function getHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }
  function saveHistory(arr) {
    try {
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(arr));
    } catch (e) {}
  }
  function renderHistoryPanel() {
    const listEl = document.getElementById('history-list');
    if (!listEl) return;
    const items = getHistory();
    listEl.innerHTML = '';
    if (items.length === 0) return;
    items.slice().reverse().forEach((it) => {
      const row = document.createElement('div');
      row.className = 'history-item history-item-' + it.type;
      const typeLabel = it.type === 'send' ? 'Send' : it.type === 'receive' ? 'Receive' : 'Swap';
      const title = it.label && it.label.trim() ? it.label.trim() : typeLabel;
      const dateStr = it.date ? formatHistoryDate(it.date) : '';
      const amountSign = it.type === 'send' ? '−' : it.type === 'receive' ? '+' : '';
      const amountText = amountSign ? amountSign + ' ' + formatHistoryAmount(it.amount) + ' (' + it.symbol + ')' : formatHistoryAmount(it.amount) + ' (' + it.symbol + ')';
      const metaText = dateStr ? 'Completed · ' + dateStr : 'Completed';
      row.innerHTML =
        '<span class="history-item-icon ' + it.type + '" aria-hidden="true">' + getHistoryIcon(it.type) + '</span>' +
        '<div class="history-item-body">' +
          '<div class="history-item-title">' + escapeHtml(title) + '</div>' +
          '<div class="history-item-meta">' + escapeHtml(metaText) + '</div>' +
        '</div>' +
        '<div class="history-item-right">' +
          '<div class="history-item-amount ' + it.type + '">' + amountText + '</div>' +
        '</div>';
      listEl.appendChild(row);
    });
  }
  function getHistoryIcon(type) {
    if (type === 'send') return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>';
    if (type === 'receive') return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8l4 4-4 4"/><path d="M20 12H8"/></svg>';
  }
  function formatHistoryDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (sameDay) return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
    if (isYesterday) return 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function formatHistoryAmount(amount) {
    const n = parseFloat(amount);
    if (isNaN(n)) return amount || '0';
    if (Math.abs(n) >= 1000) return formatWithCommas(n.toFixed(0));
    if (Math.abs(n) >= 1) return formatWithCommas(n.toFixed(2));
    return String(n);
  }
  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  function renderSettingsHistoryList() {
    const container = document.getElementById('settings-history-list');
    if (!container) return;
    const items = getHistory();
    container.innerHTML = '';
    items.slice().reverse().forEach((it) => {
      const typeLabel = it.type === 'send' ? 'Send' : it.type === 'receive' ? 'Receive' : 'Swap';
      const amountSign = it.type === 'send' ? '−' : it.type === 'receive' ? '+' : '';
      const amountDisplay = amountSign ? amountSign + ' ' + formatHistoryAmount(it.amount) + ' (' + it.symbol + ')' : formatHistoryAmount(it.amount) + ' (' + it.symbol + ')';
      const div = document.createElement('div');
      div.className = 'history-settings-item';
      div.dataset.historyId = it.id;
      div.innerHTML = '<span class="history-settings-item-text"><strong>' + escapeHtml(typeLabel) + '</strong> ' + escapeHtml(amountDisplay) + (it.date ? '<br>' + escapeHtml(formatHistoryDate(it.date)) : '') + '</span><button type="button" class="settings-btn-remove" aria-label="Remove">Remove</button>';
      container.appendChild(div);
    });
  }
  function addHistoryItem(item) {
    const list = getHistory();
    list.push(item);
    saveHistory(list);
    renderHistoryPanel();
    renderSettingsHistoryList();
  }
  function removeHistoryItem(id) {
    const list = getHistory().filter((it) => it.id !== id);
    saveHistory(list);
    renderHistoryPanel();
    renderSettingsHistoryList();
  }

  const historyAddType = document.getElementById('history-add-type');
  const historyAddAmount = document.getElementById('history-add-amount');
  const historyAddSymbol = document.getElementById('history-add-symbol');
  const historyAddLabel = document.getElementById('history-add-label');
  const historyAddBtn = document.getElementById('history-add-btn');
  if (historyAddBtn && historyAddAmount) {
    historyAddBtn.addEventListener('click', function () {
      const amount = (historyAddAmount.value || '').trim();
      if (!amount) {
        showToast('Enter amount');
        return;
      }
      const type = (historyAddType && historyAddType.value) || 'send';
      const symbol = (historyAddSymbol && historyAddSymbol.value) || 'USDT';
      const label = (historyAddLabel && historyAddLabel.value) || '';
      const item = {
        id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        type: type,
        amount: amount,
        symbol: symbol,
        label: label.trim(),
        date: new Date().toISOString()
      };
      addHistoryItem(item);
      historyAddAmount.value = '';
      if (historyAddLabel) historyAddLabel.value = '';
      showToast('Transaction added');
    });
  }
  const settingsHistoryList = document.getElementById('settings-history-list');
  if (settingsHistoryList) {
    settingsHistoryList.addEventListener('click', function (e) {
      const btn = e.target.closest('.settings-btn-remove');
      if (!btn) return;
      const row = btn.closest('.history-settings-item');
      const id = row && row.dataset.historyId;
      if (id) removeHistoryItem(id);
      showToast('Removed');
    });
  }

  renderHistoryPanel();
  renderSettingsHistoryList();

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const screenId = item.dataset.screen;
      if (screenId) showScreen(screenId, item);
    });
  });

  if (btnSettings) btnSettings.addEventListener('click', () => showScreen('settings', null));

  (function setupContentTabs() {
    const tabs = document.querySelectorAll('.content-tab[data-panel]');
    const panels = document.querySelectorAll('.wallet-panel');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const panelId = tab.dataset.panel;
        if (!panelId) return;
        tabs.forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-pressed', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-pressed', 'true');
        panels.forEach((p) => {
          p.classList.toggle('active', p.id === 'panel-' + panelId);
        });
      });
    });
  })();
});
