const config = require('../config/index');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const data = cleanData(options.data || {});
    const url = `${config.baseUrl}${path}`;

    wx.request({
      url,
      method,
      data,
      timeout: config.timeout,
      success(response) {
        const body = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300 && body.success !== false) {
          resolve(body.data);
          return;
        }
        const message = body.message || `请求失败：${response.statusCode}`;
        logRequestError({ url, method, data, message, response });
        reject(new Error(message));
      },
      fail(error) {
        const message = error && error.errMsg ? error.errMsg : '网络请求失败';
        logRequestError({ url, method, data, message, error });
        reject(new Error(`${message}：${path}`));
      }
    });
  });
}

function cleanData(data) {
  const cleaned = {};
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  });
  return cleaned;
}

function logRequestError(detail) {
  console.error('[api request failed]', detail);
}

module.exports = {
  request
};
