const config = require('../config/index');

function canSubscribeMatch(match) {
  if (!isSubscriptionEnabled()) {
    return false;
  }
  if (!match || !match.apiMatchId) {
    return false;
  }
  if (['SCHEDULED', 'TIMED'].indexOf(match.status) < 0) {
    return false;
  }
  const matchTime = parseUtcDate(match.utcDate);
  return matchTime ? matchTime.getTime() > Date.now() + 5 * 60 * 1000 : false;
}

function isSubscriptionEnabled() {
  return Boolean(config.subscriptionTemplateId);
}

function decorateSubscriptionState(match, subscribedMatchIds = [], loadingMatchId = null) {
  const canSubscribe = canSubscribeMatch(match);
  const subscribed = subscribedMatchIds.indexOf(match.apiMatchId) >= 0;
  return {
    ...match,
    canSubscribe,
    subscribed,
    subscriptionLoading: loadingMatchId === match.apiMatchId,
    subscriptionText: getSubscriptionText(canSubscribe, subscribed, loadingMatchId === match.apiMatchId)
  };
}

function getSubscriptionText(canSubscribe, subscribed, loading) {
  if (loading) {
    return '订阅中';
  }
  if (subscribed) {
    return '已订阅';
  }
  return canSubscribe ? '订阅' : '';
}

function requestSubscribePermission() {
  if (!config.subscriptionTemplateId) {
    return Promise.reject(new Error('订阅消息模板 ID 未配置'));
  }
  return new Promise((resolve, reject) => {
    wx.requestSubscribeMessage({
      tmplIds: [config.subscriptionTemplateId],
      success(result) {
        if (result[config.subscriptionTemplateId] === 'accept') {
          resolve();
          return;
        }
        reject(new Error('你没有允许订阅通知'));
      },
      fail(error) {
        reject(new Error((error && error.errMsg) || '订阅授权失败'));
      }
    });
  });
}

function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result.code) {
          resolve(result.code);
          return;
        }
        reject(new Error('微信登录失败'));
      },
      fail(error) {
        reject(new Error((error && error.errMsg) || '微信登录失败'));
      }
    });
  });
}

function parseUtcDate(value) {
  if (!value) {
    return null;
  }
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  const date = new Date(`${normalized}${/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? '' : 'Z'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = {
  canSubscribeMatch,
  decorateSubscriptionState,
  isSubscriptionEnabled,
  requestSubscribePermission,
  login
};
